import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth.functions";
import { query, queryOne } from "./db";

export type Plan = {
  id: string;
  name: string;
  price_monthly_cents: number;
  reviews_limit: number;
  features: string[];
  is_active: boolean;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  reviews_used: number;
  period_start: string;
  period_end: string | null;
  created_at: string;
};

export type SubscriptionWithPlan = Subscription & {
  plan_name: string;
  reviews_limit: number;
};

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { rows } = await query<Plan>(
    "SELECT id, name, price_monthly_cents, reviews_limit, features, is_active FROM plans WHERE is_active = true ORDER BY price_monthly_cents"
  );
  return rows;
});

export const getCurrentSubscription = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: any) => {
    const sub = await queryOne<SubscriptionWithPlan>(
      `SELECT s.*, p.name AS plan_name, p.reviews_limit
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [context.userId]
    );

    if (sub) return sub;

    // Default: free plan
    const freePlan = await queryOne<Plan>(
      "SELECT id, name, price_monthly_cents, reviews_limit, features FROM plans WHERE name = 'free'"
    );
    if (!freePlan) return null;

    // Auto-create subscription
    const { rows } = await query<SubscriptionWithPlan>(
      `INSERT INTO subscriptions (user_id, plan_id, status)
       VALUES ($1, $2, 'active')
       RETURNING *`,
      [context.userId, freePlan.id]
    );
    return {
      ...rows[0],
      plan_name: freePlan.name,
      reviews_limit: freePlan.reviews_limit,
    };
  });

export const canReview = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: any) => {
    const sub = await queryOne<SubscriptionWithPlan>(
      `SELECT s.*, p.name AS plan_name, p.reviews_limit
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [context.userId]
    );

    if (!sub) {
      // Auto-provision free plan
      const freePlan = await queryOne<Plan>(
        "SELECT id, name, price_monthly_cents, reviews_limit, features FROM plans WHERE name = 'free'"
      );
      if (!freePlan) return { allowed: false, reason: "No plans configured" };

      const { rows } = await query<SubscriptionWithPlan>(
        `INSERT INTO subscriptions (user_id, plan_id, status)
         VALUES ($1, $2, 'active')
         RETURNING *`,
        [context.userId, freePlan.id]
      );
      return { allowed: true, used: 0, limit: freePlan.reviews_limit };
    }

    const limit = (sub as any).reviews_limit;
    const used = (sub as any).reviews_used || 0;

    if (used >= limit && limit < 999999) {
      return { allowed: false, reason: "limit_reached", used, limit };
    }

    return { allowed: true, used, limit };
  });

export const incrementReviewsUsed = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }: any) => {
    await query(
      `UPDATE subscriptions
       SET reviews_used = reviews_used + 1, updated_at = now()
       WHERE user_id = $1 AND status = 'active'`,
      [context.userId]
    );
    return { ok: true };
  });
