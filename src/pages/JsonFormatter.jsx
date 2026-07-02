import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Copy,
  Download,
  Upload,
  Trash2,
  History,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Check,
  AlertCircle,
  ClipboardPaste,
  RotateCcw,
  FileText,
} from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";
import ScrollToTop from "../components/ScrollToTop";
import JsonTree from "../components/JsonTree";

const HISTORY_KEY = "devtoolkit_json_history";
const STATE_KEY = "devtoolkit_json_state";
const SAMPLE_JSON = JSON.stringify(
  {
    name: "DevToolkit",
    version: "1.0.0",
    tools: ["json", "sql", "stringify", "diff"],
    config: {
      theme: "dark",
      indent: 2,
      sortKeys: false,
    },
    stats: {
      users: 10000,
      rating: 4.9,
      offline: true,
    },
    tags: ["developer", "utility", "formatting"],
    meta: null,
    active: true,
  },
  null,
  0,
);

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

function highlightJsonLine(line, key) {
  const tokens = [];
  const re =
    /("(?:[^"\\]|\\.)*")\s*:|"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|true|false|null|[{}[\],]/g;
  let lastIndex = 0;
  let match;
  let k = 0;
  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIndex)
      tokens.push(<span key={k++}>{line.slice(lastIndex, match.index)}</span>);
    const val = match[0];
    if (val.endsWith(":"))
      tokens.push(<span key={k++} className="text-blue-600 dark:text-blue-400">{val}</span>);
    else if (val.startsWith('"'))
      tokens.push(<span key={k++} className="text-green-500 dark:text-green-400">{val}</span>);
    else if (match[2] !== undefined)
      tokens.push(<span key={k++} className="text-orange-500 dark:text-orange-400">{val}</span>);
    else if (val === "true" || val === "false")
      tokens.push(<span key={k++} className="text-purple-500 dark:text-purple-400">{val}</span>);
    else if (val === "null")
      tokens.push(<span key={k++} className="text-red-500 dark:text-red-400">{val}</span>);
    else
      tokens.push(<span key={k++}>{val}</span>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < line.length)
    tokens.push(<span key={k++}>{line.slice(lastIndex)}</span>);
  return tokens;
}

function highlightJson(jsonStr) {
  const lines = jsonStr.split("\n");
  return lines.map((line, li) => (
    <span
      key={li}
      className="output-line"
      style={{ "--line-delay": `${Math.min(li, 40) * 0.018}s` }}
    >
      {highlightJsonLine(line, li)}
      {li < lines.length - 1 ? "\n" : ""}
    </span>
  ));
}

function repairJson(str) {
  let s = str.trim();
  s = s.replace(/,(\s*[}\]])/g, "$1");
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
  s = s.replace(/:\s*'([^']*)'/g, ': "$1"');
  return s;
}

function sortKeysDeep(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeysDeep(obj[k]);
        return acc;
      }, {});
  }
  return obj;
}

function searchJson(obj, query, mode, path = "") {
  const results = [];
  const q = query.toLowerCase();

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const itemPath = `${path}[${i}]`;
      if (item !== null && typeof item === "object") {
        results.push(...searchJson(item, query, mode, itemPath));
      } else {
        // primitive inside array — check as value
        const valStr = String(item);
        const valMatch =
          (mode === "value" || mode === "both") &&
          valStr.toLowerCase().includes(q);
        if (valMatch) {
          results.push({
            path: itemPath,
            key: String(i),
            value: valStr,
            matchedKey: false,
            matchedValue: true,
          });
        }
      }
    });
  } else if (obj !== null && typeof obj === "object") {
    Object.entries(obj).forEach(([k, v]) => {
      const keyPath = path ? `${path}.${k}` : k;
      const keyMatch =
        (mode === "key" || mode === "both") && k.toLowerCase().includes(q);

      if (v !== null && typeof v === "object") {
        // container — check key match for the container itself, then recurse
        if (keyMatch) {
          results.push({
            path: keyPath,
            key: k,
            value: Array.isArray(v) ? "[array]" : "[object]",
            matchedKey: true,
            matchedValue: false,
          });
        }
        results.push(...searchJson(v, query, mode, keyPath));
      } else {
        // primitive value
        const valStr = v === null ? "null" : String(v);
        const valMatch =
          (mode === "value" || mode === "both") &&
          valStr.toLowerCase().includes(q);
        if (keyMatch || valMatch) {
          results.push({
            path: keyPath,
            key: k,
            value: valStr,
            matchedKey: keyMatch,
            matchedValue: valMatch,
          });
        }
      }
    });
  }
  return results;
}

function highlightJsonToHtml(jsonStr) {
  const re =
    /("(?:[^"\\]|\\.)*")\s*:|"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|true|false|null|[{}[\],]/g;
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let result = "";
  let lastIndex = 0;
  let match;
  while ((match = re.exec(jsonStr)) !== null) {
    if (match.index > lastIndex)
      result += esc(jsonStr.slice(lastIndex, match.index));
    const val = match[0];
    if (val.endsWith(":"))
      result += `<span class="text-blue-600 dark:text-blue-400">${esc(val)}</span>`;
    else if (val.startsWith('"'))
      result += `<span class="text-green-500 dark:text-green-400">${esc(val)}</span>`;
    else if (match[2] !== undefined)
      result += `<span class="text-orange-500 dark:text-orange-400">${esc(val)}</span>`;
    else if (val === "true" || val === "false")
      result += `<span class="text-purple-500 dark:text-purple-400">${esc(val)}</span>`;
    else if (val === "null")
      result += `<span class="text-red-500 dark:text-red-400">${esc(val)}</span>`;
    else
      result += esc(val);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < jsonStr.length) result += esc(jsonStr.slice(lastIndex));
  return result;
}

function RawHighlightPane({ output, setOutput, wrap }) {
  const preRef = useRef(null);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.innerHTML = highlightJsonToHtml(output);
    }
  }, [output]);

  return (
    <pre
      ref={preRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => setOutput(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        if (e.ctrlKey && e.key === "a") {
          e.preventDefault();
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(e.currentTarget);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }}
      className={cn(
        "panel-animate w-full min-h-[240px] sm:min-h-[420px] p-3 sm:p-4 bg-transparent font-mono text-sm focus:outline-none overflow-auto",
        wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto",
      )}
    />
  );
}

export default function JsonFormatter() {
  const initialState = getState();
  const [input, setInput] = useState(initialState.input);
  const [output, setOutput] = useState(initialState.output);
  const [error, setError] = useState(null);
  const [indent, setIndent] = useState(2);
  const [repairMode, setRepairMode] = useState(false);
  const [sortKeys, setSortKeys] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(getHistory);
  const [copied, setCopied] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState("tree"); // "tree" | "raw"
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("both");
  const [animKey, setAnimKey] = useState(0);
  const fileInputRef = useRef(null);

  const parsedOutput = useMemo(() => {
    if (!output) return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [output]);

  const outputIsObjectLike =
    parsedOutput !== null && typeof parsedOutput === "object";

  // Memoize search — avoids re-walking large JSON trees on every render
  const searchResults = useMemo(() => {
    if (!parsedOutput || !searchQuery.trim()) return [];
    return searchJson(parsedOutput, searchQuery.trim(), searchMode);
  }, [parsedOutput, searchQuery, searchMode]);

  useEffect(() => {
    setState({ input, output });
  }, [input, output]);

  const validateTimerRef = useRef(null);

  const validateInput = useCallback(
    (val) => {
      clearTimeout(validateTimerRef.current);
      if (!val.trim()) {
        setError(null);
        return;
      }
      // Debounce validation — avoids parsing huge JSON on every keystroke
      validateTimerRef.current = setTimeout(() => {
        try {
          JSON.parse(repairMode ? repairJson(val) : val);
          setError(null);
        } catch (e) {
          setError(e.message);
        }
      }, 300);
    },
    [repairMode],
  );

  const handleInput = (val) => {
    setInput(val);
    validateInput(val);
    setOutput("");
  };

  const formatJsonText = useCallback(
    (text) => {
      if (!text.trim()) {
        setOutput("");
        setError(null);
        return;
      }
      try {
        const toparse = repairMode ? repairJson(text) : text;
        let parsed = JSON.parse(toparse);
        if (sortKeys) parsed = sortKeysDeep(parsed);
        const indentVal = indent === "tab" ? "\t" : indent;
        const formatted = JSON.stringify(parsed, null, indentVal);
        setOutput(formatted);
        setAnimKey((k) => k + 1);
        setError(null);
        saveHistory(text, formatted);
        setHistory(getHistory());
      } catch (e) {
        setError(e.message);
        setOutput("");
      }
    },
    [repairMode, sortKeys, indent],
  );

  const handleFormat = () => {
    if (!input.trim()) {
      setError("Input is empty.");
      return;
    }
    formatJsonText(input);
  };

  const handleMinify = () => {
    if (!input.trim()) {
      setError("Input is empty.");
      return;
    }
    try {
      const toparse = repairMode ? repairJson(input) : input;
      const parsed = JSON.parse(toparse);
      const minified = JSON.stringify(parsed);
      setOutput(minified);
      setError(null);
    } catch (e) {
      setError(e.message);
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
    handleInput(text);
    formatJsonText(text);
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleInput(ev.target.result);
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

  const inputValid = !error && input.trim();
  const inputInvalid = !!error && input.trim();

  return (
    <div className="tool-page">
      <div className="tool-page-header">
        <h1 className="tool-page-title">JSON Formatter</h1>
        <p className="tool-page-subtitle">
          Validate, format, minify, sort and repair JSON with syntax
          highlighting.
        </p>
      </div>

      <div className="tool-toolbar">
        <div className="tool-toolbar-main">
          <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
            {[2, 4, "tab"].map((v) => (
              <button
                key={v}
                onClick={() => setIndent(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  indent === v
                    ? "bg-foreground text-background"
                    : "hover:bg-accent text-muted-foreground",
                )}
              >
                {v === "tab" ? "Tab" : `${v} Spaces`}
              </button>
            ))}
          </div>

          <button
            onClick={handleMinify}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors"
          >
            Minify
          </button>

          <button
            onClick={() => setRepairMode((r) => !r)}
            className={cn(
              "px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
              repairMode
                ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                : "border-border hover:bg-accent",
            )}
          >
            Repair JSON {repairMode ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setSortKeys((s) => !s)}
            className={cn(
              "px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
              sortKeys
                ? "border-purple-500/50 bg-purple-500/10 text-purple-400"
                : "border-border hover:bg-accent",
            )}
          >
            Sort Keys {sortKeys ? "ON" : "OFF"}
          </button>
        </div>

        <button
          onClick={handleFormat}
          className="tool-toolbar-action px-4 py-2 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Format <span className="opacity-60 ml-1">Ctrl+Enter</span>
        </button>
      </div>

      {parsedOutput && (
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keys or values..."
              className="flex-1 px-3 py-1.5 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring/30"
            />
            <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
              {["key", "value", "both"].map((m) => (
                <button
                  key={m}
                  onClick={() => setSearchMode(m)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs font-medium transition-colors capitalize",
                    searchMode === m
                      ? "bg-foreground text-background"
                      : "hover:bg-accent text-muted-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {searchQuery.trim() &&
            (() => {
              const results = searchResults;
              return (
                <div className="mt-2">
                  {results.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No matches found.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      <p className="text-xs text-muted-foreground mb-1">
                        {results.length} match{results.length !== 1 ? "es" : ""}{" "}
                        found
                      </p>
                      {results.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs font-mono p-1.5 rounded hover:bg-accent/50"
                        >
                          <span className="text-blue-400 shrink-0">
                            {r.path}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span
                            className={cn(
                              r.matchedValue
                                ? "text-green-400"
                                : "text-foreground",
                            )}
                          >
                            {r.value.length > 80
                              ? r.value.slice(0, 80) + "…"
                              : r.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      )}

      <div className="tool-grid">
        <div className="tool-panel">
          <div className="tool-panel-header">
            <div className="tool-panel-title">
              <span className="text-sm font-medium">Input JSON</span>
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
                  setInput(SAMPLE_JSON);
                  validateInput(SAMPLE_JSON);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <FileText className="h-3 w-3" /> Sample
              </button>
              <button
                onClick={() => {
                  setInput("");
                  setOutput("");
                  setError(null);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt"
                className="hidden"
                onChange={handleUpload}
              />
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData("text");
              handleInput(pasted);
              formatJsonText(pasted);
            }}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "Enter") handleFormat();
            }}
            placeholder='Paste JSON here or click "Sample" to load an example...'
            className={cn(
              "w-full min-h-[240px] sm:min-h-[420px] p-3 sm:p-4 rounded-lg border bg-card font-mono text-sm resize-y transition-colors focus:outline-none focus:ring-1",
              inputInvalid
                ? "border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50"
                : "border-border focus:ring-ring/30 focus:border-ring/50",
            )}
          />
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="font-mono">{error}</span>
            </div>
          )}
        </div>

        <div className="tool-panel">
          <div className="tool-panel-header">
            <div className="tool-panel-title">
              <span className="text-sm font-medium">Formatted Output</span>
              {output && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {output.split("\n").length} lines
                </span>
              )}
            </div>
            <div className="tool-panel-actions">
              {outputIsObjectLike && (
                <div className="flex items-center border border-border rounded-md overflow-hidden mr-1">
                  <button
                    onClick={() => setViewMode("tree")}
                    className={cn(
                      "px-2 py-1 text-xs font-medium transition-colors",
                      viewMode === "tree"
                        ? "bg-foreground text-background"
                        : "hover:bg-accent text-muted-foreground",
                    )}
                    title="Tree view (expandable)"
                  >
                    Tree
                  </button>
                  <button
                    onClick={() => setViewMode("raw")}
                    className={cn(
                      "px-2 py-1 text-xs font-medium transition-colors",
                      viewMode === "raw"
                        ? "bg-foreground text-background"
                        : "hover:bg-accent text-muted-foreground",
                    )}
                    title="Raw text view"
                  >
                    Raw
                  </button>
                </div>
              )}
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
                onClick={() => handleDownload("json")}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Download className="h-3 w-3" /> .json
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
          <div
            key={animKey}
            tabIndex={
              output && viewMode === "tree" && outputIsObjectLike ? 0 : -1
            }
            onKeyDown={(e) => {
              if (!(output && viewMode === "tree" && outputIsObjectLike))
                return;
              if (e.ctrlKey && e.key === "a") {
                e.preventDefault();
                // Select all visible text in the tree div
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                sel.removeAllRanges();
                sel.addRange(range);
              }
              if (e.ctrlKey && e.key === "c") {
                e.preventDefault();
                // Always copy the full JSON — tree may have collapsed nodes
                navigator.clipboard.writeText(output);
                addToast({ title: "Copied!", type: "success" });
              }
            }}
            className={cn(
              "w-full min-h-[240px] sm:min-h-[420px] rounded-lg border border-border bg-card font-mono text-sm transition-colors focus-within:ring-1 focus-within:ring-ring/30 focus-within:border-ring/50 outline-none focus:ring-1 focus:ring-ring/30 focus:border-ring/50",
              output && (viewMode === "raw" || !outputIsObjectLike)
                ? "flex"
                : "overflow-auto p-3 sm:p-4 sm:pl-6",
            )}
          >
            {!output && (
              <span className="text-muted-foreground p-3 sm:p-4">
                Formatted output will appear here...
              </span>
            )}
            {output && viewMode === "tree" && outputIsObjectLike && (
              <JsonTree data={parsedOutput} defaultCollapsed={1} />
            )}
            {output && (viewMode === "raw" || !outputIsObjectLike) && (
              <RawHighlightPane
                output={output}
                setOutput={setOutput}
                wrap={wrap}
              />
            )}
          </div>
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
              <p className="text-xs text-muted-foreground">
                No history yet. Format some JSON to see it here.
              </p>
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
                        validateInput(entry.input);
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
            <span className="font-semibold">Formatted Output</span>
            <button
              onClick={() => setShowFullscreen(false)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          {parsedOutput && (
            <div className="mb-3 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search keys or values..."
                  className="flex-1 px-3 py-1.5 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
                <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
                  {["key", "value", "both"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setSearchMode(m)}
                      className={cn(
                        "px-2.5 py-1.5 text-xs font-medium transition-colors capitalize",
                        searchMode === m
                          ? "bg-foreground text-background"
                          : "hover:bg-accent text-muted-foreground",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {searchQuery.trim() &&
                (() => {
                  const results = searchResults;
                  return (
                    <div className="mt-2">
                      {results.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No matches found.
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          <p className="text-xs text-muted-foreground mb-1">
                            {results.length} match
                            {results.length !== 1 ? "es" : ""} found
                          </p>
                          {results.map((r, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs font-mono p-1.5 rounded hover:bg-accent/50"
                            >
                              <span className="text-blue-400 shrink-0">
                                {r.path}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span
                                className={cn(
                                  r.matchedValue
                                    ? "text-green-400"
                                    : "text-foreground",
                                )}
                              >
                                {r.value.length > 80
                                  ? r.value.slice(0, 80) + "…"
                                  : r.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
          )}
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-card p-4 pl-6 font-mono text-sm">
            {!output && (
              <span className="text-muted-foreground">No output yet.</span>
            )}
            {output && viewMode === "tree" && outputIsObjectLike && (
              <JsonTree data={parsedOutput} defaultCollapsed={1} />
            )}
            {output && (viewMode === "raw" || !outputIsObjectLike) && (
              <code className="whitespace-pre-wrap">
                {highlightJson(output)}
              </code>
            )}
          </div>
        </div>
      )}
      <ScrollToTop />
    </div>
  );
}
