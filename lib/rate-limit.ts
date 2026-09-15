import { NextRequest, NextResponse } from "next/server";

/**
 * Fixed-window rate limiter kept in process memory.
 *
 * LIMITATION: the counters live in the Node process, so each serverless
 * instance / container counts separately. That is fine for a single long-lived
 * server and it blunts credential stuffing and scripted abuse, but it is NOT a
 * distributed limiter. If this is deployed to more than one instance (Vercel,
 * multiple pods), move the bucket store to Redis/Upstash — the call sites do
 * not have to change, only `hit()` below.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Stop the map growing without bound on a long-running server.
const MAX_TRACKED_KEYS = 20_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitRule {
  /** Requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSecs: number;
}

function hit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + rule.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: rule.limit - 1,
      resetAt,
      retryAfterSecs: Math.ceil(rule.windowMs / 1000),
    };
  }

  existing.count += 1;

  return {
    ok: existing.count <= rule.limit,
    remaining: Math.max(0, rule.limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSecs: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Best-effort client IP.
 *
 * `x-forwarded-for` is trivially spoofable unless a trusted proxy sets it, so
 * this is a throttle, not an identity. Wherever a user is logged in, prefer
 * rate limiting on their user id instead (see `rateLimit` callers).
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Consume one token for `scope` + `identifier`.
 * Returns null when the request may proceed, or a 429 response when it may not.
 */
export function rateLimit(
  scope: string,
  identifier: string,
  rule: RateLimitRule
): NextResponse | null {
  const result = hit(`${scope}:${identifier}`, rule);
  if (result.ok) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSecs),
        "X-RateLimit-Limit": String(rule.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}

/**
 * Same counter, but for call sites that are not NextRequest/NextResponse based
 * (the NextAuth `authorize` callback). Returns true when allowed.
 */
export function consume(scope: string, identifier: string, rule: RateLimitRule): boolean {
  return hit(`${scope}:${identifier}`, rule).ok;
}

/** Shared rules, so the numbers live in one place. */
export const RULES = {
  login: { limit: 8, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  booking: { limit: 20, windowMs: 60_000 },
  payment: { limit: 15, windowMs: 60_000 },
  ipn: { limit: 60, windowMs: 60_000 },
  write: { limit: 30, windowMs: 60_000 },
  read: { limit: 120, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;
