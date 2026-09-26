const STRING_TYPES = new Set(["varchar", "nvarchar", "char", "nchar", "text", "ntext", "xml"]);
const NUMERIC_TYPES = new Set([
  "int", "bigint", "smallint", "tinyint", "decimal", "numeric", "float", "real",
]);
const DATE_TYPES = new Set(["datetime", "datetime2", "date", "smalldatetime", "datetimeoffset", "time"]);
const BINARY_TYPES = new Set(["binary", "varbinary", "image"]);
const MONEY_TYPES = new Set(["money", "smallmoney"]);

function escapeString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "NULL";
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const datePart = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const timePart = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
  return escapeString(`${datePart} ${timePart}`);
}

function formatBinary(value) {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return `0x${buf.toString("hex").toUpperCase()}`;
}

// Formats a single column value for use inside a VALUES(...) list,
// dispatching on the column's SQL Server data type. NULL is always
// unquoted regardless of type.
export function formatValue(value, dataType) {
  if (value === null || value === undefined) return "NULL";

  const type = String(dataType).toLowerCase();

  if (type === "bit") return value ? "1" : "0";
  if (type === "uniqueidentifier") return escapeString(value);
  if (NUMERIC_TYPES.has(type)) return String(value);
  if (MONEY_TYPES.has(type)) return Number(value).toFixed(4);
  if (DATE_TYPES.has(type)) return formatDate(value);
  if (BINARY_TYPES.has(type)) return formatBinary(value);
  if (STRING_TYPES.has(type)) return escapeString(value);

  // Unknown/exotic type (geometry, geography, sql_variant, ...) — fall
  // back to a quoted string representation rather than failing outright.
  return escapeString(value);
}

// Builds one full migration script section for a single table: header
// comment, DELETE, IDENTITY_INSERT toggle (only if needed), and one
// INSERT per row — all wrapped in its own transaction with TRY/CATCH, so
// if any statement fails partway through when the script is actually run
// (a constraint violation, a duplicate key, a truncated value, a dropped
// connection), that table's changes are rolled back automatically rather
// than leaving the target half-migrated (deleted rows with only some of
// their replacements inserted). Each table is independent: one table's
// rollback doesn't affect another table's already-committed section.
// `includeDelete`/`includeIdentityInsert` let the caller omit either
// section entirely (e.g. an append-only migration with no delete, or a
// table the user knows has no identity column).
export function buildTableScript({
  schema,
  table,
  whereClause,
  columns,
  rows,
  includeDelete = true,
  includeIdentityInsert = true,
  isProc = false,
}) {
  const hasIdentity = includeIdentityInsert && columns.some((c) => c.isIdentity);
  const columnList = columns.map((c) => `[${c.name}]`).join(",");
  const qualified = `${schema}.${table}`;
  const txnName = `Migrate_${schema}_${table}`.replace(/[^A-Za-z0-9_]/g, "_");

  const lines = [];
  lines.push("-- --------------------------------------------------------");
  lines.push(`-- Table  : ${qualified}${isProc ? " (via stored procedure)" : ""}`);
  lines.push(`-- Filter : ${whereClause ? `WHERE ${whereClause}` : isProc ? "(stored procedure — no DELETE generated)" : "(full table)"}`);
  lines.push(`-- Rows   : ${rows.length}`);
  lines.push("-- --------------------------------------------------------");
  lines.push("");
  lines.push("BEGIN TRY");
  lines.push(`  BEGIN TRANSACTION ${txnName}`);
  lines.push("");

  if (includeDelete && whereClause !== null) {
    const deleteStmt = whereClause
      ? `  DELETE FROM ${qualified} WHERE ${whereClause}`
      : `  DELETE FROM ${qualified}`;
    lines.push(deleteStmt);
    lines.push("");
  }

  if (hasIdentity) {
    lines.push(`  SET IDENTITY_INSERT ${qualified} ON`);
    lines.push("");
  }

  for (const row of rows) {
    const values = columns.map((c) => formatValue(row[c.name], c.dataType)).join(",");
    lines.push(`  INSERT INTO [${schema}].[${table}](${columnList})VALUES(${values})`);
  }
  lines.push("");

  if (hasIdentity) {
    lines.push(`  SET IDENTITY_INSERT ${qualified} OFF`);
    lines.push("");
  }

  lines.push(`  COMMIT TRANSACTION ${txnName}`);
  lines.push(`  PRINT 'OK: ${qualified} — ${rows.length} row(s) migrated.'`);
  lines.push("END TRY");
  lines.push("BEGIN CATCH");
  lines.push(`  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION ${txnName}`);
  if (hasIdentity) {
    // Always safe to issue even if IDENTITY_INSERT was already off for
    // this table/session — SQL Server only errors on turning a second
    // one ON while another is active, never on OFF.
    lines.push(`  SET IDENTITY_INSERT ${qualified} OFF`);
  }
  lines.push(`  PRINT 'ROLLED BACK: ${qualified} — ' + ERROR_MESSAGE()`);
  lines.push("  THROW;");
  lines.push("END CATCH");
  lines.push("GO");

  return lines.join("\n");
}
