import { useState, useCallback, useRef } from "react";
import { Copy, Download, Upload, Trash2, History, ChevronDown, ChevronUp, Maximize2, Check, AlertCircle, ClipboardPaste, RotateCcw, FileText } from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";

const HISTORY_KEY = "devtoolkit_json_history";
const SAMPLE_JSON = JSON.stringify({
  name: "DevToolkit",
  version: "1.0.0",
  tools: ["json", "sql", "stringify", "diff"],
  config: {
    theme: "dark",
    indent: 2,
    sortKeys: false
  },
  stats: {
    users: 10000,
    rating: 4.9,
    offline: true
  },
  tags: ["developer", "utility", "formatting"],
  meta: null,
  active: true
}, null, 0);

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

function highlightJson(jsonStr) {
  const tokens = [];
  const re = /("(?:[^"\\]|\\.)*")\s*:|"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|true|false|null|[{}[\],]/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = re.exec(jsonStr)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={key++}>{jsonStr.slice(lastIndex, match.index)}</span>);
    }
    const val = match[0];
    if (val.endsWith(":")) {
      tokens.push(<span key={key++} className="text-blue-400 dark:text-blue-400 text-blue-600">{val}</span>);
    } else if (val.startsWith('"')) {
      tokens.push(<span key={key++} className="text-green-500 dark:text-green-400">{val}</span>);
    } else if (match[2] !== undefined) {
      tokens.push(<span key={key++} className="text-orange-500 dark:text-orange-400">{val}</span>);
    } else if (val === "true" || val === "false") {
      tokens.push(<span key={key++} className="text-purple-500 dark:text-purple-400">{val}</span>);
    } else if (val === "null") {
      tokens.push(<span key={key++} className="text-red-500 dark:text-red-400">{val}</span>);
    } else {
      tokens.push(<span key={key++}>{val}</span>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < jsonStr.length) tokens.push(<span key={key++}>{jsonStr.slice(lastIndex)}</span>);
  return tokens;
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
    return Object.keys(obj).sort().reduce((acc, k) => {
      acc[k] = sortKeysDeep(obj[k]);
      return acc;
    }, {});
  }
  return obj;
}

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [indent, setIndent] = useState(2);
  const [repairMode, setRepairMode] = useState(false);
  const [sortKeys, setSortKeys] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(getHistory);
  const [copied, setCopied] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const fileInputRef = useRef(null);

  const validateInput = useCallback((val) => {
    if (!val.trim()) { setError(null); return; }
    try {
      const toparse = repairMode ? repairJson(val) : val;
      JSON.parse(toparse);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [repairMode]);

  const handleInput = (val) => {
    setInput(val);
    validateInput(val);
    setOutput("");
  };

  const handleFormat = () => {
    if (!input.trim()) { setError("Input is empty."); return; }
    try {
      const toparse = repairMode ? repairJson(input) : input;
      let parsed = JSON.parse(toparse);
      if (sortKeys) parsed = sortKeysDeep(parsed);
      const indentVal = indent === "tab" ? "\t" : indent;
      const formatted = JSON.stringify(parsed, null, indentVal);
      setOutput(formatted);
      setError(null);
      saveHistory(input, formatted);
      setHistory(getHistory());
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMinify = () => {
    if (!input.trim()) { setError("Input is empty."); return; }
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
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">JSON Formatter</h1>
        <p className="text-sm text-muted-foreground">Validate, format, minify, sort and repair JSON with syntax highlighting.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
          {[2, 4, "tab"].map(v => (
            <button
              key={v}
              onClick={() => setIndent(v)}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors", indent === v ? "bg-foreground text-background" : "hover:bg-accent text-muted-foreground")}
            >
              {v === "tab" ? "Tab" : `${v} Spaces`}
            </button>
          ))}
        </div>

        <button
          onClick={handleFormat}
          className="px-4 py-1.5 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Format <span className="opacity-60 ml-1">Ctrl+Enter</span>
        </button>

        <button
          onClick={handleMinify}
          className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors"
        >
          Minify
        </button>

        <button
          onClick={() => setRepairMode(r => !r)}
          className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition-colors", repairMode ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-border hover:bg-accent")}
        >
          Repair JSON {repairMode ? "ON" : "OFF"}
        </button>

        <button
          onClick={() => setSortKeys(s => !s)}
          className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition-colors", sortKeys ? "border-purple-500/50 bg-purple-500/10 text-purple-400" : "border-border hover:bg-accent")}
        >
          Sort Keys {sortKeys ? "ON" : "OFF"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Input JSON</span>
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
                onClick={() => { setInput(SAMPLE_JSON); validateInput(SAMPLE_JSON); }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <FileText className="h-3 w-3" /> Sample
              </button>
              <button
                onClick={() => { setInput(""); setOutput(""); setError(null); }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
              <input ref={fileInputRef} type="file" accept=".json,.txt" className="hidden" onChange={handleUpload} />
            </div>
          </div>
          <textarea
            value={input}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => { if (e.ctrlKey && e.key === "Enter") handleFormat(); }}
            placeholder='Paste JSON here or click "Sample" to load an example...'
            className={cn(
              "w-full min-h-[420px] p-4 rounded-lg border bg-card font-mono text-sm resize-y transition-colors focus:outline-none focus:ring-1",
              inputInvalid ? "border-red-500/50 focus:ring-red-500/30" : inputValid ? "border-green-500/50 focus:ring-green-500/30" : "border-border focus:ring-ring/30"
            )}
          />
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="font-mono">{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Formatted Output</span>
              {output && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{output.split("\n").length} lines</span>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWrap(w => !w)}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                {wrap ? "Unwrap" : "Wrap"}
              </button>
              <button onClick={handleCopy} className={cn("flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors", copied ? "text-green-400" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={() => handleDownload("json")} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                <Download className="h-3 w-3" /> .json
              </button>
              <button onClick={() => handleDownload("txt")} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                <Download className="h-3 w-3" /> .txt
              </button>
              <button onClick={() => setShowFullscreen(true)} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                <Maximize2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className={cn(
            "w-full min-h-[420px] p-4 rounded-lg border border-border bg-card font-mono text-sm overflow-auto",
            wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto"
          )}>
            {output ? <code>{highlightJson(output)}</code> : (
              <span className="text-muted-foreground">Formatted output will appear here...</span>
            )}
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
              <p className="text-xs text-muted-foreground">No history yet. Format some JSON to see it here.</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-md hover:bg-accent/50 group">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()} — </span>
                      <span className="text-xs font-mono truncate">{entry.preview}…</span>
                    </div>
                    <button
                      onClick={() => { setInput(entry.input); validateInput(entry.input); setOutput(entry.output); }}
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

      {showFullscreen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">Formatted Output</span>
            <button onClick={() => setShowFullscreen(false)} className="p-2 rounded-lg hover:bg-accent transition-colors">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-sm whitespace-pre-wrap">
            {output ? <code>{highlightJson(output)}</code> : <span className="text-muted-foreground">No output yet.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
