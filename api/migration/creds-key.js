import crypto from "crypto";
import { requireAdminOrFlag } from "../_lib/featureFlags.js";

// In-process store: keyId → { key (32-byte Buffer), expiresAt }
// Keys are single-use and expire after 10 minutes.
const keyStore = new Map();
const KEY_TTL_MS = 10 * 60 * 1000;

function purgeExpired() {
  const now = Date.now();
  for (const [id, entry] of keyStore) {
    if (entry.expiresAt < now) keyStore.delete(id);
  }
}

export function issueKey() {
  purgeExpired();
  const keyId = crypto.randomBytes(16).toString("hex");
  const key = crypto.randomBytes(32);
  keyStore.set(keyId, { key, expiresAt: Date.now() + KEY_TTL_MS });
  return { keyId, keyHex: key.toString("hex") };
}

// Returns the key buffer and deletes it (single-use).
export function consumeKey(keyId) {
  purgeExpired();
  const entry = keyStore.get(keyId);
  if (!entry || entry.expiresAt < Date.now()) return null;
  keyStore.delete(keyId);
  return entry.key;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await requireAdminOrFlag(req, res, "migrationGenerator");
  if (!session) return;

  const { keyId, keyHex } = issueKey();
  return res.status(200).json({ keyId, keyHex });
}
