/** In-process sliding window rate limiter (per Convex isolate). */
const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t >= windowStart);
  if (hits.length >= maxHits) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
