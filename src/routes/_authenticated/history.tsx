import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReviews, deleteReview } from "@/lib/review.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  History as HistoryIcon,
  Loader2,
  LogOut,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "History — AI Code Guardian" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchList = useServerFn(listReviews);
  const removeFn = useServerFn(deleteReview);

  const { data, isLoading } = useQuery({
    queryKey: ["reviews"],
    queryFn: () => fetchList(),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("hist.deleted"));
      qc.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

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

      <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <HistoryIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("hist.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("hist.subtitle")}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">{t("hist.empty")}</p>
            <Button asChild className="mt-4">
              <Link to="/dashboard">
                <Plus className="mr-1.5 h-4 w-4" />
                {t("dash.newReview")}
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-medium">{r.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()} · {r.language}
                      {r.framework ? ` · ${r.framework}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Stat label={t("hist.score")} value={r.quality_score} tone="primary" />
                    <Stat label={t("hist.findings")} value={r.findings_count} />
                    <Stat label={t("hist.security")} value={r.security_issues_count} tone="warn" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/history/$id" params={{ id: r.id }}>
                        {t("hist.view")}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(t("hist.confirmDelete"))) del.mutate(r.id);
                      }}
                      disabled={del.isPending}
                      aria-label={t("hist.delete")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "primary" | "warn";
}) {
  const cls =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/20"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${cls}`}>
      <span className="font-semibold">{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}
