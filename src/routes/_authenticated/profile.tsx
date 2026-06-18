import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { updateProfile, changePassword } from "@/lib/auth.functions";
import { getCurrentSubscription, listAllSubscriptions } from "@/lib/subscription.functions";
import { listPayments } from "@/lib/payment.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  User,
  Shield,
  KeyRound,
  CreditCard,
  Loader2,
  Check,
  X,
  Clock,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — GuardAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

const TABS = ["info", "password", "subscriptions"] as const;
type Tab = (typeof TABS)[number];

function ProfilePage() {
  const { t, lang } = useI18n();
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("info");

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("profile.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setTab("info")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "info"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <User className="h-4 w-4" />
            {t("profile.tabInfo")}
          </button>
          <button
            onClick={() => setTab("password")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "password"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            {t("profile.tabPassword")}
          </button>
          <button
            onClick={() => setTab("subscriptions")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "subscriptions"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            {t("profile.tabSubs")}
          </button>
        </div>

        {tab === "info" && <ProfileInfo user={user} t={t} token={token} qc={qc} />}
        {tab === "password" && <ChangePassword user={user} t={t} token={token} />}
        {tab === "subscriptions" && <SubscriptionHistory user={user} t={t} lang={lang} token={token} />}
      </div>
    </div>
  );
}

// ============= Profile Info Tab =============

function ProfileInfo({
  user,
  t,
  token,
  qc,
}: {
  user: any;
  t: any;
  token: string | null;
  qc: any;
}) {
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const updateFn = useServerFn(updateProfile);

  const mutation = useMutation({
    mutationFn: () =>
      updateFn({
        data: { displayName: displayName.trim() || user?.email?.split("@")[0] },
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      toast.success(t("profile.saved"));
      qc.invalidateQueries({ queryKey: ["gh-cfg"] });
      // Refresh user by reloading
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <h2 className="text-lg font-semibold">{t("profile.infoTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("profile.infoDesc")}</p>

      <div className="mt-6 space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt="avatar"
              className="h-16 w-16 rounded-full border border-border object-cover"
            />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {(user?.display_name || user?.email || "?")[0].toUpperCase()}
            </span>
          )}
          <div>
            <p className="font-medium">
              {user?.display_name || user?.email?.split("@")[0]}
            </p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {user?.github_login && (
              <p className="text-xs text-muted-foreground">
                GitHub: @{user.github_login}
              </p>
            )}
          </div>
        </div>

        {/* Edit Display Name */}
        <div className="space-y-1.5">
          <Label htmlFor="displayName">{t("profile.displayName")}</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={user?.email?.split("@")[0] || "Your name"}
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1.5">
          <Label>{t("profile.email")}</Label>
          <Input value={user?.email || ""} disabled className="bg-muted/50" />
          <p className="text-xs text-muted-foreground">{t("profile.emailNote")}</p>
        </div>

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !displayName.trim()}
          className="mt-2"
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          {t("profile.save")}
        </Button>
      </div>
    </div>
  );
}

// ============= Change Password Tab =============

function ChangePassword({
  user,
  t,
  token,
}: {
  user: any;
  t: any;
  token: string | null;
}) {
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const changeFn = useServerFn(changePassword);

  const hasPassword = user?.email && !user?.github_login;

  const mutation = useMutation({
    mutationFn: () =>
      changeFn({
        data: { currentPassword: current, newPassword: newPass },
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      toast.success(t("profile.passwordChanged"));
      setCurrent("");
      setNewPass("");
      setConfirm("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPass !== confirm) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }
    if (newPass.length < 8) {
      toast.error(t("profile.passwordShort"));
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <h2 className="text-lg font-semibold">{t("profile.passwordTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("profile.passwordDesc")}</p>

      {user?.github_login && !user?.email && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
          {t("profile.githubAccount")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {hasPassword && (
          <div className="space-y-1.5">
            <Label htmlFor="currentPass">{t("profile.currentPass")}</Label>
            <Input
              id="currentPass"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="newPass">{t("profile.newPass")}</Label>
          <Input
            id="newPass"
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPass">{t("profile.confirmPass")}</Label>
          <Input
            id="confirmPass"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <Button
          type="submit"
          disabled={mutation.isPending || !newPass || !confirm}
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-2 h-4 w-4" />
          )}
          {t("profile.changePass")}
        </Button>
      </form>
    </div>
  );
}

// ============= Subscription History Tab =============

const MONTHS: Record<string, string> = {
  "1": "Jan", "2": "Feb", "3": "Mar", "4": "Apr", "5": "May", "6": "Jun",
  "7": "Jul", "8": "Aug", "9": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function fmtDate(d: string | null, lang: string): string {
  if (!d) return "-";
  const date = new Date(d);
  const m = MONTHS[String(date.getMonth() + 1)] || "???";
  return `${date.getDate()} ${m} ${date.getFullYear()}`;
}

function SubscriptionHistory({
  user,
  t,
  lang,
  token,
}: {
  user: any;
  t: any;
  lang: string;
  token: string | null;
}) {
  const headers = { Authorization: `Bearer ${token}` };

  const { data: currentSub } = useQuery({
    queryKey: ["current-sub"],
    queryFn: () => getCurrentSubscription({ headers }),
  });

  const { data: allSubs, isLoading: subsLoading } = useQuery({
    queryKey: ["all-subs"],
    queryFn: () => listAllSubscriptions({ headers }),
  });

  const { data: payments, isLoading: payLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => listPayments({ headers }),
  });

  const fmtPrice = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      {currentSub && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <h2 className="text-lg font-semibold">{t("profile.currentPlan")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-primary/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("profile.plan")}
              </p>
              <p className="mt-1 text-xl font-bold capitalize">{currentSub.plan_name}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("profile.status")}
              </p>
              <span
                className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  currentSub.status === "active"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {currentSub.status === "active" ? "Active" : currentSub.status}
              </span>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("profile.reviewsUsed")}
              </p>
              <p className="mt-1 text-xl font-bold">
                {currentSub.reviews_used} / {currentSub.reviews_limit}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("profile.period")}
              </p>
              <p className="mt-1 text-sm">
                {fmtDate(currentSub.period_start, lang)}
                {" — "}
                {currentSub.period_end
                  ? fmtDate(currentSub.period_end, lang)
                  : t("profile.forever")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subscription History */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-lg font-semibold">{t("profile.subsHistory")}</h2>

        {subsLoading ? (
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />
        ) : !allSubs || allSubs.length === 0 ? (
          <p className="mt-4 rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
            {t("profile.noSubs")}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {allSubs.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm"
              >
                <div>
                  <p className="font-medium capitalize">{s.plan_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(s.created_at, lang)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    s.status === "active"
                      ? "bg-emerald-100 text-emerald-800"
                      : s.status === "expired"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-lg font-semibold">{t("profile.payHistory")}</h2>

        {payLoading ? (
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />
        ) : !payments || payments.length === 0 ? (
          <p className="mt-4 rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
            {t("profile.noPayments")}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {payments.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{p.plan_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(p.created_at, lang)} · {p.billing_cycle}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{fmtPrice(p.amount)}</p>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      p.status === "success"
                        ? "bg-emerald-100 text-emerald-800"
                        : p.status === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
