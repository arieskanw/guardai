import { Link } from "@tanstack/react-router";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <Shield className="h-5 w-5" />
          </span>
          <span className="truncate text-base font-semibold tracking-tight">AI Code Guardian</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="/#features" className="transition-colors hover:text-foreground">
            {t("nav.features")}
          </a>
          <a href="/#pricing" className="transition-colors hover:text-foreground">
            {t("nav.pricing")}
          </a>
          <a href="/#faq" className="transition-colors hover:text-foreground">
            {t("nav.faq")}
          </a>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LangToggle lang={lang} setLang={setLang} />
          {user ? (
            <Button asChild size="sm">
              <Link to="/dashboard">{t("nav.dashboard")}</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link to="/auth">{t("nav.signin")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "signup" }}>
                  {t("nav.start")}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex h-9 items-center rounded-full border border-border bg-background p-1 text-xs font-medium">
      {(["en", "id"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`grid h-7 min-w-[2rem] place-items-center rounded-full px-2 transition-colors ${
            lang === l
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
