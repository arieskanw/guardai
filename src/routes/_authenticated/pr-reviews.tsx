import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, Search, ExternalLink, ChevronRight, Activity, FileSearch, Bug } from "lucide-react";

import {
  listPrReviews,
  getPrReviewStats,
} from "@/lib/github.functions";

export const Route = createFileRoute("/_authenticated/pr-reviews")({
  component: PrReviewsPage,
});

const STATUS_OPTS = ["all", "completed", "running", "skipped", "failed"] as const;

const SEV_ICON: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

function PrReviewsPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const { data: stats } = useQuery({
    queryKey: ["pr-stats"],
    queryFn: () => getPrReviewStats({ headers }),
  });

  const { data: prs, isLoading } = useQuery({
    queryKey: ["pr-reviews"],
    queryFn: () => listPrReviews({ headers }),
  });

  const filtered = prs?.filter(
    (p: any) => statusFilter === "all" || p.status === statusFilter
  );

  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-20 sm:pb-0">
      <main className="space-y-6 px-4 pt-6">
        <h1 className="text-2xl font-bold">{t("prh.title")}</h1>

        {/* Stats Cards */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<Activity className="h-4 w-4 text-blue-600" />}
              label={t("prh.total")}
              value={stats.total}
              bg="bg-blue-50 dark:bg-blue-950/30"
            />
            <StatCard
              icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
              label={t("prh.avgScore")}
              value={`${stats.avgScore}/100`}
              bg="bg-emerald-50 dark:bg-emerald-950/30"
            />
            <StatCard
              icon={<FileSearch className="h-4 w-4 text-amber-600" />}
              label={t("prh.totalFindings")}
              value={stats.totalFindings}
              bg="bg-amber-50 dark:bg-amber-950/30"
            />
            <StatCard
              icon={<Bug className="h-4 w-4 text-red-600" />}
              label={t("prh.totalSecurity")}
              value={stats.totalSecurity}
              bg="bg-red-50 dark:bg-red-950/30"
            />
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t(("prh.filter" + s.charAt(0).toUpperCase() + s.slice(1)) as any)}
            </button>
          ))}
        </div>

        {/* PR List */}
        <div className="space-y-3">
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading...
            </p>
          )}

          {!isLoading && (!filtered || filtered.length === 0) && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
              <Search className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("prh.empty")}</p>
            </div>
          )}

          {filtered?.map((p: any) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] transition-shadow hover:shadow-md"
            >
              <button
                onClick={() =>
                  setExpanded(expanded === p.id ? null : p.id)
                }
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {p.repo_full_name}{" "}
                      <span className="text-muted-foreground">
                        #{p.pr_number}
                      </span>
                    </p>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.pr_title}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("id-ID", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {p.status === "completed" && (
                  <div className="flex shrink-0 items-center gap-2">
                    <ScoreBadge score={p.quality_score} />
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expanded === p.id ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                )}
              </button>

              {/* Expanded Detail */}
              {expanded === p.id && p.status === "completed" && (
                <PrReviewDetail review={p} t={t} />
              )}

              {/* Action bar */}
              <div className="flex items-center gap-2 border-t border-border/50 px-4 py-2.5">
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                  <a href={p.pr_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" />
                    {t("prh.viewOnGh")}
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function PrReviewDetail({ review, t }: { review: any; t: any }) {
  const result = review.result || {};

  return (
    <div className="border-t border-border/50 px-4 py-4 space-y-4">
      {/* Summary */}
      {result.summary && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("prh.summary")}
          </h4>
          <p className="text-sm leading-relaxed text-foreground/80">
            {result.summary}
          </p>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-lg font-bold">{review.quality_score}</p>
          <p className="text-muted-foreground">{t("prh.score")}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-lg font-bold">{review.findings_count}</p>
          <p className="text-muted-foreground">{t("prh.findings")}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-lg font-bold">{review.security_issues_count}</p>
          <p className="text-muted-foreground">{t("prh.security")}</p>
        </div>
      </div>

      {/* Findings */}
      {result.findings?.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            🔍 Findings ({result.findings.length})
          </h4>
          <div className="space-y-2">
            {result.findings.map((f: any, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-background p-2.5 text-xs">
                <p className="font-medium">
                  {SEV_ICON[f.severity] || "⚪"} {f.severity.toUpperCase()} —{" "}
                  {f.title}
                  {f.line != null && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({t("prh.line")} {f.line})
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-muted-foreground">{f.description}</p>
                {f.suggestion && (
                  <p className="mt-1 text-emerald-600 dark:text-emerald-400">
                    💡 {f.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security */}
      {result.security?.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            🔐 Security ({result.security.length})
          </h4>
          <div className="space-y-2">
            {result.security.map((f: any, i: number) => (
              <div key={i} className="rounded-lg border border-red-200 bg-red-50/50 p-2.5 text-xs dark:border-red-900 dark:bg-red-950/20">
                <p className="font-medium">
                  {SEV_ICON[f.severity] || "⚪"} {f.severity.toUpperCase()} —{" "}
                  {f.title}
                </p>
                <p className="mt-0.5 text-muted-foreground">{f.description}</p>
                {f.suggestion && (
                  <p className="mt-1 text-emerald-600 dark:text-emerald-400">
                    💡 {f.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Suggestions */}
      {result.tests && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            🧪 {t("prh.tests")}
          </h4>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
            {result.tests}
          </pre>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bg: string;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl ${bg} p-3.5`}>
      {icon}
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: {
      label: "Completed",
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    running: {
      label: "Running",
      cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    },
    failed: {
      label: "Failed",
      cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    },
    skipped: {
      label: "Skipped",
      cls: "bg-muted text-muted-foreground",
    },
  };
  const m = map[status] || map.skipped;
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
      : score >= 60
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${color}`}
    >
      {score}
    </span>
  );
}
