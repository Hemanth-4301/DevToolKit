import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getClientPromise } from "./mongodb.js";

const DB_NAME = process.env.MONGODB_DB || "devtoolkit";
const COLLECTION_NAME = "adminUsers";
const SINGLETON_KEY = "admin-singleton";

const SEED_USERNAME = "admin";
const SEED_PASSWORD = "hem4301";
const BCRYPT_COST = 12;

const SESSION_COOKIE_NAME = "devtoolkit_admin_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

let indexesEnsured = false;

export async function getAdminCollection() {
  const client = await getClientPromise();
  const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

  if (!indexesEnsured) {
    indexesEnsured = true;
    await collection.createIndex({ singleton: 1 }, { unique: true }).catch(() => {
      // Best-effort, same reasoning as api/_lib/mongodb.js's index setup.
    });
  }

  await ensureAdminSeeded(collection);
  return collection;
}

// Seeds the one-and-only admin account on first use. Race-safe: the unique
// index on `singleton` means concurrent cold starts racing this upsert can
// only ever result in one inserted document — the loser's upsert becomes a
// no-op $setOnInsert against the winner's already-inserted doc.
async function ensureAdminSeeded(collection) {
  const existing = await collection.findOne({ singleton: SINGLETON_KEY }, { projection: { _id: 1 } });
  if (existing) return;

  const now = new Date();
  const passwordHash = bcrypt.hashSync(SEED_PASSWORD, BCRYPT_COST);
  await collection.updateOne(
    { singleton: SINGLETON_KEY },
    {
      $setOnInsert: {
        singleton: SINGLETON_KEY,
        username: SEED_USERNAME,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET environment variable is not set");
  }
  return secret;
}

function sign(payloadB64) {
  return crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

export function signSession(payload) {
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

// Verifies signature and expiry; returns the parsed payload or null.
export function verifySessionToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload?.iat !== "number") return null;
  if (Date.now() / 1000 - payload.iat > SESSION_MAX_AGE_SECONDS) return null;

  return payload;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return [part.trim(), ""];
      return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim())];
    }),
  );
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}

// `Secure` is omitted outside production because browsers silently drop
// Secure cookies set over plain http:// — which is how `vercel dev` serves
// localhost during local testing. Vercel's own deployments (including
// previews) are always HTTPS, and Vercel sets NODE_ENV=production for them.
function secureFlag() {
  return process.env.NODE_ENV === "production" ? "Secure; " : "";
}

export function buildSessionCookie(token) {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; ${secureFlag()}SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function buildClearCookie() {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; ${secureFlag()}SameSite=Lax; Path=/; Max-Age=0`;
}

// Guard for protected routes: returns the verified session, or writes a
// 401 response and returns null so callers can `if (!session) return;`.
export function requireAdmin(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized." });
    return null;
  }
  return session;
}

export { SEED_USERNAME };
