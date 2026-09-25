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

// For each parsed query, reads rows from `sourcePool` and resolves the
// column list to use — the target's own column types/identity flags when
// `targetPool` is given (catches a missing/mismatched column before
// anything is generated or run), otherwise the source's. Shared by both
// the generate (text-only) and execute (actually runs it) endpoints so
// they can never disagree about what a table's migration consists of.
export async function resolveTables(sourcePool, targetPool, parsedQueries) {
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
      // Source's column order (matches the SELECT's row shape) but the
      // target's data type/identity metadata.
      columns = sourceColumns.map((c) => targetByName.get(c.name.toLowerCase()));
    }

    const rowsResult = await sourcePool.request().query(selectText);
    results.push({ schema, table, whereClause, columns, rows: rowsResult.recordset });
  }

  return results;
}
