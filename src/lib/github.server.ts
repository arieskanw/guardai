// Server-only GitHub App helpers
import { SignJWT, importPKCS8 } from "jose";

const GH_API = "https://api.github.com";

function getAppCreds() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) {
    throw new Error("GitHub App is not configured (missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY)");
  }
  return { appId, privateKey };
}

export async function createAppJwt(): Promise<string> {
  const { appId, privateKey } = getAppCreds();
  const key = await importPKCS8(privateKey, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(appId)
    .sign(key);
}

type InstallTokenCache = { token: string; expiresAt: number };
const tokenCache = new Map<number, InstallTokenCache>();

export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const jwt = await createAppJwt();
  const res = await fetch(`${GH_API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub install token failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token: string; expires_at: string };
  tokenCache.set(installationId, {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime(),
  });
  return data.token;
}

export async function getInstallation(installationId: number) {
  const jwt = await createAppJwt();
  const res = await fetch(`${GH_API}/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch installation: ${res.status}`);
  return (await res.json()) as {
    id: number;
    account: { login: string; id: number; type: string };
  };
}

export async function listAppInstallations() {
  const jwt = await createAppJwt();
  const res = await fetch(`${GH_API}/app/installations?per_page=100`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`Failed to list installations: ${res.status}`);
  const data = (await res.json()) as Array<{
    id: number;
    created_at?: string;
    account: { login: string; id: number; type: string };
  }>;
  return data.map((i) => ({
    id: i.id,
    created_at: i.created_at ?? null,
    account: i.account,
  }));
}

export async function listInstallationRepos(installationId: number) {
  const token = await getInstallationToken(installationId);
  const res = await fetch(`${GH_API}/installation/repositories?per_page=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { repositories: Array<{ id: number; full_name: string; private: boolean }> };
  return data.repositories.map((r) => ({ id: r.id, full_name: r.full_name, private: r.private }));
}

export async function ghFetch(installationId: number, path: string, init?: RequestInit) {
  const token = await getInstallationToken(installationId);
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature || !signature.startsWith("sha256=")) return false;
  const expectedHex = signature.slice("sha256=".length);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const bytes = new Uint8Array(sig);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (hex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}
