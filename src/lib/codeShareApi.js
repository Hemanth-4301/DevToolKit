const API_BASE = "/api/share";

// Keep the client-side guard aligned with api/_lib/validate.js.
export const MAX_CODE_LENGTH = 8_000_000;
const CHUNK_SIZE = 2_800_000;

function bytesToBase64(bytes) {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compressText(text) {
  if (typeof CompressionStream === "undefined") {
    throw new Error("This browser does not support text compression. Please use a recent browser.");
  }
  const stream = new Blob([new TextEncoder().encode(text)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

async function decompressText(value) {
  const stream = new Blob([base64ToBytes(value)])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

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

export async function createShare({ code, slug }) {
  const encoded = await compressText(code);
  const transferId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const totalChunks = Math.max(1, Math.ceil(encoded.length / CHUNK_SIZE));
  let result;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    result = await request(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        encoding: "gzip-base64",
        transferId,
        chunkIndex,
        totalChunks,
        data: encoded.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE),
      }),
    });
  }
  return result;
}

export async function getShare(id) {
  const result = await request(`${API_BASE}/${encodeURIComponent(id)}`);
  if (result?.encoding === "gzip-base64") {
    return { ...result, code: await decompressText(result.data) };
  }
  return result;
}

export function deleteShare(id) {
  return request(`${API_BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
