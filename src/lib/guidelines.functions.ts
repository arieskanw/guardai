import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ReviewGuideline = {
  id: string;
  user_id: string;
  name: string;
  repo_full_name: string | null;
  guidelines: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

async function getQuery() {
  const { query } = await import("./db");
  return query;
}

async function authContext() {
  const { authenticateRequest } = await import("./auth.functions");
  return authenticateRequest();
}

export const listGuidelines = createServerFn({ method: "GET" })
  .handler(async () => {
    const ctx = await authContext();
    const query = await getQuery();
    const { rows } = await query<ReviewGuideline>(
      `SELECT id, name, repo_full_name, guidelines, is_active, created_at, updated_at
       FROM review_guidelines
       WHERE user_id = $1
       ORDER BY is_active DESC, created_at DESC`,
      [ctx.userId]
    );
    return rows;
  });

export const getGuideline = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const ctx = await authContext();
    const query = await getQuery();
    const { rows } = await query<ReviewGuideline>(
      "SELECT * FROM review_guidelines WHERE id = $1 AND user_id = $2",
      [data.id, ctx.userId]
    );
    return rows[0] || null;
  });

export const saveGuideline = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(1).max(100),
        repo_full_name: z.string().nullable(),
        guidelines: z.string(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const ctx = await authContext();
    const query = await getQuery();

    if (data.id) {
      const { rows } = await query<ReviewGuideline>(
        `UPDATE review_guidelines
         SET name = $1, repo_full_name = $2, guidelines = $3, updated_at = now()
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [data.name, data.repo_full_name, data.guidelines, data.id, ctx.userId]
      );
      return rows[0];
    } else {
      const { rows } = await query<ReviewGuideline>(
        `INSERT INTO review_guidelines (user_id, name, repo_full_name, guidelines)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [ctx.userId, data.name, data.repo_full_name, data.guidelines]
      );
      return rows[0];
    }
  });

export const deleteGuideline = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const ctx = await authContext();
    const query = await getQuery();
    await query("DELETE FROM review_guidelines WHERE id = $1 AND user_id = $2", [
      data.id,
      ctx.userId,
    ]);
    return { ok: true };
  });

export const toggleGuideline = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ id: z.string(), is_active: z.boolean() }).parse(d)
  )
  .handler(async ({ data }) => {
    const ctx = await authContext();
    const query = await getQuery();
    const { rows } = await query<ReviewGuideline>(
      `UPDATE review_guidelines
       SET is_active = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [data.is_active, data.id, ctx.userId]
    );
    return rows[0];
  });

/** Find active guideline text for a specific repo, or fallback to global */
export async function getGuidelinesForRepo(
  userId: string,
  repoFullName: string
): Promise<string[]> {
  const { query } = await import("./db");
  const { rows } = await query<{ guidelines: string }>(
    `SELECT guidelines FROM review_guidelines
     WHERE user_id = $1 AND is_active = true
       AND (repo_full_name = $2 OR repo_full_name IS NULL)
     ORDER BY repo_full_name IS NOT NULL DESC
     LIMIT 2`,
    [userId, repoFullName]
  );
  return rows.map((r) => r.guidelines).filter(Boolean);
}
