import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";
import { requireAdmin } from "../_lib/adminAuth.js";
import { withConnection, friendlyConnectionError, sql } from "../_lib/migration/mssqlClient.js";
import { splitQueries, parseQuery } from "../_lib/migration/parseQuery.js";
import { buildTableScript } from "../_lib/migration/buildInsert.js";

const MAX_QUERIES = 50;
const MAX_TOTAL_QUERY_LENGTH = 200_000;

function validateBody(body) {
  const { server, database, username, password, port, queries } = body || {};
  if (
    typeof server !== "string" || !server.trim() ||
    typeof database !== "string" || !database.trim() ||
    typeof username !== "string" || !username.trim() ||
    typeof password !== "string" || !password
  ) {
    return { error: "Server, database, username, and password are all required." };
  }
  if (port !== undefined && port !== "" && Number.isNaN(Number(port))) {
    return { error: "Port must be a number." };
  }
  if (!Array.isArray(queries) || queries.length === 0) {
    return { error: "At least one query is required." };
  }
  if (queries.length > MAX_QUERIES) {
    return { error: `Too many queries — max ${MAX_QUERIES} per run.` };
  }
  const totalLength = queries.reduce((sum, q) => sum + (typeof q === "string" ? q.length : 0), 0);
  if (totalLength > MAX_TOTAL_QUERY_LENGTH) {
    return { error: "Combined query text is too large." };
  }
  if (queries.some((q) => typeof q !== "string" || !q.trim())) {
    return { error: "Invalid query in list." };
  }

  return {
    creds: { server: server.trim(), database: database.trim(), username: username.trim(), password, port },
    queries,
  };
}

async function fetchColumns(pool, schema, table) {
  const request = pool.request();
  request.input("schema", sql.NVarChar, schema);
  request.input("table", sql.NVarChar, table);
  const result = await request.query(`
    SELECT
      COLUMN_NAME AS name,
      DATA_TYPE AS dataType,
      COLUMNPROPERTY(OBJECT_ID(QUOTENAME(TABLE_SCHEMA) + '.' + QUOTENAME(TABLE_NAME)), COLUMN_NAME, 'IsIdentity') AS isIdentity
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
    ORDER BY ORDINAL_POSITION
  `);
  return result.recordset.map((r) => ({ name: r.name, dataType: r.dataType, isIdentity: !!r.isIdentity }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (isRateLimited(`migration-generate:${clientKeyFor(req)}`, 10)) {
    return res.status(429).json({ error: "Too many requests — please slow down." });
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  const validated = validateBody(req.body);
  if (validated.error) {
    return res.status(400).json({ error: validated.error });
  }

  const parsedQueries = [];
  for (const queryText of validated.queries) {
    const parsed = parseQuery(queryText);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    parsedQueries.push(parsed);
  }

  try {
    const sections = await withConnection(validated.creds, async (pool) => {
      const results = [];
      for (const { schema, table, whereClause, selectText } of parsedQueries) {
        const columns = await fetchColumns(pool, schema, table);
        if (columns.length === 0) {
          throw Object.assign(new Error(`Table not found: ${schema}.${table}`), { userFacing: true });
        }
        const rowsResult = await pool.request().query(selectText);
        results.push(
          buildTableScript({ schema, table, whereClause, columns, rows: rowsResult.recordset }),
        );
      }
      return results;
    });

    return res.status(200).json({ script: sections.join("\n\n") });
  } catch (err) {
    if (err.userFacing) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Migration generate failed:", err.message);
    return res.status(400).json({ error: friendlyConnectionError(err) });
  }
}
