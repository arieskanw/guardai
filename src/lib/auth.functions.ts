import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { query, queryOne } from "./db";
import { createToken, verifyToken, extractToken } from "./auth";
import { createMiddleware } from "@tanstack/react-start";
import { authenticateRequest } from "./auth.server";
// ============ Auth Middleware ============

export const requireAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const ctx = await authenticateRequest();
    return next({ context: ctx });
  }
);

// ============ Register ============

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

export const register = createServerFn({ method: "POST" })
  .validator((d: unknown) => registerSchema.parse(d))
  .handler(async ({ data }) => {
    // Check if email already exists
    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [data.email]);
    if (existing) throw new Error("Email already registered");

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await queryOne<{ id: string; email: string }>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email`,
      [data.email, passwordHash, data.displayName || data.email.split("@")[0]]
    );

    // Generate & send OTP
    const { generateOtp, sendEmail, buildOtpEmailHtml, buildOtpEmailText } = await import("./email.server");
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await query(
      "UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3",
      [otp, otpExpires.toISOString(), user!.id]
    );

    // Fire-and-forget email send (don't block registration)
    sendEmail({
      to: user!.email,
      subject: "Verify your GuardAI email",
      text: buildOtpEmailText(otp),
      html: buildOtpEmailHtml(otp),
    }).then((r) => {
      if (!r.ok) console.warn("[auth] Failed to send verification email:", r.error);
    });

    const token = await createToken(user!.id, user!.email);
    return {
      token,
      user: { id: user!.id, email: user!.email, email_verified: false },
    };
  });

// ============ Login ============

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const login = createServerFn({ method: "POST" })
  .validator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const user = await queryOne<{
      id: string;
      email: string;
      password_hash: string;
      display_name: string | null;
      avatar_url: string | null;
      email_verified_at: string | null;
    }>("SELECT id, email, password_hash, display_name, avatar_url, email_verified_at FROM users WHERE email = $1", [
      data.email,
    ]);

    if (!user) throw new Error("Invalid email or password");
    if (!user.password_hash) throw new Error("This account uses GitHub login. Try signing in with GitHub.");

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) throw new Error("Invalid email or password");

    const token = await createToken(user.id, user.email);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        email_verified: !!user.email_verified_at,
      },
    };
  });

// ============ GitHub OAuth ============

export const getGithubOauthUrl = createServerFn({ method: "GET" }).handler(async () => {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GitHub OAuth not configured");

  const redirectUri = `${process.env.PUBLIC_URL || "http://localhost:3000"}/api/auth/github/callback`;
  const state = crypto.randomUUID();

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);

  return { url: url.toString(), state };
});

export const handleGithubCallback = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ code: z.string(), state: z.string() }).parse(d)
  )
  .handler(async ({ data }) => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("GitHub OAuth not configured");

    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: data.code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);

    // Get user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) throw new Error("Failed to get GitHub user info");
    const ghUser = await userRes.json();

    // Get primary email
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const emails = await emailsRes.json();
    const primaryEmail = Array.isArray(emails) ? emails.find((e: any) => e.primary)?.email || ghUser.email : ghUser.email;

    // Check if GitHub account already linked
    let user = await queryOne<{ id: string; email: string | null }>(
      "SELECT id, email FROM users WHERE github_id = $1",
      [ghUser.id]
    );

    if (user) {
      // Existing user - return token
      const token = await createToken(user.id, user.email || undefined);
      return { token, user: { id: user.id, email: user.email, display_name: ghUser.login, avatar_url: ghUser.avatar_url }, isNew: false };
    }

    // Check if email already registered (link accounts)
    if (primaryEmail) {
      user = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = $1", [primaryEmail]);
      if (user) {
        await query(
          "UPDATE users SET github_id = $1, github_login = $2, avatar_url = $3 WHERE id = $4",
          [ghUser.id, ghUser.login, ghUser.avatar_url, user.id]
        );
        const token = await createToken(user.id, primaryEmail);
        return { token, user: { id: user.id, email: primaryEmail, display_name: ghUser.login, avatar_url: ghUser.avatar_url }, isNew: false };
      }
    }

    // Create new user
    const newUser = await queryOne<{ id: string }>(
      `INSERT INTO users (email, github_id, github_login, display_name, avatar_url, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id`,
      [primaryEmail, ghUser.id, ghUser.login, ghUser.name || ghUser.login, ghUser.avatar_url]
    );

    const token = await createToken(newUser!.id, primaryEmail || undefined);
    return {
      token,
      user: { id: newUser!.id, email: primaryEmail, display_name: ghUser.login, avatar_url: ghUser.avatar_url },
      isNew: true,
    };
  });

// ============ Get current user ============

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    return {
      ...context.user,
      email_verified: !!context.user.email_verified_at,
    };
  });

// ============ Verify OTP ============

const verifyOtpSchema = z.object({
  otp: z.string().length(6),
});

export const verifyOtp = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => verifyOtpSchema.parse(d))
  .handler(async ({ data, context }) => {
    const user = await queryOne<{
      otp_code: string | null;
      otp_expires_at: string | null;
      email_verified_at: string | null;
    }>(
      "SELECT otp_code, otp_expires_at, email_verified_at FROM users WHERE id = $1",
      [context.userId]
    );
    if (!user) throw new Error("User not found");

    // Already verified
    if (user.email_verified_at) {
      return { ok: true, alreadyVerified: true };
    }

    // Check code
    if (!user.otp_code || !user.otp_expires_at) {
      throw new Error("No OTP found. Request a new one.");
    }

    if (user.otp_code !== data.otp) {
      throw new Error("Invalid verification code");
    }

    if (new Date(user.otp_expires_at) < new Date()) {
      throw new Error("OTP has expired. Request a new one.");
    }

    await query(
      `UPDATE users SET email_verified_at = now(), otp_code = NULL, otp_expires_at = NULL WHERE id = $1`,
      [context.userId]
    );

    return { ok: true, alreadyVerified: false };
  });

// ============ Resend OTP ============

export const resendOtp = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const user = await queryOne<{
      email: string | null;
      email_verified_at: string | null;
    }>(
      "SELECT email, email_verified_at FROM users WHERE id = $1",
      [context.userId]
    );
    if (!user) throw new Error("User not found");

    if (user.email_verified_at) {
      return { ok: true, alreadyVerified: true };
    }

    if (!user.email) {
      throw new Error("No email on account (GitHub login). Email verification not needed.");
    }

    const { generateOtp, sendEmail, buildOtpEmailHtml, buildOtpEmailText } = await import("./email.server");
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      "UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3",
      [otp, otpExpires.toISOString(), context.userId]
    );

    const result = await sendEmail({
      to: user.email,
      subject: "Verify your GuardAI email",
      text: buildOtpEmailText(otp),
      html: buildOtpEmailHtml(otp),
    });

    if (!result.ok) throw new Error("Failed to send email. Please try again.");

    return { ok: true };
  });

// ============ Update Profile ============

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => updateProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.displayName !== undefined) {
      updates.push(`display_name = $${idx++}`);
      values.push(data.displayName);
    }
    if (data.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${idx++}`);
      values.push(data.avatarUrl);
    }

    if (updates.length === 0) return { ok: true };

    values.push(context.userId);
    await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`,
      values
    );

    return { ok: true };
  });

// ============ Change Password ============

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => changePasswordSchema.parse(d))
  .handler(async ({ data, context }) => {
    const user = await queryOne<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [context.userId]
    );
    if (!user) throw new Error("User not found");

    // If user has password, verify current one
    if (user.password_hash) {
      const valid = await bcrypt.compare(data.currentPassword, user.password_hash);
      if (!valid) throw new Error("Current password is incorrect");
    }

    const newHash = await bcrypt.hash(data.newPassword, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      newHash,
      context.userId,
    ]);

    return { ok: true };
  });
