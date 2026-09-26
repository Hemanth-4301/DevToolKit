// Mirrors api/_lib/migration/parseQuery.js's splitQueries — kept in sync
// so the frontend's live "N queries detected" counter always matches what
// the backend will actually process. Splits at a newline immediately
// followed by a line starting with SELECT or a bare table/proc name.
const BARE_NAME_RE = /^\[?([A-Za-z_][A-Za-z0-9_]*)\]?\.\[?([A-Za-z_][A-Za-z0-9_]*)\]?$|^\[?([A-Za-z_][A-Za-z0-9_]*)\]?$/;

export function splitQueries(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];

  const lines = raw.split("\n");
  const queries = [];
  let current = [];

  for (const line of lines) {
    const isNewQuery =
      (/^\s*select\b/i.test(line) || BARE_NAME_RE.test(line.trim())) && current.length;
    if (isNewQuery) {
      queries.push(current.join("\n").trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) queries.push(current.join("\n").trim());

  return queries.filter(Boolean);
}
