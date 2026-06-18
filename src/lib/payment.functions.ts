import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "./auth.functions";
import { query, queryOne } from "./db";

// === Types ===
export type Payment = {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name: string;
  order_id: string;
  snap_token: string | null;
  amount: number;
  status: string; // pending | paid | failed | expired | cancelled
  billing_cycle: string;
  paid_at: string | null;
  created_at: string;
};

// === Server-only helpers ===
function getMidtransConfig() {
  return {
    serverKey: process.env.MIDTRANS_SERVER_KEY || "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  };
}

// ============ Real-time USD → IDR Exchange Rate ============
const RATE_CACHE: { rate: number; fetchedAt: number } = { rate: 16500, fetchedAt: 0 };
const CACHE_TTL_MS = 30 * 60 * 1000; // cache 30 menit

export async function getUsdToIdrRate(): Promise<number> {
  const now = Date.now();
  if (RATE_CACHE.fetchedAt > 0 && (now - RATE_CACHE.fetchedAt) < CACHE_TTL_MS) {
    return RATE_CACHE.rate;
  }

  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    const rate = data.rates?.IDR || 16500;
    RATE_CACHE.rate = rate;
    RATE_CACHE.fetchedAt = now;
    console.log("[payment] USD rate:", rate);
    return rate;
  } catch (err) {
    console.warn("[payment] rate fetch failed, using fallback:", err);
    return RATE_CACHE.rate || 16500; // fallback ~Rp16.500
  }
}

// ============ Create Snap Token ============
const initPaymentSchema = z.object({
  planId: z.string().uuid(),
  planName: z.string().min(1).max(40),
  amount: z.number().int().positive(),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

export const createSnapToken = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => initPaymentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { serverKey, clientKey, isProduction } = getMidtransConfig();
    if (!serverKey || !clientKey) {
      throw new Error("Midtrans belum dikonfigurasi.");
    }

    // Dynamic import — midtrans-client is Node-only
    const { Snap } = await import("midtrans-client");

    const snap = new Snap({
      isProduction,
      serverKey,
      clientKey,
    });

    // Convert USD → IDR (real-time exchange rate)
    const rate = await getUsdToIdrRate();
    const amountIdr = Math.round((data.amount / 100) * rate); // data.amount = USD cents
    if (amountIdr < 100) {
      throw new Error("Jumlah pembayaran terlalu kecil.");
    }

    console.log(
      `[payment] ${data.planName}: $${(data.amount / 100).toFixed(2)} → Rp${amountIdr.toLocaleString("id-ID")} (rate: ${rate})`
    );

    // Generate order ID: GUARD-{timestamp}-{shortUserId}
    const ts = Date.now().toString(36).toUpperCase();
    const uid = context.userId.replace(/-/g, "").slice(0, 6).toUpperCase();
    const orderId = `GUARD-${ts}${uid}`;

    const cycleLabel = data.billingCycle === "yearly" ? "12 bulan" : "1 bulan";

    const payload: Record<string, any> = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amountIdr, // Dalam IDR untuk Midtrans
      },
      item_details: [
        {
          id: `plan-${data.planId}`,
          name: `GuardAI ${data.planName} — ${cycleLabel}`,
          price: amountIdr,
          quantity: 1,
        },
      ],
      customer_details: {
        // We'll fill from user profile if available
        email: context.user.email || "",
      },
      callbacks: {
        finish: `${process.env.PUBLIC_URL || "https://guardai.codezy.id"}/billing`,
      },
      expiry: {
        unit: "hours",
        duration: 24,
      },
    };

    let snapToken: string;
    try {
      const response = await snap.createTransaction(payload);
      snapToken = response.token;
    } catch (err: any) {
      console.error("[payment] Midtrans snap failed:", err.message);
      throw new Error("Gagal membuat pembayaran. Silakan coba lagi.");
    }

    // Save payment record
    const { rows } = await query<Payment>(
      `INSERT INTO payments (user_id, plan_id, plan_name, order_id, snap_token, amount, billing_cycle, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        context.userId,
        data.planId,
        data.planName,
        orderId,
        snapToken,
        data.amount,
        data.billingCycle,
      ]
    );

    return {
      snap_token: snapToken,
      order_id: orderId,
      client_key: clientKey,
      payment: rows[0],
    };
  });

// ============ Midtrans Callback Handler ============
const callbackSchema = z.object({
  order_id: z.string().optional(),
  transaction_status: z.string().optional(),
  fraud_status: z.string().optional(),
  signature_key: z.string().optional(),
  status_code: z.string().optional(),
  gross_amount: z.string().optional(),
  payment_type: z.string().optional(),
  transaction_time: z.string().optional(),
});

export const handleMidtransCallback = createServerFn({ method: "POST" })
  .validator((d: unknown) => callbackSchema.parse(d))
  .handler(async ({ data }) => {
    const { serverKey } = getMidtransConfig();
    const orderId = data.order_id || "";
    const status = data.transaction_status || "";
    const fraud = data.fraud_status || "";
    const sig = data.signature_key || "";
    const statusCd = data.status_code || "";
    const gross = data.gross_amount || "";

    // Verify signature (SHA512)
    const expectedSig = crypto
      .createHash("sha512")
      .update(orderId + statusCd + gross + serverKey)
      .digest("hex");

    if (expectedSig !== sig) {
      console.warn("[payment] bad signature for", orderId);
      return { status: "invalid_signature" };
    }

    // Find payment
    const payment = await queryOne<Payment>(
      "SELECT * FROM payments WHERE order_id = $1",
      [orderId]
    );
    if (!payment) {
      console.warn("[payment] unknown order", orderId);
      return { status: "unknown_order" };
    }

    // Skip if already processed
    if (payment.status === "paid") {
      return { status: "already_paid" };
    }

    // Update payment with Midtrans data
    await query(
      `UPDATE payments SET midtrans_status = $1, payment_type = $2, raw_callback = $3::jsonb, updated_at = now()
       WHERE id = $4`,
      [status, data.payment_type || null, JSON.stringify(data), payment.id]
    );

    // Settlement / capture → mark as paid
    if (
      ["capture", "settlement"].includes(status) &&
      fraud !== "deny"
    ) {
      await query(
        `UPDATE payments SET status = 'paid', paid_at = now(), updated_at = now()
         WHERE id = $1`,
        [payment.id]
      );

      // Upgrade user subscription
      await upgradeUserToPlan(payment.user_id, payment.plan_id, payment.billing_cycle);

      console.log("[payment] upgraded user", payment.user_id, "to plan", payment.plan_name);
      return { status: "paid" };
    }

    // Failed / expired / cancelled
    if (["cancel", "deny", "expire"].includes(status)) {
      const newStatus = status === "expire" ? "expired" : status === "cancel" ? "cancelled" : "failed";
      await query(
        `UPDATE payments SET status = $1, updated_at = now() WHERE id = $2`,
        [newStatus, payment.id]
      );
    }

    return { status };
  });

// ============ Helper: Upgrade user subscription ============
async function upgradeUserToPlan(userId: string, planId: string, billingCycle: string) {
  // Check if user has active subscription
  const existing = await queryOne(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );

  // Calculate new expiry
  const now = new Date();
  const expiresAt = billingCycle === "yearly"
    ? new Date(now.setFullYear(now.getFullYear() + 1))
    : new Date(now.setMonth(now.getMonth() + 1));

  if (existing) {
    await query(
      `UPDATE subscriptions SET plan_id = $1, period_end = $2, updated_at = now()
       WHERE user_id = $3 AND status = 'active'`,
      [planId, expiresAt.toISOString(), userId]
    );
  } else {
    await query(
      `INSERT INTO subscriptions (user_id, plan_id, status, period_start, period_end)
       VALUES ($1, $2, 'active', now(), $3)`,
      [userId, planId, expiresAt.toISOString()]
    );
  }

  // Reset review counter
  await query(
    `UPDATE subscriptions SET reviews_used = 0 WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );
}

// ============ List user payments ============
export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { rows } = await query(
      `SELECT id, order_id, plan_name, amount, status, billing_cycle, paid_at, created_at
       FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [context.userId]
    );
    return rows;
  });
