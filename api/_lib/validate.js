export const MAX_CODE_LENGTH = 8_000_000; // ~8MB of original text
export const MAX_CHUNK_LENGTH = 2_800_000;

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

// Slugs live at the site root (e.g. yoursite.com/hem). Tool names (json,
// sql, jwt, admin, ...) are intentionally NOT reserved — those tools are
// only reachable via the navbar (or logo triple-click, for admin), not a
// URL — so only real routes, API paths, and static assets are blocked here.
export const RESERVED_SLUGS = new Set([
  "code-share", "share", "api", "assets", "src", "favicon.ico",
  "logo.png", "index.html", "robots.txt", "sitemap.xml",
]);

// Validates and normalizes a raw POST body into a safe shape. Returns
// { error } on failure (error is a user-facing message) or the sanitized
// fields on success — callers should never pass the raw body straight
// through to the database.
export function validateCreatePayload(body) {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }

  const { code, slug } = body;

  // Empty is valid — the editor is always-editable, so clearing existing
  // content (e.g. select-all + delete) is a deliberate edit, not an
  // invalid request. Only non-string values are rejected.
  if (typeof code !== "string") {
    return { error: "Code must be a string." };
  }
  if (code.length > MAX_CODE_LENGTH) {
    return { error: `Code exceeds the maximum size of ${MAX_CODE_LENGTH.toLocaleString()} characters.` };
  }

  if (typeof slug !== "string" || !slug.trim()) {
    return { error: "Slug is required." };
  }
  const cleanSlug = slug.trim().toLowerCase();
  if (!SLUG_RE.test(cleanSlug)) {
    return {
      error:
        "Slug must be 2-32 characters, lowercase letters, numbers, and hyphens only, and can't start with a hyphen.",
    };
  }
  if (RESERVED_SLUGS.has(cleanSlug)) {
    return { error: `"${cleanSlug}" is reserved and can't be used as a slug.` };
  }

  return { code, slug: cleanSlug };
}

export function validateChunkPayload(body) {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const { data, slug, transferId, chunkIndex, totalChunks, encoding } = body;
  if (encoding !== "gzip-base64") return { error: "Unsupported share encoding." };
  if (typeof data !== "string" || data.length > MAX_CHUNK_LENGTH) {
    return { error: "Compressed share chunk is too large." };
  }
  if (typeof transferId !== "string" || transferId.length > 100) {
    return { error: "Invalid share transfer." };
  }
  if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks)
    || chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
    return { error: "Invalid share chunk." };
  }
  if (typeof slug !== "string" || !SLUG_RE.test(slug.trim().toLowerCase())) {
    return { error: "Invalid link." };
  }
  const cleanSlug = slug.trim().toLowerCase();
  if (RESERVED_SLUGS.has(cleanSlug)) return { error: "This link is reserved." };
  return { data, slug: cleanSlug, transferId, chunkIndex, totalChunks, encoding };
}
