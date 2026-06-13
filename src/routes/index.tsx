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
  Bot,
  TestTube2,
  ShieldCheck,
  Layers,
  FileCode2,
  Zap,
  ArrowRight,
  Check,
} from "lucide-react";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Code Guardian — AI code review, test generator & security scanner" },
      {
        name: "description",
        content:
          "Review AI-generated code like a senior dev. Framework-aware reviews, auto-generated tests, and OWASP security scans — built for the vibe coding era.",
      },
      {
        property: "og:title",
        content: "AI Code Guardian — AI code review, tests & security",
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
    <div className="min-h-screen bg-background">
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
    <section
      className="relative overflow-hidden"
      style={{ backgroundImage: "var(--gradient-hero)" }}
    >
      <div className="container mx-auto grid gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
        <div className="max-w-2xl">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t("hero.badge")}
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
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
        <div className="relative">
          <img
            src={heroImg}
            alt=""
            width={1600}
            height={1024}
            className="w-full rounded-2xl border border-border shadow-[var(--shadow-elegant)]"
          />
        </div>
      </div>
    </section>
  );
}

const featureList: Array<{ icon: typeof Bot; t: TKey; d: TKey }> = [
  { icon: Bot, t: "f1.t", d: "f1.d" },
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
      cta: t("plan.free.cta"),
      popular: false,
      features: ["10 reviews / month", "Basic AI review", "Community support"],
    },
    {
      name: t("plan.pro"),
      tag: t("plan.pro.tag"),
      price: "$19",
      cta: t("plan.cta"),
      popular: true,
      features: ["Unlimited reviews", "Tests + Security scan", "Custom guidelines", "Priority queue"],
    },
    {
      name: t("plan.team"),
      tag: t("plan.team.tag"),
      price: "$49",
      cta: t("plan.cta"),
      popular: false,
      features: ["Everything in Pro", "Multi-user", "Team analytics", "Shared rules"],
    },
  ];

  return (
    <section id="pricing" className="bg-secondary/40 py-20 lg:py-28">
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
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="ml-1 text-sm text-muted-foreground">{t("plan.month")}</span>
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
