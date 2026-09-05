const API_BASE = "/api/admin";

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Mirrors src/lib/codeShareApi.js's request() convention exactly.
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

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Unexpected response from the server — the API may not be running.");
  }
  return parseJsonSafe(res);
}

export function adminLogin({ username, password }) {
  return request(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function adminLogout() {
  return request(`${API_BASE}/logout`, { method: "POST" });
}

export function adminMe() {
  return request(`${API_BASE}/me`);
}

export function adminChangePassword({ currentPassword, newPassword, newUsername }) {
  return request(`${API_BASE}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword, newUsername }),
  });
}

export function adminListShares() {
  return request(`${API_BASE}/shares`);
}

export function adminDeleteShare(id) {
  return request(`${API_BASE}/shares/${encodeURIComponent(id)}`, { method: "DELETE" });
}
