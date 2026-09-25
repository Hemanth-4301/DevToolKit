// Splits a textarea's worth of pasted SELECT statements into individual
// query strings. Queries are separated at a newline immediately followed
// by a line starting with SELECT — everything else (including a WHERE
// ... IN (...) list that wraps across several lines) stays attached to
// the query it belongs to. Used both by generate.js and mirrored on the
// frontend for the live "N queries detected" counter, so the count always
// matches what the backend will actually process.
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

const FROM_TABLE_RE = /\bfrom\s+(?:\[?([A-Za-z_][A-Za-z0-9_]*)\]?\.)?\[?([A-Za-z_][A-Za-z0-9_]*)\]?/i;
const WHERE_RE = /\bwhere\b([\s\S]*)$/i;

// Parses one SELECT query into its target table and WHERE clause. Returns
// { error } if the query doesn't look like a simple `SELECT ... FROM
// table [WHERE ...]` this tool can safely turn into DELETE/INSERT
// statements.
export function parseQuery(queryText) {
  const trimmed = queryText.trim().replace(/;\s*$/, "");
  if (!/^select\b/i.test(trimmed)) {
    return { error: "Not a SELECT query." };
  }

  const fromMatch = FROM_TABLE_RE.exec(trimmed);
  if (!fromMatch) {
    return { error: "Could not find a table name after FROM." };
  }
  const schema = fromMatch[1] || "dbo";
  const table = fromMatch[2];

  const whereMatch = WHERE_RE.exec(trimmed);
  const whereClause = whereMatch ? whereMatch[1].trim() : "";
  if (!whereClause) {
    return {
      error: `Query for ${schema}.${table} has no WHERE clause — refusing to generate an unfiltered DELETE.`,
    };
  }

  return { schema, table, whereClause, selectText: trimmed };
}
