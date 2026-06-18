import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth.functions";
import { query, queryOne } from "./db";

function normalizeGithubAppSlug(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const [, appsSegment, slug] = url.pathname.split("/");
    if (url.hostname === "github.com" && appsSegment === "apps" && slug) {
      return slug;
    }
  } catch {
    // Not a full URL; fall through and treat it as a slug/path.
  }

  const parts = raw.split("/").filter(Boolean);
  const appsIndex = parts.indexOf("apps");
  return appsIndex >= 0 ? parts[appsIndex + 1] || null : parts[0] || null;
}

export const getGithubConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    appSlug: normalizeGithubAppSlug(process.env.GITHUB_APP_SLUG),
    configured: Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY),
  };
});

export const linkInstallation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ installation_id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getInstallation, listInstallationRepos } = await import("./github.server");
    const inst = await getInstallation(data.installation_id);
    const repos = await listInstallationRepos(data.installation_id);

    await query(
      `INSERT INTO github_installations (user_id, installation_id, account_login, account_type, account_id, repositories)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (installation_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         account_login = EXCLUDED.account_login,
         account_type = EXCLUDED.account_type,
         account_id = EXCLUDED.account_id,
         repositories = EXCLUDED.repositories`,
      [context.userId, data.installation_id, inst.account.login, inst.account.type, inst.account.id, JSON.stringify(repos)]
    );

    return { ok: true, account: inst.account.login, repos: repos.length };
  });

export const syncExistingInstallation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { listAppInstallations, listInstallationRepos } = await import("./github.server");

    const { rows: linked } = await query<{ installation_id: number }>(
      "SELECT installation_id FROM github_installations"
    );

    const linkedIds = new Set(linked.map((i) => Number(i.installation_id)));
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const candidates = (await listAppInstallations())
      .filter((i) => !linkedIds.has(i.id))
      .filter((i) => !i.created_at || new Date(i.created_at).getTime() >= oneDayAgo)
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

    if (candidates.length === 0) {
      return { ok: false, reason: "none" as const };
    }
    if (candidates.length > 1) {
      return { ok: false, reason: "multiple" as const };
    }

    const inst = candidates[0];
    const repos = await listInstallationRepos(inst.id);
    await query(
      `INSERT INTO github_installations (user_id, installation_id, account_login, account_type, account_id, repositories)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (installation_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         account_login = EXCLUDED.account_login,
         account_type = EXCLUDED.account_type,
         account_id = EXCLUDED.account_id,
         repositories = EXCLUDED.repositories`,
      [context.userId, inst.id, inst.account.login, inst.account.type, inst.account.id, JSON.stringify(repos)]
    );

    return { ok: true, account: inst.account.login, repos: repos.length };
  });

export const listInstallations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { rows } = await query(
      "SELECT * FROM github_installations WHERE user_id = $1 ORDER BY created_at DESC",
      [context.userId]
    );
    return rows;
  });

export const unlinkInstallation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ installation_id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { rowCount } = await query(
      "DELETE FROM github_installations WHERE installation_id = $1 AND user_id = $2",
      [data.installation_id, context.userId]
    );
    if (rowCount === 0) throw new Error("Not found or unauthorized");
    return { ok: true };
  });

export const listPrReviews = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { rows: insts } = await query<{ installation_id: number }>(
      "SELECT installation_id FROM github_installations WHERE user_id = $1",
      [context.userId]
    );
    const ids = insts.map((i) => i.installation_id);
    if (ids.length === 0) return [];

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const { rows } = await query(
      `SELECT id, repo_full_name, pr_number, pr_title, pr_url, quality_score, findings_count, security_issues_count, status, created_at
       FROM pr_reviews
       WHERE installation_id IN (${placeholders})
       ORDER BY created_at DESC
       LIMIT 50`,
      ids
    );
    return rows;
  });

export const getPrReviewStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { rows: insts } = await query<{ installation_id: number }>(
      "SELECT installation_id FROM github_installations WHERE user_id = $1",
      [context.userId]
    );
    const ids = insts.map((i) => i.installation_id);
    if (ids.length === 0)
      return { total: 0, avgScore: 0, totalFindings: 0, totalSecurity: 0 };

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const { rows } = await query(
      `SELECT
        COUNT(*)::int AS total,
        COALESCE(ROUND(AVG(quality_score)::numeric), 0)::int AS avg_score,
        COALESCE(SUM(findings_count), 0)::int AS total_findings,
        COALESCE(SUM(security_issues_count), 0)::int AS total_security
       FROM pr_reviews
       WHERE installation_id IN (${placeholders})
         AND status = 'completed'`,
      ids
    );
    return {
      total: rows[0]?.total ?? 0,
      avgScore: rows[0]?.avg_score ?? 0,
      totalFindings: rows[0]?.total_findings ?? 0,
      totalSecurity: rows[0]?.total_security ?? 0,
    };
  });
