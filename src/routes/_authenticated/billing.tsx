import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listPlans,
  getCurrentSubscription,
} from "@/lib/subscription.functions";
import { createSnapToken, listPayments } from "@/lib/payment.functions";
import type { Plan, SubscriptionWithPlan } from "@/lib/subscription.functions";
import type { Payment } from "@/lib/payment.functions";
import { Check, Sparkles, CircleDollarSign, Zap, Loader2, Clock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
  head: () => ({
    meta: [
      { title: "Billing — GuardAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="h-6 w-6 text-blue-500" />,
  pro: <Sparkles className="h-6 w-6 text-amber-500" />,
  team: <CircleDollarSign className="h-6 w-6 text-purple-500" />,
};

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  pending: { label: "Pending", class: "bg-yellow-100 text-yellow-700" },
  paid: { label: "Paid", class: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", class: "bg-red-100 text-red-700" },
  expired: { label: "Expired", class: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Cancelled", class: "bg-gray-100 text-gray-500" },
};

function loadSnapScript(clientKey: string, isProduction: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).snap) return resolve();
    const script = document.createElement("script");
    const baseUrl = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.src = `${baseUrl}?data-key=${clientKey}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat Snap"));
    document.body.appendChild(script);
  });
}

function BillingPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => listPlans({ headers }),
  });

  const { data: sub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => getCurrentSubscription({ headers }),
  });

  const { data: payments } = useQuery({
    queryKey: ["my-payments"],
    queryFn: () => listPayments({ headers }),
  });

  const { data: pendingPayment } = useQuery({
    queryKey: ["pending-payment"],
    queryFn: async () => {
      const all = await listPayments({ headers });
      return (all as Payment[]).find((p) => p.status === "pending") || null;
    },
    refetchInterval: 15000, // auto-refresh setiap 15s
  });

  const upgradeMutation = useMutation({
    mutationFn: (plan: Plan) =>
      createSnapToken({
        data: {
          planId: plan.id,
          planName: plan.name,
          amount: plan.price_monthly_cents,
          billingCycle: "monthly",
        },
        headers,
      }),
    onSuccess: async (result) => {
      try {
        await loadSnapScript(result.client_key, true);
        (window as any).snap.pay(result.snap_token, {
          onSuccess: () => {
            toast.success("Pembayaran berhasil! Plan kamu sudah di-upgrade.");
            qc.invalidateQueries({ queryKey: ["my-subscription"] });
            qc.invalidateQueries({ queryKey: ["my-payments"] });
          },
          onPending: () => {
            toast("Pembayaran sedang diproses...");
            qc.invalidateQueries({ queryKey: ["pending-payment"] });
          },
          onError: () => {
            toast.error("Pembayaran gagal. Silakan coba lagi.");
          },
          onClose: () => {
            qc.invalidateQueries({ queryKey: ["my-payments"] });
          },
        });
      } catch (err: any) {
        toast.error(err.message || "Gagal memuat Midtrans Snap");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
    onSettled: () => setLoadingPlan(null),
  });

  const handleUpgrade = useCallback(
    (plan: Plan) => {
      setLoadingPlan(plan.name);
      upgradeMutation.mutate(plan);
    },
    [upgradeMutation]
  );

  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-20 sm:pb-0">
      <main className="space-y-6 px-4 pt-6">
        <h1 className="text-2xl font-bold">Billing & Plan</h1>

        {/* Current Plan */}
        {sub && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current Plan
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                {PLAN_ICONS[(sub as any).plan_name] || <Zap className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-lg font-semibold capitalize">
                  {(sub as any).plan_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(sub as any).reviews_used || 0} / {(sub as any).reviews_limit}{" "}
                  reviews used
                  {(sub as any).reviews_limit >= 999999 && " (Unlimited)"}
                </p>
              </div>
            </div>

            {(sub as any).reviews_limit < 999999 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (((sub as any).reviews_used || 0) /
                        (sub as any).reviews_limit) * 100
                    )}%`,
                  }}
                />
              </div>
            )}

            {/* Pending payment reminder */}
            {pendingPayment && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Pembayaran #{String((pendingPayment as any).order_id).slice(-8)} sedang diproses...
              </div>
            )}
          </div>
        )}

        {/* Plans */}
        <div className="grid gap-4">
          {plans?.map((plan: Plan) => {
            const isCurrent =
              (sub as any)?.plan_name === plan.name;
            const features: string[] = Array.isArray(plan.features)
              ? plan.features
              : [];
            const isFree = plan.price_monthly_cents === 0;
            const isLoading = loadingPlan === plan.name;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)] transition-all ${
                  isCurrent
                    ? "border-primary ring-1 ring-primary"
                    : plan.name === "pro"
                      ? "border-border hover:shadow-md"
                      : "border-border hover:shadow-md"
                }`}
              >
                {plan.name === "pro" && !isCurrent && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    RECOMMENDED
                  </span>
                )}

                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {PLAN_ICONS[plan.name]}
                      <h3 className="text-lg font-semibold capitalize">
                        {plan.name}
                      </h3>
                    </div>
                    <p className="mt-2 text-3xl font-bold">
                      Rp{plan.price_monthly_cents.toLocaleString("id-ID")}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        /bln
                      </span>
                    </p>
                  </div>

                  {isCurrent ? (
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary"
                    >
                      Active
                    </Badge>
                  ) : isFree ? (
                    <Badge variant="outline">Free</Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade(plan)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Loading
                        </>
                      ) : (
                        "Upgrade"
                      )}
                    </Button>
                  )}
                </div>

                <ul className="mt-4 space-y-2 text-sm">
                  {features.map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Payment History */}
        {payments && (payments as Payment[]).length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <h3 className="mb-3 text-sm font-semibold">Riwayat Pembayaran</h3>
            <div className="space-y-2">
              {(payments as Payment[]).slice(0, 10).map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {p.plan_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.order_id} &middot;{" "}
                      {new Date(p.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      Rp{p.amount.toLocaleString("id-ID")}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_BADGE[p.status]?.class || "bg-gray-100"
                      }`}
                    >
                      {STATUS_BADGE[p.status]?.label || p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        {(!payments || (payments as Payment[]).length === 0) && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] text-sm text-muted-foreground">
            <p>
              💳 Pembayaran diproses via <strong>Midtrans</strong> (QRIS / Virtual Account / e-Wallet / Kartu).
              Setelah upgrade, limit review kamu akan langsung terbuka dan kamu bisa menikmati fitur premium.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
