export const MAX_CODE_LENGTH = 200_000; // ~200KB of source text

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

// Slugs live at the site root (e.g. yoursite.com/hem), so anything that
// collides with an existing top-level route — a tool tab or a reserved
// path — must be blocked before it ever reaches the database.
export const RESERVED_SLUGS = new Set([
  "json", "sql", "diff", "base64", "html", "jwt", "stringify",
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

  if (typeof code !== "string" || !code.trim()) {
    return { error: "Code is required." };
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
