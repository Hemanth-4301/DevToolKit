import { sql } from "./mssqlClient.js";
import { formatValue } from "./buildInsert.js";

// Executes one table's migration (DELETE + INSERTs) directly against a
// connection pool via the driver's real transaction API — NOT by running
// the generated SQL text from buildInsert.js, since that text uses `GO`
// batch separators which are an SSMS-only convention the mssql driver
// doesn't understand. Same safety contract as the generated script's
// BEGIN TRY/TRANSACTION: any failure rolls back everything done for this
// table and the error propagates, but tables already committed (a
// separate call each) are unaffected.
export async function executeTableStatements(pool, {
  schema,
  table,
  whereClause,
  columns,
  rows,
  includeDelete = true,
  includeIdentityInsert = true,
}) {
  const hasIdentity = includeIdentityInsert && columns.some((c) => c.isIdentity);
  const columnList = columns.map((c) => `[${c.name}]`).join(",");
  const qualified = `[${schema}].[${table}]`;

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    if (includeDelete) {
      await new sql.Request(transaction).query(`DELETE FROM ${schema}.${table} WHERE ${whereClause}`);
    }

    if (hasIdentity) {
      await new sql.Request(transaction).query(`SET IDENTITY_INSERT ${schema}.${table} ON`);
    }

    for (const row of rows) {
      const values = columns.map((c) => formatValue(row[c.name], c.dataType)).join(",");
      await new sql.Request(transaction).query(`INSERT INTO ${qualified}(${columnList})VALUES(${values})`);
    }

    if (hasIdentity) {
      await new sql.Request(transaction).query(`SET IDENTITY_INSERT ${schema}.${table} OFF`);
    }

    await transaction.commit();
    return { schema, table, rowsAffected: rows.length, ok: true };
  } catch (err) {
    // Always safe to attempt — a transaction that already failed simply
    // rejects the rollback too, which we don't need to surface further
    // since the original error is what matters to the caller.
    await transaction.rollback().catch(() => {});
    const wrapped = new Error(`${schema}.${table}: ${err.message}`);
    wrapped.tableError = { schema, table, message: err.message };
    throw wrapped;
  }
}
