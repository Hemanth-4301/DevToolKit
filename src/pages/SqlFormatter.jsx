import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Copy,
  Download,
  Upload,
  Trash2,
  History,
  ChevronDown,
  ChevronUp,
  Check,
  ClipboardPaste,
  RotateCcw,
  FileText,
  Maximize2,
  Replace,
} from "lucide-react";
import { format as sqlFormat } from "sql-formatter";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";
import ScrollToTop from "../components/ScrollToTop";
import FindReplaceModal from "../components/FindReplaceModal";

const HISTORY_KEY = "devtoolkit_sql_history";
const STATE_KEY = "devtoolkit_sql_state";

const SAMPLE_SQL = `WITH sales_summary AS (
  SELECT 
    c.customer_id,
    c.name,
    COUNT(o.order_id) AS total_orders,
    SUM(o.amount) AS total_revenue
  FROM customers c
  LEFT JOIN orders o ON c.customer_id = o.customer_id
  WHERE o.created_at >= '2024-01-01'
  GROUP BY c.customer_id, c.name
  HAVING SUM(o.amount) > 1000
), ranked AS (
  SELECT *, RANK() OVER (ORDER BY total_revenue DESC) AS rank
  FROM sales_summary
)
SELECT r.name, r.total_orders, r.total_revenue, r.rank,
  CASE WHEN r.rank = 1 THEN 'Gold' WHEN r.rank <= 5 THEN 'Silver' ELSE 'Bronze' END AS tier
FROM ranked r
JOIN products p ON p.created_by = r.customer_id
WHERE r.rank <= 10
ORDER BY r.rank ASC
LIMIT 25;`;

const SQL_KEYWORDS = [
  ...new Set([
    // DML
    "SELECT",
    "FROM",
    "WHERE",
    "JOIN",
    "LEFT JOIN",
    "RIGHT JOIN",
    "INNER JOIN",
    "OUTER JOIN",
    "FULL JOIN",
    "FULL OUTER JOIN",
    "CROSS JOIN",
    "NATURAL JOIN",
    "ON",
    "USING",
    "GROUP BY",
    "ORDER BY",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "FETCH",
    "NEXT",
    "ROWS",
    "ONLY",
    "INSERT",
    "INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE",
    "MERGE",
    "UPSERT",
    "RETURNING",
    // DDL
    "CREATE",
    "TABLE",
    "ALTER",
    "DROP",
    "TRUNCATE",
    "RENAME",
    "ADD",
    "COLUMN",
    "CONSTRAINT",
    "DEFAULT",
    "NOT NULL",
    "CHECK",
    "UNIQUE",
    "PRIMARY",
    "KEY",
    "FOREIGN",
    "REFERENCES",
    "INDEX",
    "VIEW",
    "MATERIALIZED",
    "SCHEMA",
    "DATABASE",
    "SEQUENCE",
    "TRIGGER",
    "PROCEDURE",
    "FUNCTION",
    "ROUTINE",
    "REPLACE",
    // DCL/TCL
    "GRANT",
    "REVOKE",
    "DENY",
    "WITH",
    "AS",
    "TRANSACTION",
    "BEGIN",
    "COMMIT",
    "ROLLBACK",
    "SAVEPOINT",
    "RELEASE",
    // Logical
    "AND",
    "OR",
    "NOT",
    "IN",
    "NOT IN",
    "EXISTS",
    "NOT EXISTS",
    "ANY",
    "ALL",
    "SOME",
    "BETWEEN",
    "LIKE",
    "ILIKE",
    "SIMILAR TO",
    "IS",
    "IS NOT",
    "NULL",
    "IS NULL",
    "IS NOT NULL",
    // Set ops
    "UNION",
    "UNION ALL",
    "INTERSECT",
    "EXCEPT",
    "MINUS",
    // Conditional
    "CASE",
    "WHEN",
    "THEN",
    "ELSE",
    "END",
    "IF",
    "COALESCE",
    "NULLIF",
    "IIF",
    "DECODE",
    "NVL",
    // Sorting/Distinct
    "DISTINCT",
    "TOP",
    "ASC",
    "DESC",
    "NULLS",
    "FIRST",
    "LAST",
    // Subquery/CTE
    "RECURSIVE",
    "LATERAL",
    // Window functions
    "OVER",
    "PARTITION",
    "BY",
    "WINDOW",
    "UNBOUNDED",
    "PRECEDING",
    "FOLLOWING",
    "CURRENT ROW",
    "RANGE",
    "ROWS",
    // Aggregate functions
    "COUNT",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
    "STDDEV",
    "VARIANCE",
    "GROUP_CONCAT",
    "STRING_AGG",
    "ARRAY_AGG",
    "JSON_AGG",
    "LISTAGG",
    // Ranking window functions
    "RANK",
    "DENSE_RANK",
    "ROW_NUMBER",
    "NTILE",
    "PERCENT_RANK",
    "CUME_DIST",
    "LEAD",
    "LAG",
    "FIRST_VALUE",
    "LAST_VALUE",
    "NTH_VALUE",
    // Type conversion
    "CAST",
    "CONVERT",
    "TRY_CAST",
    "TRY_CONVERT",
    "PARSE",
    "TRY_PARSE",
    // String functions
    "CONCAT",
    "CONCAT_WS",
    "SUBSTRING",
    "SUBSTR",
    "LEFT",
    "RIGHT",
    "TRIM",
    "LTRIM",
    "RTRIM",
    "UPPER",
    "LOWER",
    "LENGTH",
    "LEN",
    "CHAR_LENGTH",
    "REPLACE",
    "STUFF",
    "CHARINDEX",
    "PATINDEX",
    "INSTR",
    "POSITION",
    "FORMAT",
    "STR",
    "SPACE",
    "REPLICATE",
    "REPEAT",
    "REVERSE",
    "SOUNDEX",
    "DIFFERENCE",
    "ASCII",
    "CHAR",
    "UNICODE",
    "NCHAR",
    "STRING_SPLIT",
    // Date/time functions
    "DATE",
    "DATETIME",
    "TIME",
    "TIMESTAMP",
    "INTERVAL",
    "EXTRACT",
    "DATEPART",
    "DATENAME",
    "DATEADD",
    "DATEDIFF",
    "GETDATE",
    "GETUTCDATE",
    "NOW",
    "SYSDATE",
    "CURRENT_DATE",
    "CURRENT_TIME",
    "CURRENT_TIMESTAMP",
    "SYSDATETIME",
    "YEAR",
    "MONTH",
    "DAY",
    "HOUR",
    "MINUTE",
    "SECOND",
    "EOMONTH",
    "DATEFROMPARTS",
    "TIMEFROMPARTS",
    // Math functions
    "ABS",
    "CEILING",
    "FLOOR",
    "ROUND",
    "TRUNCATE",
    "TRUNC",
    "POWER",
    "SQRT",
    "EXP",
    "LOG",
    "LOG10",
    "SIGN",
    "MOD",
    "PI",
    "RAND",
    "RANDOM",
    // JSON functions
    "JSON_VALUE",
    "JSON_QUERY",
    "JSON_OBJECT",
    "JSON_ARRAY",
    "JSON_EXISTS",
    "JSON_TABLE",
    "JSON_ARRAYAGG",
    "JSON_OBJECTAGG",
    "OPENJSON",
    "FOR JSON",
    // NULL handling
    "ISNULL",
    "IFNULL",
    "ZEROIFNULL",
    // Misc
    "EXPLAIN",
    "ANALYZE",
    "VERBOSE",
    "EXEC",
    "EXECUTE",
    "CALL",
    "DO",
    "OUTPUT",
    "OPENQUERY",
    "OPENROWSET",
    "OPENDATASOURCE",
    "BULK",
    "READTEXT",
    "WRITETEXT",
    "UPDATETEXT",
    "ENABLE",
    "DISABLE",
    "REBUILD",
    "REORGANIZE",
    "INCLUDE",
    "NOLOCK",
    "READCOMMITTED",
    "SERIALIZABLE",
    "SNAPSHOT",
    "READ",
    "WRITE",
    "WAIT",
    "NOWAIT",
    "TABLESAMPLE",
    "PIVOT",
    "UNPIVOT",
    "APPLY",
    "CROSS APPLY",
    "OUTER APPLY",
    "FOR",
    "XML",
    "PATH",
    "AUTO",
    "RAW",
    "EXPLICIT",
    "TYPE",
    "ELEMENTS",
    "XSINIL",
    // Data types
    "INT",
    "INTEGER",
    "BIGINT",
    "SMALLINT",
    "TINYINT",
    "BIT",
    "BOOLEAN",
    "DECIMAL",
    "NUMERIC",
    "FLOAT",
    "REAL",
    "MONEY",
    "SMALLMONEY",
    "CHAR",
    "VARCHAR",
    "NCHAR",
    "NVARCHAR",
    "TEXT",
    "NTEXT",
    "CLOB",
    "BINARY",
    "VARBINARY",
    "IMAGE",
    "BLOB",
    "DATETIME2",
    "SMALLDATETIME",
    "DATETIMEOFFSET",
    "JSON",
    "UNIQUEIDENTIFIER",
    "GUID",
    "UUID",
    "CURSOR",
    "ROWVERSION",
    "SQL_VARIANT",
    "GEOMETRY",
    "GEOGRAPHY",
    "HIERARCHYID",
  ]),
];

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(input, output) {
  const history = getHistory();
  const entry = {
    timestamp: Date.now(),
    preview: input.slice(0, 60),
    input,
    output,
  };
  const updated = [entry, ...history].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

function getState() {
  try {
    return JSON.parse(
      localStorage.getItem(STATE_KEY) || '{"input":"","output":""}',
    );
  } catch {
    return { input: "", output: "" };
  }
}

function setState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

const DIALECT_MAP = {
  "Standard SQL": "sql",
  MySQL: "mysql",
  PostgreSQL: "postgresql",
  SQLite: "sqlite",
  MSSQL: "tsql",
  Oracle: "plsql",
};

const KEYWORD_CASE_MAP = {
  UPPERCASE: "upper",
  lowercase: "lower",
  Capitalize: "upper",
};

function formatSQL(
  sql,
  {
    indentSize = 2,
    keyCase = "UPPERCASE",
    commaPos = "end",
    dialect = "Standard SQL",
  } = {},
) {
  const language = DIALECT_MAP[dialect] || "sql";
  const tabWidth = indentSize === "tab" ? 4 : Number(indentSize);
  const useTabs = indentSize === "tab";
  const kc = KEYWORD_CASE_MAP[keyCase] || "upper";

  try {
    let result = sqlFormat(sql, {
      language,
      tabWidth,
      useTabs,
      keywordCase: kc,
      dataTypeCase: kc,
      functionCase: kc,
      identifierCase: "preserve",
      logicalOperatorNewline: "before",
      expressionWidth: 80,
      linesBetweenQueries: 2,
      denseOperators: false,
      newlineBeforeSemicolon: false,
    });

    if (commaPos === "start") {
      result = moveCommasToStart(result);
    }

    if (keyCase === "Capitalize") {
      result = capitalizeKeywords(result);
    }

    return result;
  } catch (e) {
    return `-- SQL formatting error: ${e.message}\n\n${sql}`;
  }
}

// Walk tokens preserving strings/comments/identifiers so transforms only touch SQL keywords.
const TOKEN_RE =
  /(--[^\n]*)|(\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|("(?:""|[^"])*")|(`(?:[^`])*`)|(\[[^\]]*\])|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;

function transformOutsideLiterals(sql, transformWord) {
  return sql.replace(TOKEN_RE, (m, c1, c2, s1, s2, s3, s4, word) => {
    if (c1 || c2 || s1 || s2 || s3 || s4) return m;
    if (word) return transformWord(word);
    return m;
  });
}

function moveCommasToStart(sql) {
  const lines = sql.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = out[out.length - 1];
    if (
      prev !== undefined &&
      /,\s*$/.test(prev) &&
      line.trim().length > 0 &&
      !/^\s*--/.test(line)
    ) {
      out[out.length - 1] = prev.replace(/,\s*$/, "");
      const indentMatch = line.match(/^[ \t]*/)[0];
      const trimmedIndent = indentMatch.replace(/[ \t]{0,2}$/, "");
      out.push(trimmedIndent + ", " + line.trim());
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

const KEYWORD_SET = new Set(SQL_KEYWORDS.map((k) => k.toUpperCase()));

function capitalizeKeywords(sql) {
  return transformOutsideLiterals(sql, (word) => {
    if (KEYWORD_SET.has(word.toUpperCase())) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word;
  });
}

const HIGHLIGHT_LINE_LIMIT = 2000;

function highlightSQL(sql) {
  const lines = sql.split("\n");
  if (lines.length > HIGHLIGHT_LINE_LIMIT) {
    return <span className="text-foreground">{sql}</span>;
  }
  return lines.map((line, li) => (
    <span
      key={li}
      className="output-line"
      style={{ "--line-delay": `${Math.min(li, 40) * 0.018}s` }}
    >
      {tokenizeLine(line)}
      {li < lines.length - 1 ? "\n" : ""}
    </span>
  ));
}

// Keyword color categories — like a real SQL editor
const KW_DML = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "CROSS",
  "NATURAL",
  "ON",
  "USING",
  "INTO",
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "UPSERT",
  "RETURNING",
  "SET",
  "VALUES",
]);
const KW_CLAUSE = new Set([
  "GROUP",
  "ORDER",
  "BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "FETCH",
  "NEXT",
  "ROWS",
  "ONLY",
  "DISTINCT",
  "TOP",
  "ASC",
  "DESC",
  "NULLS",
  "FIRST",
  "LAST",
  "WITH",
  "AS",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "MINUS",
  "UNION ALL",
]);
const KW_DDL = new Set([
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "RENAME",
  "ADD",
  "COLUMN",
  "TABLE",
  "VIEW",
  "INDEX",
  "SCHEMA",
  "DATABASE",
  "SEQUENCE",
  "TRIGGER",
  "PROCEDURE",
  "FUNCTION",
  "REPLACE",
  "MATERIALIZED",
  "UNIQUE",
  "PRIMARY",
  "KEY",
  "FOREIGN",
  "REFERENCES",
  "CONSTRAINT",
  "DEFAULT",
  "CHECK",
  "ENABLE",
  "DISABLE",
  "REBUILD",
  "REORGANIZE",
]);
const KW_LOGICAL = new Set([
  "AND",
  "OR",
  "NOT",
  "IN",
  "EXISTS",
  "ANY",
  "ALL",
  "SOME",
  "BETWEEN",
  "LIKE",
  "ILIKE",
  "IS",
  "NULL",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "IF",
  "COALESCE",
  "NULLIF",
  "IIF",
  "DECODE",
  "NVL",
]);
const KW_TCL = new Set([
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "TRANSACTION",
  "SAVEPOINT",
  "RELEASE",
  "GRANT",
  "REVOKE",
  "DENY",
]);
const KW_WINDOW = new Set([
  "OVER",
  "PARTITION",
  "WINDOW",
  "UNBOUNDED",
  "PRECEDING",
  "FOLLOWING",
  "RANGE",
  "CURRENT",
  "ROW",
  "ROWS",
  "RANK",
  "DENSE_RANK",
  "ROW_NUMBER",
  "NTILE",
  "PERCENT_RANK",
  "CUME_DIST",
  "LEAD",
  "LAG",
  "FIRST_VALUE",
  "LAST_VALUE",
  "NTH_VALUE",
]);
const KW_FUNC = new Set([
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "STDDEV",
  "VARIANCE",
  "GROUP_CONCAT",
  "STRING_AGG",
  "ARRAY_AGG",
  "JSON_AGG",
  "LISTAGG",
  "CAST",
  "CONVERT",
  "TRY_CAST",
  "TRY_CONVERT",
  "PARSE",
  "CONCAT",
  "CONCAT_WS",
  "SUBSTRING",
  "SUBSTR",
  "TRIM",
  "LTRIM",
  "RTRIM",
  "UPPER",
  "LOWER",
  "LENGTH",
  "LEN",
  "REPLACE",
  "STUFF",
  "CHARINDEX",
  "PATINDEX",
  "INSTR",
  "POSITION",
  "FORMAT",
  "REVERSE",
  "ASCII",
  "CHAR",
  "UNICODE",
  "NCHAR",
  "STRING_SPLIT",
  "DATE",
  "DATETIME",
  "EXTRACT",
  "DATEPART",
  "DATENAME",
  "DATEADD",
  "DATEDIFF",
  "GETDATE",
  "GETUTCDATE",
  "NOW",
  "SYSDATE",
  "CURRENT_DATE",
  "CURRENT_TIME",
  "CURRENT_TIMESTAMP",
  "YEAR",
  "MONTH",
  "DAY",
  "HOUR",
  "MINUTE",
  "SECOND",
  "ABS",
  "CEILING",
  "FLOOR",
  "ROUND",
  "POWER",
  "SQRT",
  "EXP",
  "LOG",
  "SIGN",
  "RAND",
  "ISNULL",
  "IFNULL",
  "NULLIF",
  "COALESCE",
  "JSON_VALUE",
  "JSON_QUERY",
  "JSON_OBJECT",
  "OPENJSON",
]);
const KW_TYPE = new Set([
  "INT",
  "INTEGER",
  "BIGINT",
  "SMALLINT",
  "TINYINT",
  "BIT",
  "BOOLEAN",
  "DECIMAL",
  "NUMERIC",
  "FLOAT",
  "REAL",
  "MONEY",
  "CHAR",
  "VARCHAR",
  "NCHAR",
  "NVARCHAR",
  "TEXT",
  "NTEXT",
  "BINARY",
  "VARBINARY",
  "IMAGE",
  "BLOB",
  "CLOB",
  "TIMESTAMP",
  "INTERVAL",
  "XML",
  "JSON",
  "UNIQUEIDENTIFIER",
  "UUID",
  "GUID",
  "CURSOR",
  "ROWVERSION",
  "SQL_VARIANT",
  "GEOMETRY",
  "GEOGRAPHY",
]);

function getKeywordClass(word) {
  const u = word.toUpperCase();
  if (KW_DML.has(u)) return "text-blue-500 dark:text-blue-400 font-bold";
  if (KW_CLAUSE.has(u)) return "text-violet-500 dark:text-violet-400 font-bold";
  if (KW_DDL.has(u)) return "text-rose-500 dark:text-rose-400 font-bold";
  if (KW_LOGICAL.has(u)) return "text-amber-500 dark:text-amber-400 font-bold";
  if (KW_TCL.has(u)) return "text-pink-500 dark:text-pink-400 font-bold";
  if (KW_WINDOW.has(u)) return "text-cyan-500 dark:text-cyan-400 font-bold";
  if (KW_FUNC.has(u)) return "text-emerald-500 dark:text-emerald-400 font-bold";
  if (KW_TYPE.has(u)) return "text-orange-400 dark:text-orange-300 font-bold";
  return null;
}

function tokenizeLine(line) {
  const re =
    /--.*$|\/\*[\s\S]*?\*\/|'[^']*'|"[^"]*"|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b|./g;
  const tokens = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(
        <span key={key++}>{line.slice(lastIndex, match.index)}</span>,
      );
    }
    const val = match[0];
    if (val.startsWith("--") || val.startsWith("/*")) {
      tokens.push(
        <span key={key++} className="text-slate-400 dark:text-slate-500 italic">
          {val}
        </span>,
      );
    } else if (val.startsWith("'") || val.startsWith('"')) {
      tokens.push(
        <span key={key++} className="text-green-600 dark:text-green-400">
          {val}
        </span>,
      );
    } else if (match[1] !== undefined) {
      tokens.push(
        <span key={key++} className="text-orange-500 dark:text-orange-400">
          {val}
        </span>,
      );
    } else if (match[2] !== undefined) {
      const cls = getKeywordClass(val);
      if (cls) {
        tokens.push(
          <span key={key++} className={cls}>
            {val}
          </span>,
        );
      } else {
        tokens.push(
          <span key={key++} className="text-foreground">
            {val}
          </span>,
        );
      }
    } else {
      tokens.push(
        <span key={key++} className="text-muted-foreground">
          {val}
        </span>,
      );
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < line.length)
    tokens.push(<span key={key++}>{line.slice(lastIndex)}</span>);
  return tokens;
}

export default function SqlFormatter() {
  const initialState = getState();
  const [input, setInput] = useState(initialState.input);
  const [output, setOutput] = useState(initialState.output);
  const [dialect, setDialect] = useState("MSSQL");
  const [indentSize, setIndentSize] = useState(2);
  const [keyCase, setKeyCase] = useState("UPPERCASE");
  const [commaPos, setCommaPos] = useState("end");
  const [wrap, setWrap] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(getHistory);
  const [copied, setCopied] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [showFindReplace, setShowFindReplace] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShowFindReplace(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const fileInputRef = useRef(null);

  // Memoize highlighted output — expensive for large SQL, only recompute when output changes
  const highlightedOutput = useMemo(() => highlightSQL(output), [output]);

  useEffect(() => {
    setState({ input, output });
  }, [input, output]);

  const formatSqlText = useCallback(
    (text) => {
      if (!text.trim()) {
        setOutput("");
        return;
      }
      const formatted = formatSQL(text, {
        indentSize,
        keyCase,
        commaPos,
        dialect,
      });
      setOutput(formatted);
      setAnimKey((k) => k + 1);
      saveHistory(text, formatted);
      setHistory(getHistory());
    },
    [indentSize, keyCase, commaPos, dialect],
  );

  const handleFormat = () => {
    if (!input.trim()) return;
    formatSqlText(input);
  };

  const handleMinify = () => {
    if (!input.trim()) return;
    const parts = [];
    const re =
      /(--[^\n]*)|(\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|("(?:""|[^"])*")|(`(?:[^`])*`)|([\s\S])/g;
    let buf = "";
    let m;
    while ((m = re.exec(input)) !== null) {
      if (m[1] || m[2]) {
        if (buf) {
          parts.push(buf.replace(/\s+/g, " "));
          buf = "";
        }
        continue;
      }
      if (m[3] || m[4] || m[5]) {
        if (buf) {
          parts.push(buf.replace(/\s+/g, " "));
          buf = "";
        }
        parts.push(m[0]);
      } else {
        buf += m[0];
      }
    }
    if (buf) parts.push(buf.replace(/\s+/g, " "));
    const minified = parts
      .join("")
      .replace(/\s*([(),;])\s*/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    setOutput(minified);
  };

  const handleRemoveComments = () => {
    if (!input.trim()) return;
    const re =
      /(--[^\n]*)|(\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|("(?:""|[^"])*")|(`(?:[^`])*`)|(\[[^\]]*\])/g;
    const result = input.replace(re, (m, lineComment, blockComment) => {
      if (lineComment) return "";
      if (blockComment) return " ";
      return m;
    });
    const cleaned = result
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    const hadOutput = !!output;
    setInput(cleaned);
    if (hadOutput) {
      const formatted = formatSQL(cleaned, {
        indentSize,
        keyCase,
        commaPos,
        dialect,
      });
      setOutput(formatted);
      saveHistory(cleaned, formatted);
      setHistory(getHistory());
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast({ title: "Copied!", type: "success" });
  };

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    setInput(text);
    formatSqlText(text);
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target.result || "");
      setInput(text);
      formatSqlText(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDownload = (ext) => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formatted.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const outputLines = output.split("\n");

  return (
    <div className="tool-page">
      <div className="tool-page-header">
        <h1 className="tool-page-title">SQL Formatter</h1>
        <p className="tool-page-subtitle">
          Beautify and format SQL queries with syntax highlighting for all major
          dialects.
        </p>
      </div>

      <div className="tool-toolbar">
        <div className="tool-toolbar-main">
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
            className="px-2 py-1.5 text-xs rounded-md border border-border bg-background hover:bg-accent transition-colors focus:outline-none"
          >
            {[
              "MSSQL",
              "MySQL",
              "Standard SQL",
              "PostgreSQL",
              "SQLite",
              "Oracle",
            ].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
            {[2, 4, "tab"].map((v) => (
              <button
                key={v}
                onClick={() => setIndentSize(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  indentSize === v
                    ? "bg-foreground text-background"
                    : "hover:bg-accent text-muted-foreground",
                )}
              >
                {v === "tab" ? "Tab" : v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
            {["UPPERCASE", "lowercase", "Capitalize"].map((c) => (
              <button
                key={c}
                onClick={() => setKeyCase(c)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors",
                  keyCase === c
                    ? "bg-foreground text-background"
                    : "hover:bg-accent text-muted-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
            {["end", "start"].map((p) => (
              <button
                key={p}
                onClick={() => setCommaPos(p)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  commaPos === p
                    ? "bg-foreground text-background"
                    : "hover:bg-accent text-muted-foreground",
                )}
              >
                Comma {p}
              </button>
            ))}
          </div> */}

          <button
            onClick={handleMinify}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors"
          >
            Minify
          </button>

          <button
            onClick={handleRemoveComments}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-black text-white hover:opacity-80 dark:bg-white dark:text-black"
          >
            Remove Comments
          </button>

          <button
            onClick={() => setShowFindReplace(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-black text-white hover:opacity-80 dark:bg-white dark:text-black"
          >
            <Replace className="h-3.5 w-3.5" /> Find &amp; Replace{" "}
            <span className="opacity-60">Ctrl+H</span>
          </button>
        </div>

        <button
          onClick={handleFormat}
          className="tool-toolbar-action px-4 py-2 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Format <span className="opacity-60 ml-1">Ctrl+Enter</span>
        </button>
      </div>

      <div className="tool-grid">
        <div className="tool-panel">
          <div className="tool-panel-header">
            <div className="tool-panel-title">
              <span className="text-sm font-medium">Input SQL</span>
              {input && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {input.length.toLocaleString()} chars
                </span>
              )}
            </div>
            <div className="tool-panel-actions">
              <button
                onClick={handlePaste}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <ClipboardPaste className="h-3 w-3" /> Paste
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Upload className="h-3 w-3" /> Upload
              </button>
              <button
                onClick={() => {
                  setInput(SAMPLE_SQL);
                  setOutput("");
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <FileText className="h-3 w-3" /> Sample
              </button>
              <button
                onClick={() => {
                  setInput("");
                  setOutput("");
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.txt"
                className="hidden"
                onChange={handleUpload}
              />
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setOutput("");
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData("text");
              const el = e.target;
              const start = el.selectionStart ?? input.length;
              const end = el.selectionEnd ?? input.length;
              const next = input.slice(0, start) + pasted + input.slice(end);
              setInput(next);
              formatSqlText(next);
              requestAnimationFrame(() => {
                const pos = start + pasted.length;
                el.setSelectionRange(pos, pos);
              });
            }}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "Enter") handleFormat();
            }}
            placeholder='Paste SQL here or click "Sample" to load an example...'
            className="w-full min-h-[240px] sm:min-h-[420px] p-3 sm:p-4 rounded-lg border border-border bg-card font-mono text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring/30 focus:border-ring/50 transition-colors"
          />
        </div>

        <div className="tool-panel">
          <div className="tool-panel-header">
            <div className="tool-panel-title">
              <span className="text-sm font-medium">Formatted Output</span>
              {output && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {outputLines.length} lines
                </span>
              )}
            </div>
            <div className="tool-panel-actions">
              <button
                onClick={() => setWrap((w) => !w)}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                {wrap ? "Unwrap" : "Wrap"}
              </button>
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                  copied
                    ? "text-green-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => handleDownload("sql")}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Download className="h-3 w-3" /> .sql
              </button>
              <button
                onClick={() => handleDownload("txt")}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Download className="h-3 w-3" /> .txt
              </button>
              <button
                onClick={() => setShowFullscreen(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          <pre
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "a") {
                e.preventDefault();
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                sel.removeAllRanges();
                sel.addRange(range);
              }
              if (
                e.ctrlKey &&
                e.key === "c" &&
                window.getSelection()?.toString()
              ) {
                navigator.clipboard.writeText(window.getSelection().toString());
                addToast({ title: "Copied!", type: "success" });
              }
            }}
            key={animKey}
            className={cn(
              "w-full min-h-[240px] sm:min-h-[420px] p-3 sm:p-4 rounded-lg border border-border bg-card font-mono text-sm overflow-auto select-text cursor-text outline-none focus:ring-1 focus:ring-ring/30 focus:border-ring/50 transition-colors",
              wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
            )}
          >
            {output ? (
              highlightedOutput
            ) : (
              <span className="text-muted-foreground">
                Formatted output will appear here...
              </span>
            )}
          </pre>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={() => setShowHistory((h) => !h)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <History className="h-4 w-4" />
          History ({history.length})
          {showHistory ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
        {showHistory && (
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-md hover:bg-accent/50 group"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()} —{" "}
                      </span>
                      <span className="text-xs font-mono truncate">
                        {entry.preview}…
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setInput(entry.input);
                        setOutput(entry.output);
                      }}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    localStorage.removeItem(HISTORY_KEY);
                    setHistory([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors mt-1"
                >
                  Clear History
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showFullscreen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">Formatted SQL</span>
            <button
              onClick={() => setShowFullscreen(false)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-sm whitespace-pre-wrap">
            {output ? (
              highlightedOutput
            ) : (
              <span className="text-muted-foreground">No output yet.</span>
            )}
          </div>
        </div>
      )}
      <FindReplaceModal
        open={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        value={input}
        onChange={setInput}
        secondaryValue={output}
        onSecondaryChange={setOutput}
        suggestions={[
          {
            label: "Escape single quotes",
            description: "",
            find: "'",
            replace: "''",
          },
        ]}
      />
      <ScrollToTop />
    </div>
  );
}
