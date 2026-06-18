/**
 * Simple in-memory rate limiter.
 * Tracks requests by userId + action per time window.
 * Falls back gracefully if limit not configured.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  reviewCode: { maxRequests: 10, windowMs: 60_000 * 60 }, // 10/jam gratis
  reviewCodePro: { maxRequests: 100, windowMs: 60_000 * 60 }, // 100/jam pro
};

function getKey(userId: string, action: string): string {
  return `${userId}:${action}`;
}

export function checkRateLimit(
  userId: string,
  action: string,
  config?: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const cfg = config || DEFAULTS[action] || DEFAULTS.reviewCode;
  const key = getKey(userId, action);
  const now = Date.now();

  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + cfg.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;
  const remaining = Math.max(0, cfg.maxRequests - bucket.count);

  return {
    allowed: bucket.count <= cfg.maxRequests,
    remaining,
    resetAt: bucket.resetAt,
  };
}

/** Periodic cleanup every 10 minutes */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 600_000);

/** Clean up on process exit */
process.on("SIGTERM", () => buckets.clear());
process.on("SIGINT", () => buckets.clear());
