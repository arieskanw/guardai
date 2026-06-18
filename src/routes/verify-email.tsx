import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { verifyOtp, resendOtp } from "@/lib/auth.functions";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Loader2, Shield, ArrowRight, RefreshCw, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/verify-email")({
  head: () => ({
    meta: [
      { title: "Verify Email — GuardAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { t } = useI18n();
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const verifyFn = useServerFn(verifyOtp);
  const resendFn = useServerFn(resendOtp);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", replace: true });
    }
    if (user?.email_verified) {
      setVerified(true);
    }
  }, [user, loading, navigate]);

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyFn({
        data: { otp: otp.join("") },
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: (r) => {
      if (r.alreadyVerified) {
        setVerified(true);
        toast.success(t("verify.alreadyVerified"));
      } else {
        setVerified(true);
        toast.success(t("verify.success"));
      }
      // Reload to get fresh user data
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const resendMutation = useMutation({
    mutationFn: () =>
      resendFn({ headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: (r) => {
      if (r.alreadyVerified) {
        setVerified(true);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.success(t("verify.resendSuccess"));
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(0, 1);
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    const code = newOtp.join("");
    if (code.length === 6 && !verifyMutation.isPending) {
      verifyMutation.mutate();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = pasted.split("");
    while (newOtp.length < 6) newOtp.push("");
    setOtp(newOtp);
    // Focus next empty or last
    const nextEmpty = newOtp.findIndex((d) => !d);
    const focusIdx = nextEmpty >= 0 ? nextEmpty : 5;
    inputRefs.current[focusIdx]?.focus();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
        <div className="max-w-md text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">{t("verify.verifiedTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("verify.verifiedDesc")}</p>
          <Button className="mt-6" onClick={() => navigate({ to: "/dashboard", replace: true })}>
            <ArrowRight className="mr-2 h-4 w-4" />
            {t("verify.goDashboard")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-bold">{t("verify.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("verify.subtitle")}{" "}
              <strong className="text-foreground">{user?.email}</strong>
            </p>
          </div>

          <div className="mt-8">
            <Label className="text-center text-xs text-muted-foreground">
              {t("verify.enterCode")}
            </Label>
            <div className="mt-2 flex justify-center gap-2">
              {otp.map((digit, i) => (
                <Input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  className="h-12 w-12 text-center text-lg font-bold"
                  maxLength={1}
                  autoFocus={i === 0}
                  disabled={verifyMutation.isPending}
                />
              ))}
            </div>
          </div>

          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={() => verifyMutation.mutate()}
            disabled={otp.join("").length !== 6 || verifyMutation.isPending}
          >
            {verifyMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shield className="mr-2 h-4 w-4" />
            )}
            {t("verify.verify")}
          </Button>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">{t("verify.noCode")}</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              className="text-xs"
            >
              {resendMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              {t("verify.resend")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
