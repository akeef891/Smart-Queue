// Simple in-memory fixed-window rate limiter, sufficient for a single
// Vercel/Node instance in v1. For multi-instance production deployments,
// swap this for Upstash Redis (@upstash/ratelimit) without changing the
// call sites below.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.max - 1 };
  }

  if (bucket.count >= opts.max) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: opts.max - bucket.count };
}
