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
  Replace,
} from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";
import ScrollToTop from "../components/ScrollToTop";
import JsonTree from "../components/JsonTree";
import FindReplaceModal from "../components/FindReplaceModal";
import ResizableSplit from "../components/ResizableSplit";
import { useUndoHistory } from "../hooks/use-undo-history";

const HISTORY_KEY = "devtoolkit_json_history";
const STATE_KEY = "devtoolkit_json_state";
// Above this size, skip syntax highlighting / eager tree mounting and
// localStorage persistence — those are what actually freeze the tab on
// huge pastes. Plain text stays fully usable (copy/download/browser find).
const LARGE_JSON_THRESHOLD = 1_000_000; // ~1MB of text
const PERSIST_MAX_SIZE = 2_000_000; // don't localStorage.setItem huge blobs
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
  // Skip persisting huge payloads — stringifying + storing multi-MB blobs
  // on every format is itself a perf hit, and can throw QuotaExceededError.
  if (input.length > PERSIST_MAX_SIZE || output.length > PERSIST_MAX_SIZE)
    return;
  const history = getHistory();
  const entry = {
    timestamp: Date.now(),
    preview: input.slice(0, 60),
    input,
    output,
  };
  const updated = [entry, ...history].slice(0, 10);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // storage quota exceeded — history is best-effort, not critical
  }
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
  // Same guard as saveHistory — never persist huge blobs on every keystroke.
  if (
    state.input.length > PERSIST_MAX_SIZE ||
    state.output.length > PERSIST_MAX_SIZE
  )
    return;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // storage quota exceeded — non-critical, state just won't persist
  }
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

// Plain, unhighlighted text view for very large output. Syntax highlighting
// tokenizes and wraps every value in its own element — fine for normal
// output, but for megabyte-scale JSON that's tens of thousands of DOM
// nodes built synchronously, which is what actually freezes the tab.
// A plain <textarea> has none of that cost and stays fully usable
// (scrollable, editable, copyable, searchable via the browser's find).
function PlainTextPane({ output, setOutput, wrap }) {
  return (
    <div className="w-full min-h-[240px] sm:min-h-[420px] flex flex-col">
      <div className="flex items-start gap-2 px-3 sm:px-4 pt-2 text-xs text-amber-600 dark:text-amber-400">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Output is large — syntax highlighting is disabled for performance.
          Text is still fully editable and copyable.
        </span>
      </div>
      <textarea
        value={output}
        onChange={(e) => setOutput(e.target.value)}
        spellCheck={false}
        className={cn(
          "flex-1 w-full p-3 sm:p-4 bg-transparent font-mono text-sm focus:outline-none resize-none",
          wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto",
        )}
      />
    </div>
  );
}

export default function JsonFormatter() {
  const initialState = getState();
  const [input, setInputRaw] = useState(initialState.input);
  const validateInputRef = useRef(() => {});
  const { record: recordInputUndo, handleKeyDown: handleInputUndoKeyDown } =
    useUndoHistory(input, setInputRaw, (restored) => validateInputRef.current(restored));
  const setInput = useCallback(
    (val) => {
      setInputRaw((prev) => {
        recordInputUndo(prev);
        return typeof val === "function" ? val(prev) : val;
      });
    },
    [recordInputUndo],
  );
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
  const [isFormatting, setIsFormatting] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const fileInputRef = useRef(null);

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
  const isLargeOutput = output.length > LARGE_JSON_THRESHOLD;

  // Memoize search — avoids re-walking large JSON trees on every render
  const searchResults = useMemo(() => {
    if (!parsedOutput || !searchQuery.trim() || isLargeOutput) return [];
    return searchJson(parsedOutput, searchQuery.trim(), searchMode);
  }, [parsedOutput, searchQuery, searchMode, isLargeOutput]);

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
  validateInputRef.current = (val) => {
    validateInput(val);
    setOutput("");
  };

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
      // For large input, defer the actual parse/stringify to the next
      // frame so the browser can paint the "Formatting…" state first —
      // otherwise a huge paste blocks the main thread with no feedback
      // and the tab looks hung.
      const run = () => {
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
        } finally {
          setIsFormatting(false);
        }
      };

      if (text.length > LARGE_JSON_THRESHOLD) {
        setIsFormatting(true);
        setTimeout(run, 0);
      } else {
        run();
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
          disabled={isFormatting}
          className="tool-toolbar-action px-4 py-2 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isFormatting ? "Formatting…" : "Format"}{" "}
          <span className="opacity-60 ml-1">Ctrl+Enter</span>
        </button>
      </div>

      {parsedOutput && !isLargeOutput && (
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

      <ResizableSplit
        storageKey="devtoolkit_json_split"
        left={
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
              const el = e.target;
              const start = el.selectionStart ?? input.length;
              const end = el.selectionEnd ?? input.length;
              const next = input.slice(0, start) + pasted + input.slice(end);
              handleInput(next);
              formatJsonText(next);
              requestAnimationFrame(() => {
                const pos = start + pasted.length;
                el.setSelectionRange(pos, pos);
              });
            }}
            onKeyDown={(e) => {
              if (handleInputUndoKeyDown(e)) return;
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
        }
        right={
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
              {outputIsObjectLike && !isLargeOutput && (
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
                const selected = window.getSelection()?.toString();
                if (selected) return; // let the browser copy the selection as-is
                e.preventDefault();
                // Nothing selected — copy the full JSON (tree may have collapsed nodes)
                navigator.clipboard.writeText(output);
                addToast({ title: "Copied!", type: "success" });
              }
            }}
            className={cn(
              "w-full min-h-[240px] sm:min-h-[420px] rounded-lg border border-border bg-card font-mono text-sm transition-colors focus-within:ring-1 focus-within:ring-ring/30 focus-within:border-ring/50 outline-none focus:ring-1 focus:ring-ring/30 focus:border-ring/50",
              output &&
                (isLargeOutput || viewMode === "raw" || !outputIsObjectLike)
                ? "flex"
                : "overflow-auto p-3 sm:p-4 sm:pl-6",
            )}
          >
            {!output && !isFormatting && (
              <span className="text-muted-foreground p-3 sm:p-4">
                Formatted output will appear here...
              </span>
            )}
            {isFormatting && (
              <span className="text-muted-foreground p-3 sm:p-4">
                Formatting large JSON…
              </span>
            )}
            {output && isLargeOutput && (
              <PlainTextPane output={output} setOutput={setOutput} wrap={wrap} />
            )}
            {output && !isLargeOutput && viewMode === "tree" && outputIsObjectLike && (
              <JsonTree data={parsedOutput} defaultCollapsed={1} />
            )}
            {output &&
              !isLargeOutput &&
              (viewMode === "raw" || !outputIsObjectLike) && (
                <RawHighlightPane
                  output={output}
                  setOutput={setOutput}
                  wrap={wrap}
                />
              )}
          </div>
        </div>
        }
      />

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
          {parsedOutput && !isLargeOutput && (
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
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-card font-mono text-sm flex flex-col">
            {!output && (
              <span className="text-muted-foreground p-4 pl-6">
                No output yet.
              </span>
            )}
            {output && isLargeOutput && (
              <PlainTextPane output={output} setOutput={setOutput} wrap={wrap} />
            )}
            {output && !isLargeOutput && viewMode === "tree" && outputIsObjectLike && (
              <div className="p-4 pl-6">
                <JsonTree data={parsedOutput} defaultCollapsed={1} />
              </div>
            )}
            {output &&
              !isLargeOutput &&
              (viewMode === "raw" || !outputIsObjectLike) && (
                <code className="whitespace-pre-wrap p-4 pl-6">
                  {highlightJson(output)}
                </code>
              )}
          </div>
        </div>
      )}
      <FindReplaceModal
        open={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        value={input}
        onChange={(next) => {
          setInput(next);
          validateInput(next);
        }}
        secondaryValue={output}
        onSecondaryChange={setOutput}
      />
      <ScrollToTop />
    </div>
  );
}
