import { getFeatureFlagsCollection } from "./mongodb.js";
import { getSessionFromRequest } from "./adminAuth.js";

const SINGLETON_KEY = "flags-singleton";

// Every flag defaults to off — matches today's behavior (admin-only)
// until an admin explicitly opts a feature into public visibility.
export const DEFAULT_FLAGS = {
  chatbot: false,
  migrationGenerator: false,
};

const KNOWN_KEYS = new Set(Object.keys(DEFAULT_FLAGS));

// Reads the current flags, falling back to defaults for anything not yet
// set (covers both "no document exists yet" and "a new flag was added
// after older documents were written").
export async function getFeatureFlags() {
  const collection = await getFeatureFlagsCollection();
  const doc = await collection.findOne({ singleton: SINGLETON_KEY });
  return { ...DEFAULT_FLAGS, ...(doc || {}) };
}

// Merges `updates` (only recognized boolean keys) into the stored flags
// and returns the resulting full set.
export async function setFeatureFlags(updates) {
  const collection = await getFeatureFlagsCollection();
  const set = {};
  for (const key of Object.keys(updates || {})) {
    if (KNOWN_KEYS.has(key) && typeof updates[key] === "boolean") {
      set[key] = updates[key];
    }
  }
  if (Object.keys(set).length === 0) {
    return getFeatureFlags();
  }
  await collection.updateOne(
    { singleton: SINGLETON_KEY },
    { $set: set, $setOnInsert: { singleton: SINGLETON_KEY } },
    { upsert: true },
  );
  return getFeatureFlags();
}

// Guard for routes that should be reachable either by a logged-in admin
// (always, regardless of flags — matches today's behavior) or by anyone
// once the admin has flipped the named flag on. Writes a 401 and returns
// null when neither condition holds, same calling convention as
// requireAdmin() in adminAuth.js.
export async function requireAdminOrFlag(req, res, flagKey) {
  const session = getSessionFromRequest(req);
  if (session) return session;

  const flags = await getFeatureFlags();
  if (flags[flagKey]) return { public: true };

  res.status(401).json({ error: "Unauthorized." });
  return null;
}
