import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { resetPassword } from "@/lib/auth.functions";
import { useState, useRef } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Shield, KeyRound, CheckCircle } from "lucide-react";

const searchSchema = z.object({
  email: z.string().email().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Reset Password — GuardAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email || "");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [step, setStep] = useState<"otp" | "password" | "done">(search.email ? "otp" : "otp");
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const resetFn = useServerFn(resetPassword);

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(0, 1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleSubmitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.join("").length !== 6) return;
    setStep("password");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPass !== confirmPass) {
      toast.error(t("forgot.passMismatch"));
      return;
    }
    if (newPass.length < 8) {
      toast.error(t("forgot.passShort"));
      return;
    }
    setSubmitting(true);
    try {
      await resetFn({
        data: { email, otp: otp.join(""), newPassword: newPass },
      });
      toast.success(t("forgot.passReset"));
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-bold">{t("forgot.doneTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("forgot.doneDesc")}</p>
          <Button className="mt-6" onClick={() => navigate({ to: "/auth", replace: true })}>
            {t("auth.signin")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
      <div className="w-full max-w-md">
        <Link to="/forgot-password" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
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

          {step === "otp" && (
            <>
              <h1 className="mt-6 text-xl font-bold">{t("forgot.otpTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("forgot.otpDesc")}</p>

              <form onSubmit={handleSubmitOtp} className="mt-6 space-y-4">
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
                <Label className="text-xs text-muted-foreground">{t("verify.enterCode")}</Label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <Input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="h-12 w-12 text-center text-lg font-bold"
                      maxLength={1}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                <Button type="submit" className="w-full" disabled={otp.join("").length !== 6}>
                  <ArrowLeft className="mr-2 h-4 w-4 rotate-180" />
                  {t("forgot.next")}
                </Button>
              </form>
            </>
          )}

          {step === "password" && (
            <>
              <h1 className="mt-6 text-xl font-bold">{t("forgot.passTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("forgot.passDesc")}</p>

              <form onSubmit={handleReset} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPass">{t("profile.newPass")}</Label>
                  <Input
                    id="newPass"
                    type="password"
                    required
                    minLength={8}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPass">{t("profile.confirmPass")}</Label>
                  <Input
                    id="confirmPass"
                    type="password"
                    required
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting || !newPass || !confirmPass}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  {t("forgot.reset")}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
