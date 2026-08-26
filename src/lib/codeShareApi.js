const API_BASE = "/api/share";

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Thin wrapper so components never call fetch() directly — centralizes
// error normalization (network failures, non-JSON responses, API error
// bodies) into a single shape: throws an Error with a user-friendly message.
async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
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
    // A 200 with a non-JSON body means the request never reached the API
    // function at all (e.g. the dev server fell back to serving index.html
    // for an unmatched route) — treat it as a failure rather than silently
    // returning garbage to the caller.
    throw new Error("Unexpected response from the server — the API may not be running.");
  }
  return parseJsonSafe(res);
}

export function createShare({ code, slug }) {
  return request(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, slug }),
  });
}

export function getShare(id) {
  return request(`${API_BASE}/${encodeURIComponent(id)}`);
}

export function deleteShare(id) {
  return request(`${API_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
