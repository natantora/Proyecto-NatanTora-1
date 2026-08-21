import type { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };

// In-memory: resets on deploy/restart and is per-instance only (no shared store
// like Redis exists in this project). Good enough for a single Railway replica;
// revisit with a shared store if the app ever runs with multiple instances.
const buckets = new Map<string, Bucket>();

function cleanup(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  cleanup(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
