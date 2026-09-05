import { getSharesCollection } from "../../_lib/mongodb.js";
import { requireAdmin } from "../../_lib/adminAuth.js";
import { isRateLimited, clientKeyFor } from "../../_lib/rateLimit.js";

// Matches api/share/[id].js's SHARE_ID_RE / api/_lib/validate.js's SLUG_RE.
const SHARE_ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`admin-shares-delete:${clientKeyFor(req)}`, 30)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  const { id } = req.query;
  if (typeof id !== "string" || !SHARE_ID_RE.test(id)) {
    return res.status(400).json({ error: "Invalid link." });
  }

  try {
    const collection = await getSharesCollection();
    const result = await collection.deleteOne({ shareId: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "This snippet was not found." });
    }
    return res.status(204).end();
  } catch (err) {
    console.error("Admin delete share failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
