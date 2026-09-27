import crypto from "crypto";
import { requireAdminOrFlag } from "../_lib/featureFlags.js";

const KEY_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSecret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  // Derive a 32-byte key from the secret for wrapping
  return crypto.createHash("sha256").update(s).digest();
}

// Issue a signed token that wraps the AES key.
// Token format (all hex, dot-separated): expiresAt . keyHex . hmac
// The HMAC covers expiresAt + keyHex so tampering is detected.
export function issueKeyToken() {
  const aesKey = crypto.randomBytes(32);
  const expiresAt = Date.now() + KEY_TTL_MS;
  const payload = `${expiresAt}.${aesKey.toString("hex")}`;
  const hmac = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  const token = `${payload}.${hmac}`;
  return { token, keyHex: aesKey.toString("hex") };
}

// Verify + extract the AES key from a token. Returns the key Buffer or null.
// Does NOT enforce single-use — replay protection is the browser's job
// (it fetches a fresh key per request). The short TTL limits the window.
export function extractKey(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [expiresAtStr, keyHex, hmac] = parts;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const payload = `${expiresAtStr}.${keyHex}`;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  const a = Buffer.from(hmac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  if (!/^[0-9a-f]{64}$/.test(keyHex)) return null;
  return Buffer.from(keyHex, "hex");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await requireAdminOrFlag(req, res, "migrationGenerator");
  if (!session) return;

  const { token, keyHex } = issueKeyToken();
  // Send the token (opaque to the browser) and the raw key so the browser
  // can encrypt with it. The token is just returned server-side on decrypt.
  return res.status(200).json({ token, keyHex });
}
