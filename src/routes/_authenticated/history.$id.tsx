import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReview, type ReviewResult, type ReviewFinding, type Severity } from "@/lib/review.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, AlertTriangle, Sparkles, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history/$id")({
  head: () => ({
    meta: [
      { title: "Review — AI Code Guardian" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DetailPage,
});

function DetailPage() {
  const { t, lang } = useI18n();
  const { id } = Route.useParams();
  const fetchOne = useServerFn(getReview);

  const { data, isLoading, error } = useQuery({
    queryKey: ["review", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

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
          <Button asChild size="sm" variant="ghost">
            <Link to="/history">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {t("hist.back")}
            </Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        {isLoading && (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Error"}
          </p>
        )}
        {data && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
              <p className="font-mono text-sm text-muted-foreground">{data.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(data.created_at as string).toLocaleString()} · {data.language}
                {data.framework ? ` · ${data.framework}` : ""}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("hist.code")}
                </h2>
                <CodeBlock code={data.code as string} />
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
                <ReviewView result={data.result as ReviewResult} lang={lang} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewView({ result, lang }: { result: ReviewResult; lang: string }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("dash.quality")}
          </p>
          <p className="text-3xl font-bold">{result.qualityScore}</p>
        </div>
        <div className="min-w-[140px] flex-1">
          <Progress value={result.qualityScore} />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{result.summary}</p>

      <Tabs defaultValue="findings" className="mt-5">
        <TabsList className="w-full">
          <TabsTrigger value="findings" className="flex-1">
            {t("dash.findings")} ({result.findings.length})
          </TabsTrigger>
          <TabsTrigger value="security" className="flex-1">
            {t("dash.security")} ({result.security.length})
          </TabsTrigger>
          <TabsTrigger value="tests" className="flex-1">
            {t("dash.tests")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="findings" className="mt-4 space-y-3">
          <FindingList items={result.findings} />
        </TabsContent>
        <TabsContent value="security" className="mt-4 space-y-3">
          <FindingList items={result.security} />
        </TabsContent>
        <TabsContent value="tests" className="mt-4">
          <CodeBlock code={result.tests || "// (no tests generated)"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const severityStyle: Record<Severity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
  info: "bg-muted text-muted-foreground border-border",
};

function FindingList({ items }: { items: ReviewFinding[] }) {
  const { t } = useI18n();
  if (!items || items.length === 0) {
    return (
      <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
        {t("dash.noFindings")}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((f, i) => {
        const Icon = f.severity === "critical" || f.severity === "high" ? AlertTriangle : Sparkles;
        return (
          <li key={i} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityStyle[f.severity]}`}
              >
                <Icon className="h-3 w-3" />
                {f.severity}
              </span>
              {f.line != null && (
                <span className="text-xs text-muted-foreground">
                  {t("dash.line")} {f.line}
                </span>
              )}
              <h4 className="text-sm font-semibold">{f.title}</h4>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
            {f.suggestion && (
              <div className="mt-3">
                <CodeBlock code={f.suggestion} small />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CodeBlock({ code, small }: { code: string; small?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? t("dash.copied") : t("dash.copy")}
      </button>
      <pre
        className={`overflow-auto rounded-lg border border-border bg-[oklch(0.18_0.03_257)] p-4 text-xs leading-relaxed text-[oklch(0.95_0.01_250)] ${
          small ? "max-h-60" : "max-h-[480px]"
        }`}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
