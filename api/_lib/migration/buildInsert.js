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
// INSERT per row.
export function buildTableScript({ schema, table, whereClause, columns, rows }) {
  const hasIdentity = columns.some((c) => c.isIdentity);
  const columnList = columns.map((c) => `[${c.name}]`).join(",");
  const qualified = `${schema}.${table}`;

  const lines = [];
  lines.push("-- --------------------------------------------------------");
  lines.push(`-- Table  : ${qualified}`);
  lines.push(`-- Filter : WHERE ${whereClause}`);
  lines.push(`-- Rows   : ${rows.length}`);
  lines.push("-- --------------------------------------------------------");
  lines.push("");
  lines.push(`DELETE FROM ${qualified} WHERE ${whereClause}`);
  lines.push("GO");
  lines.push("");

  if (hasIdentity) {
    lines.push(`SET IDENTITY_INSERT ${qualified} ON`);
    lines.push("GO");
    lines.push("");
  }

  for (const row of rows) {
    const values = columns.map((c) => formatValue(row[c.name], c.dataType)).join(",");
    lines.push(`INSERT INTO [${schema}].[${table}](${columnList})VALUES(${values})`);
  }
  lines.push("");

  if (hasIdentity) {
    lines.push(`SET IDENTITY_INSERT ${qualified} OFF`);
    lines.push("GO");
  }

  return lines.join("\n");
}
