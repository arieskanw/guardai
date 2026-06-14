import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ installation_id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getInstallation, listInstallationRepos } = await import("./github.server");
    const inst = await getInstallation(data.installation_id);
    const repos = await listInstallationRepos(data.installation_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("github_installations")
      .upsert(
        {
          user_id: context.userId,
          installation_id: data.installation_id,
          account_login: inst.account.login,
          account_type: inst.account.type,
          account_id: inst.account.id,
          repositories: repos,
        },
        { onConflict: "installation_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, account: inst.account.login, repos: repos.length };
  });

export const listInstallations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("github_installations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const unlinkInstallation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ installation_id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("github_installations")
      .delete()
      .eq("installation_id", data.installation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPrReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: insts } = await context.supabase
      .from("github_installations")
      .select("installation_id");
    const ids = (insts ?? []).map((i) => i.installation_id as number);
    if (ids.length === 0) return [];
    const { data, error } = await context.supabase
      .from("pr_reviews")
      .select("id,repo_full_name,pr_number,pr_title,pr_url,quality_score,findings_count,security_issues_count,status,created_at")
      .in("installation_id", ids)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
