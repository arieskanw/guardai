import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container mx-auto flex flex-col items-start justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
        <div>
          <p className="font-semibold text-foreground">GuardAI</p>
          <p className="mt-1">{t("footer.tag")}</p>
        </div>
        <p>
          © {year} GuardAI. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
