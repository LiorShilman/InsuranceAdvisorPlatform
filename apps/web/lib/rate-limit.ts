/**
 * A minimal in-memory sliding-window rate limiter, keyed by client IP, for
 * the auth endpoints. Deliberately not Redis-backed: this app runs as a
 * single PM2 fork instance (see ecosystem.config.cjs — instances: 1), so an
 * in-process Map is sufficient and adds no new infrastructure dependency.
 * It resets on every process restart — acceptable here because the real
 * defense against credential-stuffing is the per-account lockout in
 * lib/auth.ts; this is a second, coarser layer against a single IP hammering
 * many different emails.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the Map doesn't grow unbounded over a long uptime.
function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Returns true if `key` (e.g. `"login:<ip>"`) is still within its limit —
 * and counts this call toward it. `windowMs`/`max` define the window.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

/** Best-effort client IP from standard proxy headers, falling back to a shared bucket if none is present (e.g. local dev). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
