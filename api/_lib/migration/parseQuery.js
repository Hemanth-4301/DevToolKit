// Matches a bare object reference: optional [schema]. then [name], with or
// without brackets. E.g. "cn.tblFoo", "[dbo].[Orders]", "tblBar".
const BARE_NAME_RE = /^\[?([A-Za-z_][A-Za-z0-9_]*)\]?\.\[?([A-Za-z_][A-Za-z0-9_]*)\]?$|^\[?([A-Za-z_][A-Za-z0-9_]*)\]?$/;

// Splits a textarea's worth of pasted SELECT statements or bare table/proc
// names into individual query strings. Queries are separated at a newline
// immediately followed by a line starting with SELECT or a bare name — used
// both by generate.js and mirrored on the frontend for the live "N queries
// detected" counter, so the count always matches what the backend processes.
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

const FROM_TABLE_RE = /\bfrom\s+(?:\[?([A-Za-z_][A-Za-z0-9_]*)\]?\.)?\[?([A-Za-z_][A-Za-z0-9_]*)\]?/i;
const WHERE_RE = /\bwhere\b([\s\S]*)$/i;

// Parses one entry — either a SELECT query or a bare "schema.table" / "table"
// name — into { schema, table, whereClause, selectText }. A bare name gets
// expanded to SELECT * FROM schema.table with no WHERE (full-table migration).
// Returns { error } for anything that can't be understood.
export function parseQuery(queryText) {
  const trimmed = queryText.trim().replace(/;\s*$/, "");

  // Bare table/proc name — no SQL keywords at all.
  if (BARE_NAME_RE.test(trimmed)) {
    const m = BARE_NAME_RE.exec(trimmed);
    const schema = (m[1] || "dbo");
    const table = m[2] || m[3];
    const selectText = `SELECT * FROM [${schema}].[${table}]`;
    return { schema, table, whereClause: "", selectText, fullTable: true };
  }

  if (!/^select\b/i.test(trimmed)) {
    return { error: `Unrecognised input — enter a SELECT query or a bare table name (e.g. cn.tblFoo).` };
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
