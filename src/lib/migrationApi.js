const API_BASE = "/api/migration";

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, { credentials: "same-origin", ...options });
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new Error(body?.error || `Request failed (${res.status}).`);
  }

  return parseJsonSafe(res);
}

// Fetch a one-time AES-256-GCM key from the server.
async function fetchEncryptionKey() {
  let res;
  try {
    res = await fetch(`${API_BASE}/creds-key`, { credentials: "same-origin" });
  } catch {
    throw new Error("Network error — could not fetch encryption key.");
  }
  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new Error(body?.error || "Failed to fetch encryption key.");
  }
  const { keyId, keyHex } = await res.json();
  const keyBytes = Uint8Array.from(keyHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"],
  );
  return { keyId, cryptoKey };
}

// Encrypt a credentials object with AES-256-GCM.
// Returns { keyId, iv, tag, data } — all hex strings.
async function encryptCreds(creds, keyId, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(creds));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, plain);
  // Web Crypto appends the 16-byte auth tag at the end of the ciphertext
  const cipherArr = new Uint8Array(cipher);
  const data = cipherArr.slice(0, -16);
  const tag = cipherArr.slice(-16);
  const toHex = (buf) => Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { keyId, iv: toHex(iv), tag: toHex(tag), data: toHex(data) };
}

// Encrypt each creds object with its own server-issued key (single-use).
async function encryptAll(...credsObjects) {
  return Promise.all(
    credsObjects.map(async (c) => {
      const { keyId, cryptoKey } = await fetchEncryptionKey();
      return encryptCreds(c, keyId, cryptoKey);
    }),
  );
}

export async function testMigrationConnection(creds) {
  const [envelope] = await encryptAll(creds);
  return request(`${API_BASE}/test-connection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
  });
}

export async function generateMigrationScript({ source, target, queries, includeDelete, includeIdentityInsert }) {
  const envelopes = target
    ? await encryptAll(source, target)
    : await encryptAll(source);
  const [sourceEnv, targetEnv] = envelopes;
  return request(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceEnv, targetEnv: target ? targetEnv : null, queries, includeDelete, includeIdentityInsert }),
  });
}

export async function executeMigration({ source, target, queries, includeDelete, includeIdentityInsert }) {
  const [sourceEnv, targetEnv] = await encryptAll(source, target);
  return request(`${API_BASE}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceEnv, targetEnv, queries, includeDelete, includeIdentityInsert, confirm: true }),
  });
}
