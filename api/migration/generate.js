import { isRateLimited, clientKeyFor } from "../_lib/rateLimit.js";
import { requireAdmin } from "../_lib/adminAuth.js";
import { withConnection, friendlyConnectionError, sql } from "../_lib/migration/mssqlClient.js";
import { splitQueries, parseQuery } from "../_lib/migration/parseQuery.js";
import { buildTableScript } from "../_lib/migration/buildInsert.js";

const MAX_QUERIES = 50;
const MAX_TOTAL_QUERY_LENGTH = 200_000;

function validateCreds(creds, label) {
  const { server, database, username, password, port } = creds || {};
  if (
    typeof server !== "string" || !server.trim() ||
    typeof database !== "string" || !database.trim() ||
    typeof username !== "string" || !username.trim() ||
    typeof password !== "string" || !password
  ) {
    return { error: `${label}: server, database, username, and password are all required.` };
  }
  if (port !== undefined && port !== "" && Number.isNaN(Number(port))) {
    return { error: `${label}: port must be a number.` };
  }
  return { creds: { server: server.trim(), database: database.trim(), username: username.trim(), password, port } };
}

function validateBody(body) {
  const { source, target, queries, includeDelete, includeIdentityInsert } = body || {};

  const sourceValidated = validateCreds(source, "Source database");
  if (sourceValidated.error) return { error: sourceValidated.error };

  let targetCreds = null;
  if (target) {
    const targetValidated = validateCreds(target, "Target database");
    if (targetValidated.error) return { error: targetValidated.error };
    targetCreds = targetValidated.creds;
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
    source: sourceValidated.creds,
    target: targetCreds,
    queries,
    includeDelete: includeDelete !== false,
    includeIdentityInsert: includeIdentityInsert !== false,
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
    const sections = await withConnection(validated.source, async (sourcePool) => {
      // When a target DB is given, open a second connection for the
      // duration of the whole request and use ITS column/identity
      // metadata to build each table's script — catches a column that
      // doesn't exist on the target, or a target table with no identity
      // column, before the script is ever run there. Falls back to the
      // source connection's own metadata when no target is set.
      const runWithTarget = async (targetPool) => {
        const usingTarget = !!targetPool;
        const results = [];
        for (const { schema, table, whereClause, selectText } of parsedQueries) {
          const sourceColumns = await fetchColumns(sourcePool, schema, table);
          if (sourceColumns.length === 0) {
            throw Object.assign(new Error(`Table not found in source: ${schema}.${table}`), { userFacing: true });
          }

          let columns = sourceColumns;
          if (usingTarget) {
            const targetColumns = await fetchColumns(targetPool, schema, table);
            if (targetColumns.length === 0) {
              throw Object.assign(new Error(`Table not found in target: ${schema}.${table}`), { userFacing: true });
            }
            const targetByName = new Map(targetColumns.map((c) => [c.name.toLowerCase(), c]));
            const missing = sourceColumns.filter((c) => !targetByName.has(c.name.toLowerCase()));
            if (missing.length > 0) {
              throw Object.assign(
                new Error(`Target table ${schema}.${table} is missing column(s): ${missing.map((c) => c.name).join(", ")}`),
                { userFacing: true },
              );
            }
            // Use the source's column order (matches the SELECT's row
            // shape) but the target's data type/identity metadata.
            columns = sourceColumns.map((c) => targetByName.get(c.name.toLowerCase()));
          }

          const rowsResult = await sourcePool.request().query(selectText);
          results.push(
            buildTableScript({
              schema,
              table,
              whereClause,
              columns,
              rows: rowsResult.recordset,
              includeDelete: validated.includeDelete,
              includeIdentityInsert: validated.includeIdentityInsert,
            }),
          );
        }
        return results;
      };

      if (validated.target) {
        return withConnection(validated.target, (targetPool) => runWithTarget(targetPool));
      }
      return runWithTarget(null);
    });

    const header = [
      "-- ============================================================",
      "-- Generated by DevToolKit Migration Generator",
      "-- Each table below runs inside its own transaction: if any",
      "-- statement for that table fails, its changes are rolled back",
      "-- automatically and the error is re-thrown (script execution",
      "-- stops there). Tables already committed before the failure",
      "-- are NOT affected — review the failed table, fix the issue,",
      "-- and re-run just that section if needed.",
      "-- ============================================================",
      "",
    ].join("\n");

    return res.status(200).json({ script: header + sections.join("\n\n") });
  } catch (err) {
    if (err.userFacing) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Migration generate failed:", err.message);
    return res.status(400).json({ error: friendlyConnectionError(err) });
  }
}
