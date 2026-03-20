import { useState, useRef } from "react";
import { Copy, Download, Upload, Trash2, History, ChevronDown, ChevronUp, Check, ClipboardPaste, RotateCcw, FileText } from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";

const HISTORY_KEY = "devtoolkit_sql_history";

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
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN",
  "FULL JOIN", "CROSS JOIN", "ON", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "ALTER",
  "DROP", "WITH", "AS", "AND", "OR", "NOT", "IN", "EXISTS", "UNION", "UNION ALL",
  "CASE", "WHEN", "THEN", "ELSE", "END", "DISTINCT", "TOP", "BETWEEN", "LIKE",
  "IS", "NULL", "ASC", "DESC", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "INDEX",
  "UNIQUE", "IF", "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION", "OVER", "PARTITION",
  "RANK", "ROW_NUMBER", "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF",
  "CAST", "CONVERT", "EXTRACT", "DATE", "SUBSTRING", "LEFT", "RIGHT", "TRIM",
  "UPPER", "LOWER", "LENGTH", "CONCAT", "REPLACE"
];

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(input, output) {
  const history = getHistory();
  const entry = { timestamp: Date.now(), preview: input.slice(0, 60), input, output };
  const updated = [entry, ...history].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

function applyKeywordCase(word, keyCase) {
  const upper = word.toUpperCase();
  if (keyCase === "UPPERCASE") return upper;
  if (keyCase === "lowercase") return word.toLowerCase();
  if (keyCase === "Capitalize") return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return word;
}

function formatSQL(sql, { indentSize = 2, keyCase = "UPPERCASE", commaPos = "end" } = {}) {
  const indent = indentSize === "tab" ? "\t" : " ".repeat(Number(indentSize));

  const normalizeKeywords = (s) => {
    let result = s;
    const sorted = [...SQL_KEYWORDS].sort((a, b) => b.length - a.length);
    for (const kw of sorted) {
      const re = new RegExp(`\\b${kw}\\b`, "gi");
      result = result.replace(re, applyKeywordCase(kw, keyCase));
    }
    return result;
  };

  let s = sql.replace(/\s+/g, " ").trim();
  s = normalizeKeywords(s);

  const toUpper = (k) => applyKeywordCase(k, keyCase);

  const clauses = [
    toUpper("SELECT"), toUpper("FROM"), toUpper("WHERE"),
    toUpper("GROUP BY"), toUpper("ORDER BY"), toUpper("HAVING"), toUpper("LIMIT"),
    toUpper("LEFT JOIN"), toUpper("RIGHT JOIN"), toUpper("INNER JOIN"),
    toUpper("OUTER JOIN"), toUpper("FULL JOIN"), toUpper("CROSS JOIN"), toUpper("JOIN"),
    toUpper("ON"), toUpper("UNION ALL"), toUpper("UNION"),
    toUpper("INSERT INTO"), toUpper("VALUES"), toUpper("UPDATE"), toUpper("SET"),
    toUpper("DELETE FROM"), toUpper("WITH"), toUpper("CASE"), toUpper("WHEN"),
    toUpper("THEN"), toUpper("ELSE"), toUpper("END"),
  ];

  for (const clause of clauses) {
    const re = new RegExp(`(\\s+)(${clause.replace(/\s+/g, "\\s+")})\\s+`, "gi");
    s = s.replace(re, (_, space, c) => `\n${applyKeywordCase(c, keyCase)} `);
  }

  const lines = s.split("\n").map(l => l.trim()).filter(Boolean);

  const formatted = lines.map((line, i) => {
    const upper = line.toUpperCase();
    if (upper.startsWith(toUpper("SELECT").toUpperCase())) {
      const rest = line.slice(line.indexOf(" ") + 1);
      const cols = splitTopLevel(rest, ",");
      if (cols.length > 1) {
        const sep = commaPos === "end" ? ",\n" + indent : "\n" + indent + ", ";
        return `${applyKeywordCase("SELECT", keyCase)} ${cols[0].trim()}${sep}${cols.slice(1).map(c => c.trim()).join(sep)}`;
      }
    }
    return line;
  });

  return formatted.join("\n").replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");
}

function splitTopLevel(str, sep) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of str) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function highlightSQL(sql) {
  const lines = sql.split("\n");
  return lines.map((line, li) => {
    const tokens = tokenizeLine(line);
    return (
      <span key={li}>
        {tokens}
        {li < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}

function tokenizeLine(line) {
  const re = /--.*$|\/\*[\s\S]*?\*\/|'[^']*'|"[^"]*"|\b(\d+(?:\.\d+)?)\b|\b([A-Z_][A-Z0-9_]*)\b|\S/gi;
  const tokens = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={key++}>{line.slice(lastIndex, match.index)}</span>);
    }
    const val = match[0];
    if (val.startsWith("--") || val.startsWith("/*")) {
      tokens.push(<span key={key++} className="text-muted-foreground italic">{val}</span>);
    } else if (val.startsWith("'") || val.startsWith('"')) {
      tokens.push(<span key={key++} className="text-green-500 dark:text-green-400">{val}</span>);
    } else if (match[1] !== undefined) {
      tokens.push(<span key={key++} className="text-orange-500 dark:text-orange-400">{val}</span>);
    } else if (match[2] !== undefined && SQL_KEYWORDS.includes(val.toUpperCase())) {
      tokens.push(<span key={key++} className="text-blue-500 dark:text-blue-400 font-bold">{val}</span>);
    } else {
      tokens.push(<span key={key++}>{val}</span>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < line.length) tokens.push(<span key={key++}>{line.slice(lastIndex)}</span>);
  return tokens;
}

export default function SqlFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [dialect, setDialect] = useState("Standard SQL");
  const [indentSize, setIndentSize] = useState(2);
  const [keyCase, setKeyCase] = useState("UPPERCASE");
  const [commaPos, setCommaPos] = useState("end");
  const [wrap, setWrap] = useState(true);
  const [lineNums, setLineNums] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(getHistory);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const handleFormat = () => {
    if (!input.trim()) return;
    const formatted = formatSQL(input, { indentSize, keyCase, commaPos });
    setOutput(formatted);
    saveHistory(input, formatted);
    setHistory(getHistory());
  };

  const handleMinify = () => {
    if (!input.trim()) return;
    const minified = input.replace(/\s+/g, " ").trim();
    setOutput(minified);
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
    setOutput("");
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setInput(ev.target.result); setOutput(""); };
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
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">SQL Formatter</h1>
        <p className="text-sm text-muted-foreground">Beautify and format SQL queries with syntax highlighting for all major dialects.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg border border-border bg-card">
        <select
          value={dialect}
          onChange={e => setDialect(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-md border border-border bg-background hover:bg-accent transition-colors focus:outline-none"
        >
          {["Standard SQL", "MySQL", "PostgreSQL", "SQLite", "MSSQL", "Oracle"].map(d => (
            <option key={d}>{d}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
          {[2, 4, "tab"].map(v => (
            <button
              key={v}
              onClick={() => setIndentSize(v)}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors", indentSize === v ? "bg-foreground text-background" : "hover:bg-accent text-muted-foreground")}
            >
              {v === "tab" ? "Tab" : v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
          {["UPPERCASE", "lowercase", "Capitalize"].map(c => (
            <button
              key={c}
              onClick={() => setKeyCase(c)}
              className={cn("px-2.5 py-1.5 text-xs font-medium transition-colors", keyCase === c ? "bg-foreground text-background" : "hover:bg-accent text-muted-foreground")}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
          {["end", "start"].map(p => (
            <button
              key={p}
              onClick={() => setCommaPos(p)}
              className={cn("px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap", commaPos === p ? "bg-foreground text-background" : "hover:bg-accent text-muted-foreground")}
            >
              Comma {p}
            </button>
          ))}
        </div>

        <button
          onClick={handleFormat}
          className="px-4 py-1.5 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Format <span className="opacity-60 ml-1">Ctrl+Enter</span>
        </button>
        <button onClick={handleMinify} className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors">
          Minify
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Input SQL</span>
              {input && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{input.length.toLocaleString()} chars</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handlePaste} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                <ClipboardPaste className="h-3 w-3" /> Paste
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                <Upload className="h-3 w-3" /> Upload
              </button>
              <button
                onClick={() => { setInput(SAMPLE_SQL); setOutput(""); }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <FileText className="h-3 w-3" /> Sample
              </button>
              <button onClick={() => { setInput(""); setOutput(""); }} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                <Trash2 className="h-3 w-3" /> Clear
              </button>
              <input ref={fileInputRef} type="file" accept=".sql,.txt" className="hidden" onChange={handleUpload} />
            </div>
          </div>
          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); setOutput(""); }}
            onKeyDown={e => { if (e.ctrlKey && e.key === "Enter") handleFormat(); }}
            placeholder='Paste SQL here or click "Sample" to load an example...'
            className="w-full min-h-[420px] p-4 rounded-lg border border-border bg-card font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Formatted Output</span>
              {output && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{outputLines.length} lines</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setLineNums(l => !l)} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                {lineNums ? "Hide #" : "Line #"}
              </button>
              <button onClick={() => setWrap(w => !w)} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                {wrap ? "Unwrap" : "Wrap"}
              </button>
              <button onClick={handleCopy} className={cn("flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors", copied ? "text-green-400" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={() => handleDownload("sql")} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                <Download className="h-3 w-3" /> .sql
              </button>
              <button onClick={() => handleDownload("txt")} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                <Download className="h-3 w-3" /> .txt
              </button>
            </div>
          </div>
          <div className={cn(
            "w-full min-h-[420px] rounded-lg border border-border bg-card font-mono text-xs overflow-auto flex",
            wrap ? "" : "overflow-x-auto"
          )}>
            {lineNums && output && (
              <div className="text-muted-foreground/50 text-right pr-3 pl-3 pt-4 select-none border-r border-border">
                {outputLines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            )}
            <div className={cn("p-4 flex-1", wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>
              {output ? highlightSQL(output) : (
                <span className="text-muted-foreground">Formatted output will appear here...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={() => setShowHistory(h => !h)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <History className="h-4 w-4" />
          History ({history.length})
          {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showHistory && (
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-md hover:bg-accent/50 group">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()} — </span>
                      <span className="text-xs font-mono truncate">{entry.preview}…</span>
                    </div>
                    <button
                      onClick={() => { setInput(entry.input); setOutput(entry.output); }}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors mt-1"
                >
                  Clear History
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
