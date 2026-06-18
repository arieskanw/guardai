import { createToken, verifyToken, extractToken } from "./auth";
import { queryOne } from "./db";

/**
 * Authenticates a request by extracting and verifying a JWT from the Authorization header.
 * This file is .server.ts — it will never be imported by client code,
 * so it can safely import @tanstack/react-start/server.
 */
export async function authenticateRequest(): Promise<{
  userId: string;
  user: {
    id: string;
    email: string | null;
    display_name: string | null;
    github_login: string | null;
    avatar_url: string | null;
    email_verified_at: string | null;
  };
}> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const token = extractToken(request.headers.get("authorization"));
  if (!token) throw new Error("Unauthorized: No token provided");

  const payload = await verifyToken(token);
  if (!payload?.sub) throw new Error("Unauthorized: Invalid token");

  const user = await queryOne<{
    id: string;
    email: string | null;
    display_name: string | null;
    github_login: string | null;
    avatar_url: string | null;
    email_verified_at: string | null;
  }>("SELECT id, email, display_name, github_login, avatar_url, email_verified_at FROM users WHERE id = $1", [
    payload.sub,
  ]);

  if (!user) throw new Error("Unauthorized: User not found");
  return { userId: user.id, user };
}
