import bcrypt from "bcryptjs";
import { getAdminCollection, requireAdmin } from "../_lib/adminAuth.js";
import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";

const MIN_PASSWORD_LENGTH = 8;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,32}$/;

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`admin-password:${clientKeyFor(req)}`, 10)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  const { currentPassword, newPassword, newUsername } = req.body || {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Invalid request body." });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  if (newUsername !== undefined && (typeof newUsername !== "string" || !USERNAME_RE.test(newUsername.trim()))) {
    return res.status(400).json({ error: "Username must be 2-32 characters (letters, numbers, _ . -)." });
  }

  try {
    const collection = await getAdminCollection();
    const doc = await collection.findOne({ singleton: "admin-singleton" });
    if (!doc) {
      return res.status(500).json({ error: "Admin account not found." });
    }

    const currentMatches = await bcrypt.compare(currentPassword, doc.passwordHash);
    if (!currentMatches) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 12);
    const update = { passwordHash, updatedAt: new Date() };
    if (newUsername) update.username = newUsername.trim();

    await collection.updateOne({ singleton: "admin-singleton" }, { $set: update });

    return res.status(200).json({ username: update.username || doc.username });
  } catch (err) {
    console.error("Admin password change failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
