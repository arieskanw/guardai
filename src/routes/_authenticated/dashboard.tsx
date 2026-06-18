import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { reviewCode, saveReview, type ReviewFinding, type ReviewResult, type Severity } from "@/lib/review.functions";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  Play,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  History,
  Github,
  Upload,
  FileCode,
  Link2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — GuardAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const LANGUAGES = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "python",
  "php",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "dart",
  "ruby",
  "csharp",
];

function DashboardPage() {
  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const runReview = useServerFn(reviewCode);
  const persist = useServerFn(saveReview);

  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [framework, setFramework] = useState("");
  const [guidelines, setGuidelines] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const mutation = useMutation({
    mutationFn: (vars: { code: string; language: string; framework: string; guidelines: string }) =>
      runReview({ data: vars, method: "POST", headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: async (result, vars) => {
      try {
        const title = vars.code.split("\n")[0]?.slice(0, 80) || "Untitled review";
        await persist({
          data: {
            title,
            language: vars.language,
            framework: vars.framework,
            code: vars.code,
            result,
          },
        });
        toast.success(t("dash.saved"));
      } catch {
        // non-blocking
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("dash.error"));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending || code.trim().length < 10) return;
    mutation.mutate({ code, language, framework, guidelines });
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCode(text);
      setFileName(file.name);
      // Auto-detect language from extension
      const ext = file.name.split(".").pop()?.toLowerCase();
      const langMap: Record<string, string> = {
        ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
        py: "python", php: "php", go: "go", rs: "rust", java: "java",
        kt: "kotlin", swift: "swift", dart: "dart", rb: "ruby", cs: "csharp",
      };
      if (ext && langMap[ext]) setLanguage(langMap[ext]);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const result = mutation.data;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("dash.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("dash.subtitle")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6"
          >
            <div className="space-y-3">
              {/* Upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload")?.click()}
                className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : fileName
                      ? "border-emerald-300 bg-emerald-50/50"
                      : "border-muted-foreground/30 hover:border-muted-foreground/50"
                }`}
              >
                <input
                  id="file-upload"
                  type="file"
                  accept=".ts,.tsx,.js,.jsx,.py,.php,.go,.rs,.java,.kt,.swift,.dart,.rb,.cs,.txt,.vue,.css,.scss"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileCode className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">{fileName}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCode(""); setFileName(null); }}
                      className="ml-1 text-xs text-muted-foreground underline hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Click or drag & drop a code file
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      .ts, .tsx, .js, .py, .php, .go, .rs, .java, .dart, .vue, .css...
                    </p>
                  </div>
                )}
              </div>

              {/* Connect repo button */}
              <Link
                to="/integrations"
                className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                <Link2 className="h-4 w-4" />
                Connect your GitHub repo for auto review
              </Link>

              {/* OR divider */}
              <div className="flex items-center gap-3">
                <hr className="flex-1 border-border" />
                <span className="text-xs text-muted-foreground">OR</span>
                <hr className="flex-1 border-border" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="code">{t("dash.code")}</Label>
                <Textarea
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("dash.codePlaceholder")}
                  className="min-h-[200px] font-mono text-xs"
                  required
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="language">{t("dash.language")}</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="framework">{t("dash.framework")}</Label>
                <Input
                  id="framework"
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  placeholder="Next.js 15, Laravel 11…"
                />
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="guidelines">{t("dash.guidelines")}</Label>
              <Textarea
                id="guidelines"
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                placeholder={t("dash.guidelinesPh")}
                className="min-h-[80px] text-sm"
              />
            </div>
            <Button
              type="submit"
              className="mt-5 w-full"
              size="lg"
              disabled={mutation.isPending || code.trim().length < 10}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("dash.running")}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {t("dash.run")}
                </>
              )}
            </Button>
          </form>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
            {!result && !mutation.isPending && (
              <EmptyState text={t("dash.empty")} />
            )}
            {mutation.isPending && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-sm">{t("dash.running")}</p>
              </div>
            )}
            {result && <ReviewView result={result} lang={lang} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </span>
      <p className="mt-3 max-w-xs text-sm">{text}</p>
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

function FindingList({ items }: { items: ReviewFinding[] }) {
  const { t } = useI18n();
  if (items.length === 0) {
    return <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">{t("dash.noFindings")}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((f, i) => (
        <li
          key={i}
          className="rounded-xl border border-border bg-background p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={f.severity} />
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
      ))}
    </ul>
  );
}

const severityStyle: Record<Severity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
  info: "bg-muted text-muted-foreground border-border",
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = severity === "critical" || severity === "high" ? AlertTriangle : Sparkles;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityStyle[severity]}`}
    >
      <Icon className="h-3 w-3" />
      {severity}
    </span>
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
