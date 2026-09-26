import { sql } from "./mssqlClient.js";

export async function fetchColumns(pool, schema, table) {
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

// Checks sys.objects to find out whether the given name is a table/view or
// a stored procedure. Returns 'table', 'proc', or null (not found).
async function resolveObjectType(pool, schema, name) {
  const req = pool.request();
  req.input("schema", sql.NVarChar, schema);
  req.input("name", sql.NVarChar, name);
  const result = await req.query(`
    SELECT o.type
    FROM sys.objects o
    JOIN sys.schemas s ON o.schema_id = s.schema_id
    WHERE s.name = @schema AND o.name = @name
      AND o.type IN ('U','V','P')
  `);
  if (result.recordset.length === 0) return null;
  const t = result.recordset[0].type.trim();
  if (t === "P") return "proc";
  return "table";
}

// Infers column types from the first result set of a stored procedure by
// running it with FMTONLY (no actual rows returned, just metadata).
async function fetchProcColumns(pool, schema, proc) {
  const req = pool.request();
  try {
    await req.query("SET FMTONLY ON");
    const result = await pool.request().query(`EXEC [${schema}].[${proc}]`);
    await pool.request().query("SET FMTONLY OFF");
    // mssql returns column metadata even when no rows come back
    return (result.recordset?.columns
      ? Object.values(result.recordset.columns).map((c) => ({
          name: c.name,
          dataType: c.type?.declaration?.toLowerCase() ?? "nvarchar",
          isIdentity: false,
        }))
      : []);
  } catch {
    await pool.request().query("SET FMTONLY OFF").catch(() => {});
    return [];
  }
}

// For each parsed query, reads rows from `sourcePool` and resolves the
// column list to use — the target's own column types/identity flags when
// `targetPool` is given (catches a missing/mismatched column before
// anything is generated or run), otherwise the source's. Shared by both
// the generate (text-only) and execute (actually runs it) endpoints so
// they can never disagree about what a table's migration consists of.
export async function resolveTables(sourcePool, targetPool, parsedQueries) {
  const usingTarget = !!targetPool;
  const results = [];

  for (const { schema, table, whereClause, selectText, fullTable } of parsedQueries) {
    // For bare names, check what the object actually is in the source DB.
    let execText = selectText;
    let resolvedSchema = schema;
    let resolvedTable = table;

    if (fullTable) {
      const objType = await resolveObjectType(sourcePool, schema, table);
      if (!objType) {
        throw Object.assign(
          new Error(`Object not found in source database: ${schema}.${table}`),
          { userFacing: true },
        );
      }
      if (objType === "proc") {
        // Stored procedure — execute it to get the actual rows.
        execText = `EXEC [${schema}].[${table}]`;
        let rows = [];
        try {
          const rowsResult = await sourcePool.request().query(execText);
          rows = rowsResult.recordset || [];
        } catch (execErr) {
          const msg = execErr?.message || "";
          if (/expects parameter/i.test(msg) || /was not supplied/i.test(msg)) {
            throw Object.assign(
              new Error(
                `Stored procedure [${schema}].[${table}] requires parameters and cannot be called without arguments. ` +
                `Use a SELECT query with a manual EXEC instead.`
              ),
              { userFacing: true },
            );
          }
          throw Object.assign(
            new Error(`Failed to execute stored procedure [${schema}].[${table}]: ${msg}`),
            { userFacing: true },
          );
        }

        // Derive columns from the actual result rows (proc has no table columns).
        const procColumns = rows.length > 0
          ? Object.keys(rows[0]).map((name) => ({ name, dataType: "nvarchar", isIdentity: false }))
          : await fetchProcColumns(sourcePool, schema, table);

        if (procColumns.length === 0) {
          throw Object.assign(
            new Error(`Could not determine columns from stored procedure [${schema}].[${table}]. Make sure it returns a result set.`),
            { userFacing: true },
          );
        }

        // For a stored proc we can't generate a DELETE (no filter key), so
        // pass whereClause as null to signal buildTableScript to skip it.
        results.push({ schema, table, whereClause: null, columns: procColumns, rows, isProc: true });
        continue;
      }
      // It's a table/view — fall through with SELECT * (no WHERE = full table).
    }

    const sourceColumns = await fetchColumns(sourcePool, resolvedSchema, resolvedTable);
    if (sourceColumns.length === 0) {
      throw Object.assign(new Error(`Table not found in source: ${resolvedSchema}.${resolvedTable}`), { userFacing: true });
    }

    let columns = sourceColumns;
    if (usingTarget) {
      const targetColumns = await fetchColumns(targetPool, resolvedSchema, resolvedTable);
      if (targetColumns.length === 0) {
        throw Object.assign(new Error(`Table not found in target: ${resolvedSchema}.${resolvedTable}`), { userFacing: true });
      }
      const targetByName = new Map(targetColumns.map((c) => [c.name.toLowerCase(), c]));
      const missing = sourceColumns.filter((c) => !targetByName.has(c.name.toLowerCase()));
      if (missing.length > 0) {
        throw Object.assign(
          new Error(`Target table ${resolvedSchema}.${resolvedTable} is missing column(s): ${missing.map((c) => c.name).join(", ")}`),
          { userFacing: true },
        );
      }
      columns = sourceColumns.map((c) => targetByName.get(c.name.toLowerCase()));
    }

    const rowsResult = await sourcePool.request().query(execText);
    results.push({ schema: resolvedSchema, table: resolvedTable, whereClause, columns, rows: rowsResult.recordset });
  }

  return results;
}
