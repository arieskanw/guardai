import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "seamless-dev-secret-change-in-production"
);

export interface SessionPayload extends JWTPayload {
  sub: string; // user id
  email?: string;
}

export async function createToken(userId: string, email?: string): Promise<string> {
  return new SignJWT({ sub: userId, email } as SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Auth header format: "Bearer <token>" */
export function extractToken(authHeader?: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
