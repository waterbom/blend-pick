import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };
const globalStore = globalThis as typeof globalThis & { __blendpickRateLimits?: Map<string, Bucket> };
const buckets = globalStore.__blendpickRateLimits ??= new Map<string, Bucket>();

function clientKey(req: Request) {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || "unknown";
}

export function consumeRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
  subject = ""
) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
  }
  const key = `${scope}:${clientKey(req)}:${subject.slice(0, 160)}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  if (bucket.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return { allowed: true, retryAfter: 0 };
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } }
  );
}
