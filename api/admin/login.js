import bcrypt from "bcryptjs";
import { getAdminCollection, signSession, buildSessionCookie } from "../_lib/adminAuth.js";
import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";

// A bcrypt hash of an arbitrary, never-used password — compared against
// on a username miss so an unknown username still pays the same bcrypt
// cost as a real one, instead of returning instantly and leaking via
// timing which case occurred.
const DUMMY_HASH = "$2b$12$eRs8JW6MejxJY7n/joAx7eWvbWez6wLHrCSYOE1DcW0f8BKsHnTze";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`admin-login:${clientKeyFor(req)}`, 10)) {
    return res.status(429).json({ error: "Too many attempts — please slow down." });
  }

  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Invalid request body." });
  }

  try {
    const collection = await getAdminCollection();
    const doc = await collection.findOne({ singleton: "admin-singleton" });

    const usernameMatches = !!doc && doc.username.toLowerCase() === username.trim().toLowerCase();
    const passwordMatches = await bcrypt.compare(password, usernameMatches ? doc.passwordHash : DUMMY_HASH);

    if (!usernameMatches || !passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = signSession({ sub: "admin", iat: Math.floor(Date.now() / 1000) });
    res.setHeader("Set-Cookie", buildSessionCookie(token));
    return res.status(200).json({ username: doc.username });
  } catch (err) {
    console.error("Admin login failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
