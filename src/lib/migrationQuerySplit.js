// Mirrors api/_lib/migration/parseQuery.js's splitQueries — kept in sync
// so the frontend's live "N queries detected" counter always matches what
// the backend will actually process. Splits at a newline immediately
// followed by a line starting with SELECT; everything else (including a
// WHERE ... IN (...) list wrapping across lines) stays attached.
export function splitQueries(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];

  const lines = raw.split("\n");
  const queries = [];
  let current = [];

  for (const line of lines) {
    if (/^\s*select\b/i.test(line) && current.length) {
      queries.push(current.join("\n").trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) queries.push(current.join("\n").trim());

  return queries.filter(Boolean);
}
