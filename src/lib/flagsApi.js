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

// Public — no admin session required, since every visitor's browser
// needs to know which admin-gated features have been opened up to all.
export function getPublicFlags() {
  return request("/api/flags");
}

export function adminGetFlags() {
  return request("/api/admin/flags");
}

export function adminSetFlags(updates) {
  return request("/api/admin/flags", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}
