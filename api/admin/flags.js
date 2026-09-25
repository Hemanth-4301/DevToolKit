import { getFeatureFlags, setFeatureFlags } from "../_lib/featureFlags.js";
import { requireAdmin } from "../_lib/adminAuth.js";
import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`admin-flags:${clientKeyFor(req)}`, 30)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  try {
    if (req.method === "GET") {
      return res.status(200).json(await getFeatureFlags());
    }

    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Invalid request body." });
    }
    const flags = await setFeatureFlags(body);
    return res.status(200).json(flags);
  } catch (err) {
    console.error("Admin feature flags update failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
