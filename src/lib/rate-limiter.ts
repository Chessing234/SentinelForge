type Bucket = { hits: number[] };

const store = new Map<string, Bucket>();

function prune(bucket: Bucket, windowMs: number, now: number): void {
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
}

function hit(key: string, max: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    store.set(key, bucket);
  }
  prune(bucket, windowMs, now);
  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);
    return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  bucket.hits.push(now);
  return { ok: true };
}

export type RateLimitRule = { max: number; windowMs: number };

export const RateLimitPresets = {
  auth: { max: 5, windowMs: 60_000 },
  api: { max: 60, windowMs: 60_000 },
  command: { max: 10, windowMs: 5_000 },
  mentorChat: { max: 30, windowMs: 3_600_000 },
} as const;

export function rateLimitKey(ip: string, bucket: string): string {
  return `${bucket}:${ip}`;
}

export function checkRateLimit(
  ip: string,
  preset: keyof typeof RateLimitPresets | RateLimitRule,
  bucketSuffix: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const rule = typeof preset === "string" ? RateLimitPresets[preset] : preset;
  const key = rateLimitKey(ip, `${typeof preset === "string" ? preset : "custom"}:${bucketSuffix}`);
  return hit(key, rule.max, rule.windowMs);
}

export type RateLimiterAdapter = typeof checkRateLimit;
