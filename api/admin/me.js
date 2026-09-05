import { getAdminCollection, getSessionFromRequest } from "../_lib/adminAuth.js";
import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`admin-me:${clientKeyFor(req)}`, 60)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(200).json({ authenticated: false });
  }

  try {
    const collection = await getAdminCollection();
    const doc = await collection.findOne({ singleton: "admin-singleton" }, { projection: { username: 1 } });
    if (!doc) {
      return res.status(200).json({ authenticated: false });
    }
    return res.status(200).json({ authenticated: true, username: doc.username });
  } catch (err) {
    console.error("Admin session check failed:", err);
    return res.status(200).json({ authenticated: false });
  }
}
