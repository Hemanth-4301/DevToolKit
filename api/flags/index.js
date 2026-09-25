import { getFeatureFlags, DEFAULT_FLAGS } from "../_lib/featureFlags.js";
import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";

// Public — every visitor's browser needs to know whether admin-gated
// features (chatbot, migration generator) have been opened up to
// everyone, so this intentionally has no requireAdmin() check. Read-only,
// and rate-limited generously since it's called once per page load.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`flags:${clientKeyFor(req)}`, 120)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  try {
    const flags = await getFeatureFlags();
    return res.status(200).json(flags);
  } catch (err) {
    console.error("Failed to load feature flags:", err);
    // Fail safe to defaults (admin-only) rather than surfacing an error
    // that could block the whole page from rendering over a flags outage.
    return res.status(200).json(DEFAULT_FLAGS);
  }
}
