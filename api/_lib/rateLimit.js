// Best-effort in-memory rate limiter — resets on cold start and isn't
// shared across concurrent warm instances, so it's not a hard guarantee,
// but it's enough to stop a single misbehaving client (buggy loop,
// runaway retry) from hammering the API within one instance's lifetime.
const buckets = new Map();
const WINDOW_MS = 10_000;

// Bound memory — an instance that's seen many distinct IPs shouldn't
// accumulate buckets forever.
const MAX_TRACKED_KEYS = 5000;

// `limit` differs by route: writes are rare and deliberate (a save), so a
// tight cap catches runaway loops; reads legitimately happen often
// (client-side polling for live sync), so they get a much higher ceiling.
export function isRateLimited(key, limit = 20) {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  return bucket.count > limit;
}

export function clientKeyFor(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (ip || req.socket?.remoteAddress || "unknown").trim();
}
