import { buildClearCookie } from "../_lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  res.setHeader("Set-Cookie", buildClearCookie());
  return res.status(204).end();
}
