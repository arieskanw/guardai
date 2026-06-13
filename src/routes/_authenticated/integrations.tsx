import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getGithubConfig,
  linkInstallation,
  listInstallations,
  listPrReviews,
  unlinkInstallation,
} from "@/lib/github.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ExternalLink,
  Github,
  Loader2,
  LogOut,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";

const searchSchema = z
  .object({
    installation_id: z.coerce.number().int().positive().optional(),
    setup_action: z.string().optional(),
  })
  .passthrough();

export const Route = createFileRoute("/_authenticated/integrations")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s ?? {}),
  head: () => ({
    meta: [
      { title: "Integrations — AI Code Guardian" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = Route.useSearch();

  const cfgFn = useServerFn(getGithubConfig);
  const listFn = useServerFn(listInstallations);
  const prFn = useServerFn(listPrReviews);
  const linkFn = useServerFn(linkInstallation);
  const unlinkFn = useServerFn(unlinkInstallation);

  const { data: cfg } = useQuery({ queryKey: ["gh-cfg"], queryFn: () => cfgFn() });
  const { data: installs, isLoading } = useQuery({
    queryKey: ["gh-installs"],
    queryFn: () => listFn(),
  });
  const { data: prs } = useQuery({ queryKey: ["gh-prs"], queryFn: () => prFn() });

  const link = useMutation({
    mutationFn: (id: number) => linkFn({ data: { installation_id: id } }),
    onSuccess: (r) => {
      toast.success(`${t("gh.linked")} — ${r.account} (${r.repos} ${t("gh.repos")})`);
      qc.invalidateQueries({ queryKey: ["gh-installs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const unlink = useMutation({
    mutationFn: (id: number) => unlinkFn({ data: { installation_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gh-installs"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Handle GitHub redirect after install
  useEffect(() => {
    if (search.installation_id && search.setup_action) {
      const id = search.installation_id;
      link.mutate(id);
      navigate({ to: "/integrations", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.installation_id, search.setup_action]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const installUrl = cfg?.appSlug
    ? `https://github.com/apps/${cfg.appSlug}/installations/new`
    : null;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
              <Shield className="h-5 w-5" />
            </span>
            <span className="truncate text-base font-semibold">AI Code Guardian</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
            <Button asChild size="sm" variant="ghost">
              <Link to="/dashboard">
                <Plus className="mr-1.5 h-4 w-4" />
                {t("dash.newReview")}
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-4 w-4" />
              {t("nav.signout")}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto space-y-8 px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Github className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("gh.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("gh.subtitle")}</p>
          </div>
        </div>

        {!cfg?.configured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {t("gh.notConfigured")}
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">{t("gh.connected")}</h2>
            {installUrl && (
              <Button asChild size="sm">
                <a href={installUrl} target="_blank" rel="noreferrer">
                  <Github className="mr-1.5 h-4 w-4" />
                  {t("gh.install")}
                </a>
              </Button>
            )}
          </div>

          {link.isPending && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("gh.linking")}
            </p>
          )}

          <div className="mt-5">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : !installs || installs.length === 0 ? (
              <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                {t("gh.empty")}
              </p>
            ) : (
              <ul className="space-y-3">
                {installs.map((i: any) => (
                  <li
                    key={i.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {i.account_login}{" "}
                        <span className="ml-1 text-xs text-muted-foreground">({i.account_type})</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(i.repositories?.length ?? 0)} {t("gh.repos")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => unlink.mutate(i.installation_id)}
                      disabled={unlink.isPending}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4 text-destructive" />
                      {t("gh.unlink")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <h2 className="text-lg font-semibold">{t("gh.prReviews")}</h2>
          <div className="mt-4">
            {!prs || prs.length === 0 ? (
              <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                {t("gh.prEmpty")}
              </p>
            ) : (
              <ul className="space-y-3">
                {prs.map((p: any) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {p.repo_full_name} <span className="text-muted-foreground">#{p.pr_number}</span>
                      </p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{p.pr_title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString()} ·{" "}
                        <StatusPill status={p.status} />
                      </p>
                    </div>
                    {p.status === "completed" && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Stat label="Score" value={p.quality_score} tone="primary" />
                        <Stat label="Find" value={p.findings_count} />
                        <Stat label="Sec" value={p.security_issues_count} tone="warn" />
                      </div>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <a href={p.pr_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        {t("gh.viewPr")}
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, { cls: string; key: string }> = {
    running: { cls: "bg-blue-100 text-blue-800", key: "gh.status.running" },
    completed: { cls: "bg-emerald-100 text-emerald-800", key: "gh.status.completed" },
    failed: { cls: "bg-destructive/15 text-destructive", key: "gh.status.failed" },
    skipped: { cls: "bg-muted text-muted-foreground", key: "gh.status.skipped" },
  };
  const m = map[status] || map.skipped;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.cls}`}>
      {t(m.key as any)}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "primary" | "warn" }) {
  const cls =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/20"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${cls}`}>
      <span className="font-semibold">{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}
