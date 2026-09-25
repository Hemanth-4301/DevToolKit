const API_BASE = "/api/migration";

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Mirrors src/lib/codeShareApi.js's request() helper — centralizes error
// normalization so components never call fetch() directly. These routes
// are admin-gated (see api/_lib/adminAuth.js's requireAdmin), so the
// session cookie must ride along — same-origin is the fetch default, but
// spelled out explicitly to match src/lib/adminApi.js's convention.
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

function postJson(path, body) {
  return request(`${API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function testMigrationConnection(creds) {
  return postJson("test-connection", creds);
}

export function generateMigrationScript({ source, target, queries, includeDelete, includeIdentityInsert }) {
  return postJson("generate", { source, target, queries, includeDelete, includeIdentityInsert });
}

// Actually runs the DELETE/INSERT statements against `target` — unlike
// generate/test-connection, this writes to a real database. `confirm:
// true` must be passed explicitly; the server rejects the call
// otherwise, on top of whatever confirmation the caller's own UI does.
export function executeMigration({ source, target, queries, includeDelete, includeIdentityInsert }) {
  return postJson("execute", { source, target, queries, includeDelete, includeIdentityInsert, confirm: true });
}
