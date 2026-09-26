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

// Reads the stored procedure's SQL definition from sys.sql_modules.
async function fetchProcDefinition(pool, schema, proc) {
  const req = pool.request();
  req.input("schema", sql.NVarChar, schema);
  req.input("proc", sql.NVarChar, proc);
  const result = await req.query(`
    SELECT m.definition
    FROM sys.sql_modules m
    JOIN sys.objects o ON m.object_id = o.object_id
    JOIN sys.schemas s ON o.schema_id = s.schema_id
    WHERE s.name = @schema AND o.name = @proc AND o.type = 'P'
  `);
  return result.recordset.length > 0 ? result.recordset[0].definition : null;
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
        // Stored procedure — read its definition and output CREATE OR ALTER PROCEDURE.
        const definition = await fetchProcDefinition(sourcePool, schema, table);
        if (!definition) {
          throw Object.assign(
            new Error(`Could not read definition for stored procedure [${schema}].[${table}]. Check permissions on sys.sql_modules.`),
            { userFacing: true },
          );
        }
        results.push({ schema, table, isProc: true, procDefinition: definition });
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
