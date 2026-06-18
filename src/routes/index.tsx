import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n, type TKey } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield,
  TestTube2,
  ShieldCheck,
  Layers,
  FileCode2,
  Zap,
  ArrowRight,
  Check,
  Sparkles,
  AlertTriangle,
  Code2,
  GitPullRequest,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GuardAI — AI code review, test generator & security scanner" },
      {
        name: "description",
        content:
          "Review AI-generated code like a senior dev. Framework-aware reviews, auto-generated tests, and OWASP security scans — built for the vibe coding era.",
      },
      {
        property: "og:title",
        content: "GuardAI — AI code review, tests & security",
      },
      {
        property: "og:description",
        content:
          "Framework-aware AI code review, auto-generated tests, and an OWASP security scan for Cursor, Claude Code, and Lovable output.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <Hero />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black,transparent)]" />

      <div className="container relative mx-auto px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="mr-1 h-3 w-3" />
            {t("hero.badge")}
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {t("hero.subtitle")}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                {t("hero.cta")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#features">{t("hero.cta2")}</a>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">{t("hero.trust")}</p>
        </div>

        {/* Preview cards — dashboard-style mockup */}
        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Code2 className="h-4 w-4" />
              <span className="font-medium text-foreground">index.tsx</span>
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">TypeScript</span>
            </div>
            <pre className="mt-3 overflow-hidden rounded-lg bg-[oklch(0.18_0.03_257)] p-3 text-[10px] leading-relaxed text-[oklch(0.95_0.01_250)]">
              <code>{`function greet(name: string) {
  return \`Hello, \${name}!\`;
}

// Potential issue: no input validation
const result = greet(userInput);`}</code>
            </pre>
            <div className="mt-2 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] text-amber-700">1 security finding</span>
              <span className="ml-auto text-[11px] text-muted-foreground">Score: 72</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitPullRequest className="h-4 w-4" />
              <span className="font-medium text-foreground">PR #42 Review</span>
              <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">Auto</span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { severity: "HIGH", text: "SQL injection pada query builder", line: 24 },
                { severity: "MEDIUM", text: "Missing error boundary di komponen", line: 56 },
                { severity: "LOW", text: "Unused import: useState", line: 1 },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                    f.severity === "HIGH" ? "bg-destructive/15 text-destructive" :
                    f.severity === "MEDIUM" ? "bg-amber-100 text-amber-800" :
                    "bg-blue-100 text-blue-800"
                  }`}>{f.severity}</span>
                  <span className="text-[11px] text-foreground">{f.text}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">L{f.line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const featureList: Array<{ icon: typeof Bot; t: TKey; d: TKey }> = [
  { icon: Shield, t: "f1.t", d: "f1.d" },
  { icon: TestTube2, t: "f2.t", d: "f2.d" },
  { icon: ShieldCheck, t: "f3.t", d: "f3.d" },
  { icon: Layers, t: "f4.t", d: "f4.d" },
  { icon: FileCode2, t: "f5.t", d: "f5.d" },
  { icon: Zap, t: "f6.t", d: "f6.d" },
];

function Features() {
  const { t } = useI18n();
  return (
    <section id="features" className="container mx-auto px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("features.title")}</h2>
        <p className="mt-4 text-muted-foreground">{t("features.subtitle")}</p>
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {featureList.map(({ icon: Icon, t: title, d: desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-elegant)]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{t(title)}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t(desc)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const { t } = useI18n();
  const plans = [
    {
      name: t("plan.free"),
      tag: t("plan.free.tag"),
      price: "$0",
      idrPrice: "0",
      cta: t("plan.free.cta"),
      popular: false,
      features: ["10 reviews / month", "Basic AI review", "Community support"],
    },
    {
      name: t("plan.pro"),
      tag: t("plan.pro.tag"),
      price: "$19",
      idrPrice: "19rb",
      cta: t("plan.cta"),
      popular: true,
      features: ["Unlimited reviews", "Tests + Security scan", "Custom guidelines", "Priority queue"],
    },
    {
      name: t("plan.team"),
      tag: t("plan.team.tag"),
      price: "$49",
      idrPrice: "49rb",
      cta: t("plan.cta"),
      popular: false,
      features: ["Everything in Pro", "Multi-user", "Team analytics", "Shared rules"],
    },
  ];

  return (
    <section id="pricing" className="py-20 lg:py-28">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("pricing.title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
                p.popular
                  ? "border-primary shadow-[var(--shadow-elegant)]"
                  : "border-border shadow-[var(--shadow-soft)]"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-6 inline-flex rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  {t("plan.popular")}
                </span>
              )}
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <span className="text-xs text-muted-foreground">{p.tag}</span>
              </div>
              <p className="mt-4">
                <span className="text-4xl font-bold">{p.idrPrice === "0" ? "$0" : p.idrPrice}</span>
                <span className="ml-1 text-sm text-muted-foreground">
                  {p.idrPrice === "0" ? "" : t("plan.month")}
                </span>
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8" variant={p.popular ? "default" : "outline"}>
                <Link to="/auth" search={{ mode: "signup" }}>
                  {p.cta}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const { t } = useI18n();
  const items: Array<{ q: TKey; a: TKey }> = [
    { q: "faq.q1", a: "faq.a1" },
    { q: "faq.q2", a: "faq.a2" },
    { q: "faq.q3", a: "faq.a3" },
    { q: "faq.q4", a: "faq.a4" },
  ];
  return (
    <section id="faq" className="container mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-28">
      <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
        {t("faq.title")}
      </h2>
      <Accordion type="single" collapsible className="mt-10">
        {items.map(({ q, a }) => (
          <AccordionItem key={q} value={q}>
            <AccordionTrigger className="text-left">{t(q)}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{t(a)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function CTA() {
  const { t } = useI18n();
  return (
    <section className="container mx-auto px-4 pb-20 sm:px-6 lg:pb-28">
      <div
        className="relative overflow-hidden rounded-3xl border border-border p-10 text-center shadow-[var(--shadow-elegant)] sm:p-16"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      >
        <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
          {t("cta.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/85">{t("cta.sub")}</p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth" search={{ mode: "signup" }}>
              {t("hero.cta")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
