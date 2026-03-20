import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, ArrowLeft, ArrowLeftRight, Copy, Download, Upload, Trash2, Check, ClipboardPaste } from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";

const HISTORY_KEY = "devtoolkit_stringify_history";

const EXAMPLES = [
  {
    label: "Simple",
    json: JSON.stringify({ name: "Alice", age: 30, active: true }, null, 2),
  },
  {
    label: "Nested",
    json: JSON.stringify({ user: { id: 1, profile: { bio: "Hello\nWorld", tags: ["js", "dev"] } }, meta: { created: "2024-01-01" } }, null, 2),
  },
  {
    label: "Special Chars",
    json: JSON.stringify({ text: "Line 1\nLine 2\tTabbed", quote: 'She said "hello"', emoji: "🚀" }, null, 2),
  },
];

function saveHistory(input, output, dir) {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const entry = { timestamp: Date.now(), dir, preview: input.slice(0, 50) };
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...h].slice(0, 10)));
  } catch {}
}

function highlightJson(jsonStr) {
  const tokens = [];
  const re = /("(?:[^"\\]|\\.)*")\s*:|"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|true|false|null|[{}[\],]/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = re.exec(jsonStr)) !== null) {
    if (match.index > lastIndex) tokens.push(<span key={key++}>{jsonStr.slice(lastIndex, match.index)}</span>);
    const val = match[0];
    if (val.endsWith(":")) {
      tokens.push(<span key={key++} className="text-blue-500 dark:text-blue-400">{val}</span>);
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

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold text-sm">{title}</h2>
      {children}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast({ title: "Copied!", type: "success" });
  };
  return (
    <button onClick={handle} className={cn("flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors", copied ? "text-green-400" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function DownloadButton({ text, filename, label }) {
  const handle = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={handle} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
      <Download className="h-3 w-3" /> {label}
    </button>
  );
}

export default function StringifyConverter() {
  const [liveMode, setLiveMode] = useState(false);
  const [liveJson, setLiveJson] = useState('{\n  "name": "DevToolkit",\n  "version": 1\n}');
  const [liveStringified, setLiveStringified] = useState("");
  const [liveJsonError, setLiveJsonError] = useState(null);
  const [liveStringError, setLiveStringError] = useState(null);

  const [jsonInput, setJsonInput] = useState("");
  const [stringifiedOutput, setStringifiedOutput] = useState("");
  const [includeSpaces, setIncludeSpaces] = useState(false);
  const [escapeUnicode, setEscapeUnicode] = useState(false);

  const [stringInput, setStringInput] = useState("");
  const [jsonOutput, setJsonOutput] = useState("");
  const [parseError, setParseError] = useState(null);
  const [recursiveParse, setRecursiveParse] = useState(false);

  const debounceRef = useRef(null);

  const doLiveStringify = useCallback((json) => {
    try {
      const parsed = JSON.parse(json);
      setLiveStringified(JSON.stringify(parsed));
      setLiveJsonError(null);
    } catch (e) {
      setLiveJsonError(e.message);
      setLiveStringified("");
    }
  }, []);

  const doLiveParse = useCallback((str) => {
    try {
      let s = str.trim();
      if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
      const parsed = JSON.parse(s);
      setLiveJson(JSON.stringify(parsed, null, 2));
      setLiveStringError(null);
    } catch (e) {
      setLiveStringError(e.message);
    }
  }, []);

  useEffect(() => {
    if (!liveMode) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doLiveStringify(liveJson);
    }, 300);
  }, [liveJson, liveMode, doLiveStringify]);

  const handleStringify = () => {
    if (!jsonInput.trim()) return;
    try {
      const parsed = JSON.parse(jsonInput);
      const result = includeSpaces
        ? JSON.stringify(parsed, null, 2)
        : JSON.stringify(parsed);
      setStringifiedOutput(result);
      saveHistory(jsonInput, result, "json→string");
    } catch (e) {
      addToast({ title: "Invalid JSON", description: e.message, type: "error" });
    }
  };

  const handleParse = () => {
    if (!stringInput.trim()) return;
    try {
      let s = stringInput.trim();
      if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
      s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      let parsed = JSON.parse(s);
      if (recursiveParse && typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonOutput(formatted);
      setParseError(null);
      saveHistory(stringInput, formatted, "string→json");
    } catch (e) {
      setParseError(e.message);
    }
  };

  const fileInputA = useRef(null);
  const fileInputB = useRef(null);

  if (liveMode) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold mb-1">Stringify ↔ JSON Converter</h1>
            <p className="text-sm text-muted-foreground">Live bidirectional sync mode — edit either side to update the other.</p>
          </div>
          <button
            onClick={() => setLiveMode(false)}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors"
          >
            ⇄ Disable Live Sync
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Normal JSON</span>
              {liveJsonError && <span className="text-xs text-red-400">{liveJsonError}</span>}
            </div>
            <textarea
              value={liveJson}
              onChange={e => {
                setLiveJson(e.target.value);
                clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => doLiveStringify(e.target.value), 300);
              }}
              className={cn(
                "w-full min-h-[400px] p-4 rounded-lg border bg-card font-mono text-xs resize-y focus:outline-none focus:ring-1",
                liveJsonError ? "border-red-500/50 focus:ring-red-500/30" : "border-green-500/40 focus:ring-green-500/30"
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Stringified Output</span>
              {liveStringError && <span className="text-xs text-red-400">{liveStringError}</span>}
            </div>
            <textarea
              value={liveStringified}
              onChange={e => {
                setLiveStringified(e.target.value);
                clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => doLiveParse(e.target.value), 300);
              }}
              className={cn(
                "w-full min-h-[400px] p-4 rounded-lg border bg-card font-mono text-xs resize-y focus:outline-none focus:ring-1",
                liveStringError ? "border-red-500/50 focus:ring-red-500/30" : liveStringified ? "border-green-500/40 focus:ring-green-500/30" : "border-border"
              )}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1">Stringify ↔ JSON Converter</h1>
          <p className="text-sm text-muted-foreground">Convert between JSON objects and stringified strings in both directions.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { EXAMPLES.forEach(() => {}); const ex = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]; setJsonInput(ex.json); setStringifiedOutput(""); }}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors"
          >
            Load Example
          </button>
          <button
            onClick={() => { setLiveMode(true); doLiveStringify(liveJson); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <ArrowLeftRight className="h-3 w-3" /> Live Sync Mode
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <Section title="JSON → Stringified">
          <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-border">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={includeSpaces} onChange={e => setIncludeSpaces(e.target.checked)} className="rounded" />
              Include spaces (pretty)
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={escapeUnicode} onChange={e => setEscapeUnicode(e.target.checked)} className="rounded" />
              Escape unicode
            </label>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Normal JSON input</span>
                <div className="flex gap-1">
                  <button onClick={async () => { const t = await navigator.clipboard.readText(); setJsonInput(t); }} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                    <ClipboardPaste className="h-3 w-3" /> Paste
                  </button>
                  <button onClick={() => fileInputA.current?.click()} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                    <Upload className="h-3 w-3" /> Upload
                  </button>
                  <input ref={fileInputA} type="file" accept=".json,.txt" className="hidden" onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setJsonInput(ev.target.result); r.readAsText(f); e.target.value = ""; }} />
                </div>
              </div>
              <textarea
                value={jsonInput}
                onChange={e => { setJsonInput(e.target.value); setStringifiedOutput(""); }}
                placeholder='{"key": "value"}'
                className="w-full min-h-[200px] p-3 rounded-lg border border-border bg-background font-mono text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring/30"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Stringified output</span>
                <div className="flex gap-1">
                  {stringifiedOutput && <CopyButton text={stringifiedOutput} />}
                  {stringifiedOutput && <DownloadButton text={stringifiedOutput} filename="stringified.txt" label=".txt" />}
                </div>
              </div>
              <div className="w-full min-h-[200px] p-3 rounded-lg border border-border bg-card font-mono text-xs overflow-auto whitespace-pre-wrap break-all">
                {stringifiedOutput || <span className="text-muted-foreground">Stringified result...</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleStringify}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Stringify <ArrowRight className="h-4 w-4" />
            </button>
            {stringifiedOutput && (
              <button
                onClick={() => { setStringInput(stringifiedOutput); setJsonOutput(""); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                <ArrowLeftRight className="h-4 w-4" /> Swap to Parser
              </button>
            )}
            <button onClick={() => { setJsonInput(""); setStringifiedOutput(""); }} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </Section>

        <Section title="Stringified → JSON">
          <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-border">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={recursiveParse} onChange={e => setRecursiveParse(e.target.checked)} className="rounded" />
              Recursively parse nested stringified JSON
            </label>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Stringified input</span>
                <div className="flex gap-1">
                  <button onClick={async () => { const t = await navigator.clipboard.readText(); setStringInput(t); }} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                    <ClipboardPaste className="h-3 w-3" /> Paste
                  </button>
                  <button onClick={() => fileInputB.current?.click()} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
                    <Upload className="h-3 w-3" /> Upload
                  </button>
                  <input ref={fileInputB} type="file" accept=".json,.txt" className="hidden" onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setStringInput(ev.target.result); r.readAsText(f); e.target.value = ""; }} />
                </div>
              </div>
              <textarea
                value={stringInput}
                onChange={e => { setStringInput(e.target.value); setJsonOutput(""); setParseError(null); }}
                placeholder='"{\\"key\\": \\"value\\"}"'
                className={cn(
                  "w-full min-h-[200px] p-3 rounded-lg border bg-background font-mono text-xs resize-y focus:outline-none focus:ring-1",
                  parseError ? "border-red-500/50 focus:ring-red-500/30" : "border-border focus:ring-ring/30"
                )}
              />
              {parseError && <p className="text-xs text-red-400 mt-1 font-mono">{parseError}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Parsed JSON output</span>
                <div className="flex gap-1">
                  {jsonOutput && <CopyButton text={jsonOutput} />}
                  {jsonOutput && <DownloadButton text={jsonOutput} filename="parsed.json" label=".json" />}
                </div>
              </div>
              <div className="w-full min-h-[200px] p-3 rounded-lg border border-border bg-card font-mono text-xs overflow-auto whitespace-pre-wrap">
                {jsonOutput ? highlightJson(jsonOutput) : <span className="text-muted-foreground">Parsed JSON result...</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleParse}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <ArrowLeft className="h-4 w-4" /> Parse to JSON
            </button>
            {jsonOutput && (
              <button
                onClick={() => { setJsonInput(jsonOutput); setStringifiedOutput(""); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                <ArrowLeftRight className="h-4 w-4" /> Swap to Stringifier
              </button>
            )}
            <button onClick={() => { setStringInput(""); setJsonOutput(""); setParseError(null); }} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
