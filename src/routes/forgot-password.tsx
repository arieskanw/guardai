import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { forgotPassword } from "@/lib/auth.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, ArrowRight, Shield } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — GuardAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const forgotFn = useServerFn(forgotPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    try {
      await forgotFn({ data: { email } });
      setSent(true);
      toast.success(t("forgot.sent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-bold">{t("forgot.checkTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("forgot.checkDesc")} <strong>{email}</strong></p>
          <Button className="mt-6" onClick={() => navigate({ to: "/reset-password", search: { email } })}>
            <ArrowRight className="mr-2 h-4 w-4" />
            {t("forgot.enterCode")}
          </Button>
          <div className="mt-4">
            <Link to="/auth" className="text-xs text-muted-foreground underline hover:text-primary">
              {t("auth.back")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
      <div className="w-full max-w-md">
        <Link to="/auth" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("auth.back")}
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
              <Shield className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold">GuardAI</span>
          </div>
          <h1 className="mt-6 text-xl font-bold">{t("forgot.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("forgot.subtitle")}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={!email}>
              <Mail className="mr-2 h-4 w-4" />
              {t("forgot.send")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
