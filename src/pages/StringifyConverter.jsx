import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Copy,
  Download,
  Upload,
  Trash2,
  Check,
  ClipboardPaste,
  AlertCircle,
  Maximize2,
  Replace,
} from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";
import FindReplaceModal from "../components/FindReplaceModal";
import ResizableSplit from "../components/ResizableSplit";
import { useUndoHistory } from "../hooks/use-undo-history";

const HISTORY_KEY = "devtoolkit_stringify_history";
const STATE_KEY = "devtoolkit_stringify_state";

const EXAMPLES = [
  {
    label: "Simple",
    json: '{\n  "name": "Alice",\n  "age": 30,\n  "active": true\n}',
  },
  {
    label: "Nested",
    json: '{\n  "user": {\n    "id": 1,\n    "profile": {\n      "bio": "Hello\\nWorld",\n      "tags": ["js", "dev"]\n    }\n  },\n  "meta": { "created": "2024-01-01" }\n}',
  },
  {
    label: "Special Chars",
    json: '{\n  "text": "Line 1\\nLine 2\\tTabbed",\n  "quote": "She said \\"hello\\"",\n  "emoji": "🚀"\n}',
  },
];

function saveHistory(dir, preview) {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const entry = { timestamp: Date.now(), dir, preview: preview.slice(0, 50) };
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([entry, ...h].slice(0, 10)),
    );
  } catch {}
}

function getState() {
  try {
    return JSON.parse(
      localStorage.getItem(STATE_KEY) ||
        '{"jsonInput":"","stringifiedOutput":"","stringInput":"","jsonOutput":"","liveJson":"{\\"name\\":\\"DevToolkit\\",\\"version\\":1,\\"active\\":true}","liveStringified":""}',
    );
  } catch {
    return {
      jsonInput: "",
      stringifiedOutput: "",
      stringInput: "",
      jsonOutput: "",
      liveJson:
        '{\n  "name": "DevToolkit",\n  "version": 1,\n  "active": true\n}',
      liveStringified: "",
    };
  }
}

function setState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function highlightJson(jsonStr) {
  const tokens = [];
  const re =
    /("(?:[^"\\]|\\.)*")\s*:|"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|true|false|null|[{}[\],]/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = re.exec(jsonStr)) !== null) {
    if (match.index > lastIndex)
      tokens.push(
        <span key={key++}>{jsonStr.slice(lastIndex, match.index)}</span>,
      );
    const val = match[0];
    if (val.endsWith(":")) {
      tokens.push(
        <span key={key++} className="text-blue-500 dark:text-blue-400">
          {val}
        </span>,
      );
    } else if (val.startsWith('"')) {
      tokens.push(
        <span key={key++} className="text-green-600 dark:text-green-400">
          {val}
        </span>,
      );
    } else if (match[2] !== undefined) {
      tokens.push(
        <span key={key++} className="text-orange-500 dark:text-orange-400">
          {val}
        </span>,
      );
    } else if (val === "true" || val === "false") {
      tokens.push(
        <span key={key++} className="text-purple-500 dark:text-purple-400">
          {val}
        </span>,
      );
    } else if (val === "null") {
      tokens.push(
        <span key={key++} className="text-red-500 dark:text-red-400">
          {val}
        </span>,
      );
    } else {
      tokens.push(<span key={key++}>{val}</span>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < jsonStr.length)
    tokens.push(<span key={key++}>{jsonStr.slice(lastIndex)}</span>);
  return tokens;
}

function doStringify(jsonText, pretty) {
  try {
    const parsed = JSON.parse(jsonText);
    const compactStr = JSON.stringify(parsed);
    const stringified = JSON.stringify(compactStr);
    return stringified;
  } catch (e) {
    throw new Error("Invalid JSON: " + e.message);
  }
}

function unescapeJsString(s) {
  return s.replace(
    /\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\\'"`bfnrtv0/])/g,
    (_, esc) => {
      if (esc.startsWith("u{")) {
        return String.fromCodePoint(parseInt(esc.slice(2, -1), 16));
      }
      if (esc.startsWith("u")) {
        return String.fromCharCode(parseInt(esc.slice(1), 16));
      }
      if (esc.startsWith("x")) {
        return String.fromCharCode(parseInt(esc.slice(1), 16));
      }
      const map = {
        "\\": "\\",
        "'": "'",
        '"': '"',
        "`": "`",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
        v: "\v",
        0: "\0",
        "/": "/",
      };
      return map[esc] ?? esc;
    },
  );
}

function stripOuterQuotes(s) {
  if (s.length < 2) return s;
  const first = s[0];
  const last = s[s.length - 1];
  if ((first === '"' || first === "'" || first === "`") && first === last) {
    return s.slice(1, -1);
  }
  return s;
}

function doParse(stringText) {
  const s = stringText.trim();
  if (!s) throw new Error("Empty input");

  // 1) Try direct JSON parse first - might be a stringified JSON
  try {
    const parsed = JSON.parse(s);
    if (typeof parsed === "string") {
      // It was a JSON-stringified string, try to parse the inner value
      try {
        const innerParsed = JSON.parse(parsed);
        return JSON.stringify(innerParsed, null, 2);
      } catch {
        // Inner wasn't JSON, so the string value is the result
        return JSON.stringify(parsed, null, 2);
      }
    }
    // It was already a JSON object/array
    return JSON.stringify(parsed, null, 2);
  } catch {
    // fall through
  }

  // 2) Try stripping outer quotes and unescaping JS sequences
  const inner = stripOuterQuotes(s);
  if (inner !== s) {
    try {
      const unescaped = unescapeJsString(inner);
      const parsed = JSON.parse(unescaped);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // fall through
    }
  }

  // 3) Try as bare escaped string
  try {
    const unescaped = unescapeJsString(s);
    const parsed = JSON.parse(unescaped);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // fall through
  }

  // 4) Last resort: treat as plain string and return it
  try {
    return JSON.stringify(s, null, 2);
  } catch (e) {
    throw new Error("Could not parse input: " + e.message);
  }
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast({ title: "Copied!", type: "success" });
  };
  return (
    <button
      onClick={handle}
      className={cn(
        "flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors",
        copied
          ? "text-green-500"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function DownloadBtn({ text, filename, label }) {
  return (
    <button
      onClick={() => {
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
      className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export default function StringifyConverter() {
  const initialState = getState();
  const [liveMode, setLiveMode] = useState(false);
  const [liveJson, setLiveJsonRaw] = useState(initialState.liveJson);
  const [liveStringified, setLiveStringifiedRaw] = useState(
    initialState.liveStringified,
  );
  const [liveJsonError, setLiveJsonError] = useState(null);
  const [liveStringError, setLiveStringError] = useState(null);

  const [jsonInput, setJsonInputRaw] = useState(initialState.jsonInput);
  const [stringifiedOutput, setStringifiedOutput] = useState(
    initialState.stringifiedOutput,
  );
  const [jsonifyError, setJsonifyError] = useState(null);
  const [prettyStringify, setPrettyStringify] = useState(false);

  const [stringInput, setStringInputRaw] = useState(initialState.stringInput);
  const [jsonOutput, setJsonOutput] = useState(initialState.jsonOutput);
  const [parseError, setParseError] = useState(null);
  const [expandedOutput, setExpandedOutput] = useState(null);
  const [findReplaceTarget, setFindReplaceTarget] = useState(null); // "jsonInput" | "stringInput" | "liveJson" | "liveStringified"

  const debounceRef = useRef(null);
  const fileRefA = useRef(null);
  const fileRefB = useRef(null);

  const runLiveStringifyRef = useRef(() => {});
  const runLiveParseRef = useRef(() => {});
  const runStringifyFromInputRef = useRef(() => {});
  const runParseFromInputRef = useRef(() => {});

  const { record: recordLiveJsonUndo, handleKeyDown: handleLiveJsonUndoKeyDown } =
    useUndoHistory(liveJson, setLiveJsonRaw, (v) => runLiveStringifyRef.current(v));
  const setLiveJson = useCallback(
    (val) => {
      setLiveJsonRaw((prev) => {
        recordLiveJsonUndo(prev);
        return typeof val === "function" ? val(prev) : val;
      });
    },
    [recordLiveJsonUndo],
  );

  const {
    record: recordLiveStringifiedUndo,
    handleKeyDown: handleLiveStringifiedUndoKeyDown,
  } = useUndoHistory(liveStringified, setLiveStringifiedRaw, (v) =>
    runLiveParseRef.current(v),
  );
  const setLiveStringified = useCallback(
    (val) => {
      setLiveStringifiedRaw((prev) => {
        recordLiveStringifiedUndo(prev);
        return typeof val === "function" ? val(prev) : val;
      });
    },
    [recordLiveStringifiedUndo],
  );

  const { record: recordJsonInputUndo, handleKeyDown: handleJsonInputUndoKeyDown } =
    useUndoHistory(jsonInput, setJsonInputRaw, (v) => {
      setStringifiedOutput("");
      setJsonifyError(null);
      runStringifyFromInputRef.current(v);
    });
  const setJsonInput = useCallback(
    (val) => {
      setJsonInputRaw((prev) => {
        recordJsonInputUndo(prev);
        return typeof val === "function" ? val(prev) : val;
      });
    },
    [recordJsonInputUndo],
  );

  const { record: recordStringInputUndo, handleKeyDown: handleStringInputUndoKeyDown } =
    useUndoHistory(stringInput, setStringInputRaw, (v) => {
      setJsonOutput("");
      setParseError(null);
      runParseFromInputRef.current(v);
    });
  const setStringInput = useCallback(
    (val) => {
      setStringInputRaw((prev) => {
        recordStringInputUndo(prev);
        return typeof val === "function" ? val(prev) : val;
      });
    },
    [recordStringInputUndo],
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setFindReplaceTarget(liveMode ? "liveJson" : "jsonInput");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [liveMode]);

  const findReplaceValue =
    findReplaceTarget === "jsonInput"
      ? jsonInput
      : findReplaceTarget === "stringInput"
        ? stringInput
        : findReplaceTarget === "liveJson"
          ? liveJson
          : findReplaceTarget === "liveStringified"
            ? liveStringified
            : "";

  const handleFindReplaceChange = (next) => {
    if (findReplaceTarget === "jsonInput") {
      setJsonInput(next);
      runStringifyFromInput(next);
    } else if (findReplaceTarget === "stringInput") {
      setStringInput(next);
      runParseFromInput(next);
    } else if (findReplaceTarget === "liveJson") {
      setLiveJson(next);
      runLiveStringify(next);
    } else if (findReplaceTarget === "liveStringified") {
      setLiveStringified(next);
      runLiveParse(next);
    }
  };

  useEffect(() => {
    setState({
      jsonInput,
      stringifiedOutput,
      stringInput,
      jsonOutput,
      liveJson,
      liveStringified,
    });
  }, [
    jsonInput,
    stringifiedOutput,
    stringInput,
    jsonOutput,
    liveJson,
    liveStringified,
  ]);

  const runLiveStringify = useCallback((val) => {
    try {
      const result = doStringify(val, false);
      // Derived from liveJson, not a direct edit — write via the raw
      // setter so it doesn't create its own undo step.
      setLiveStringifiedRaw(result);
      setLiveJsonError(null);
    } catch (e) {
      setLiveJsonError(e.message);
      setLiveStringifiedRaw("");
    }
  }, []);
  runLiveStringifyRef.current = runLiveStringify;

  const runLiveParse = useCallback((val) => {
    try {
      const result = doParse(val);
      setLiveJsonRaw(result);
      setLiveStringError(null);
    } catch (e) {
      setLiveStringError(e.message);
    }
  }, []);
  runLiveParseRef.current = runLiveParse;

  useEffect(() => {
    if (!liveMode) return;
    runLiveStringify(liveJson);
  }, [liveMode]);

  const runStringifyFromInput = useCallback(
    (value) => {
      if (!value.trim()) {
        setStringifiedOutput("");
        setJsonifyError(null);
        return;
      }
      try {
        const result = doStringify(value, prettyStringify);
        setStringifiedOutput(result);
        setJsonifyError(null);
        saveHistory("json→string", value);
      } catch (e) {
        setJsonifyError(e.message);
        setStringifiedOutput("");
      }
    },
    [prettyStringify],
  );
  runStringifyFromInputRef.current = runStringifyFromInput;

  const runParseFromInput = useCallback((value) => {
    if (!value.trim()) {
      setJsonOutput("");
      setParseError(null);
      return;
    }
    try {
      const result = doParse(value);
      setJsonOutput(result);
      setParseError(null);
      saveHistory("string→json", value);
    } catch (e) {
      setParseError(e.message);
      setJsonOutput("");
    }
  }, []);
  runParseFromInputRef.current = runParseFromInput;

  const handleStringify = () => {
    if (!jsonInput.trim()) {
      addToast({
        title: "No input",
        description: "Paste or type JSON first.",
        type: "error",
      });
      return;
    }
    runStringifyFromInput(jsonInput);
  };

  const handleParse = () => {
    if (!stringInput.trim()) {
      addToast({
        title: "No input",
        description: "Paste a stringified JSON first.",
        type: "error",
      });
      return;
    }
    runParseFromInput(stringInput);
  };

  if (liveMode) {
    return (
      <div className="tool-page">
        <div className="tool-page-header sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="tool-page-title">
              Stringify ↔ JSON — Live Sync
            </h1>
            <p className="tool-page-subtitle">
              Edit either panel and the other updates automatically (300ms
              debounce).
            </p>
          </div>
          <button
            onClick={() => setLiveMode(false)}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            ⬅ Back to Manual Mode
          </button>
        </div>

        <ResizableSplit
          storageKey="devtoolkit_stringify_live_split"
          left={
          <div className="flex flex-col gap-2">
            <div className="tool-panel-header">
              <span className="text-sm font-semibold">
                Normal JSON (pretty)
              </span>
              <div className="flex items-center gap-2">
                {liveJsonError && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <AlertCircle className="h-3 w-3" />{" "}
                    {liveJsonError.slice(0, 40)}
                  </span>
                )}
                <button
                  onClick={() => setFindReplaceTarget("liveJson")}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                >
                  <Replace className="h-3.5 w-3.5" /> Find &amp; Replace
                </button>
              </div>
            </div>
            <textarea
              value={liveJson}
              onChange={(e) => {
                setLiveJson(e.target.value);
                clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(
                  () => runLiveStringify(e.target.value),
                  300,
                );
              }}
              onKeyDown={handleLiveJsonUndoKeyDown}
              className={cn(
                "w-full min-h-[240px] sm:min-h-[440px] p-3 sm:p-4 rounded-lg border bg-card font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-1",
                liveJsonError
                  ? "border-red-500/50 focus:ring-red-500/30"
                  : "border-green-500/40 focus:ring-green-500/30",
              )}
            />
          </div>
          }
          right={
          <div className="flex flex-col gap-2">
            <div className="tool-panel-header">
              <span className="text-sm font-semibold">
                Stringified (escaped string)
              </span>
              <div className="flex items-center gap-2">
                {liveStringError && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <AlertCircle className="h-3 w-3" />{" "}
                    {liveStringError.slice(0, 40)}
                  </span>
                )}
                <button
                  onClick={() => setFindReplaceTarget("liveStringified")}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                >
                  <Replace className="h-3.5 w-3.5" /> Find &amp; Replace
                </button>
              </div>
            </div>
            <textarea
              value={liveStringified}
              onChange={(e) => {
                setLiveStringified(e.target.value);
                clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(
                  () => runLiveParse(e.target.value),
                  300,
                );
              }}
              onKeyDown={handleLiveStringifiedUndoKeyDown}
              className={cn(
                "w-full min-h-[240px] sm:min-h-[440px] p-3 sm:p-4 rounded-lg border bg-card font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-1",
                liveStringError
                  ? "border-red-500/50 focus:ring-red-500/30"
                  : liveStringified
                    ? "border-blue-500/40 focus:ring-blue-500/30"
                    : "border-border",
              )}
            />
          </div>
          }
        />

        <p className="mt-4 text-sm text-muted-foreground">
          <strong>Tip:</strong> Left shows your JSON formatted. Right shows it
          as an escaped string literal (e.g.{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
            {'"{\\"key\\":\\"val\\"}"'}
          </code>
          ) ready to embed in code.
        </p>
        <FindReplaceModal
          open={
            findReplaceTarget === "liveJson" ||
            findReplaceTarget === "liveStringified"
          }
          onClose={() => setFindReplaceTarget(null)}
          value={findReplaceValue}
          onChange={handleFindReplaceChange}
        />
      </div>
    );
  }

  return (
    <div className="tool-page">
      <div className="tool-page-header sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="tool-page-title">Stringify ↔ JSON Converter</h1>
          <p className="tool-page-subtitle">
            Convert between JSON objects and escaped string literals in both
            directions.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={() => {
              const ex = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
              setJsonInput(ex.json);
              setStringifiedOutput("");
              setJsonifyError(null);
            }}
            className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Load Example
          </button>
          <button
            onClick={() => {
              setLiveMode(true);
              runLiveStringify(liveJson);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" /> Live Sync Mode
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── SECTION A: JSON → Stringified ── */}
        <div className="tool-card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base font-semibold">JSON → Stringified</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Object → Escaped String
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Takes your JSON object and converts it to an escaped string literal
            — exactly what{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">
              JSON.stringify(obj)
            </code>{" "}
            produces wrapped in quotes.
          </p>

          <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-border">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={prettyStringify}
                onChange={(e) => setPrettyStringify(e.target.checked)}
                className="rounded accent-foreground"
              />
              Pretty-print outer wrapper
            </label>
          </div>

          <ResizableSplit
            storageKey="devtoolkit_stringify_a_split"
            left={
            <div className="flex flex-col gap-2">
              <div className="tool-panel-header">
                <span className="text-sm text-muted-foreground font-medium">
                  Input — Normal JSON
                </span>
                <div className="tool-panel-actions">
                  <button
                    onClick={() => setFindReplaceTarget("jsonInput")}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <Replace className="h-3.5 w-3.5" /> Find &amp; Replace
                  </button>
                  <button
                    onClick={async () => {
                      const pasted = await navigator.clipboard.readText();
                      setJsonInput(pasted);
                      runStringifyFromInput(pasted);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                  </button>
                  <button
                    onClick={() => fileRefA.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload
                  </button>
                  <button
                    onClick={() => {
                      setJsonInput("");
                      setStringifiedOutput("");
                      setJsonifyError(null);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={fileRefA}
                    type="file"
                    accept=".json,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = (ev) => {
                        const text = String(ev.target.result || "");
                        setJsonInput(text);
                        runStringifyFromInput(text);
                      };
                      r.readAsText(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setStringifiedOutput("");
                  setJsonifyError(null);
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text");
                  const el = e.target;
                  const start = el.selectionStart ?? jsonInput.length;
                  const end = el.selectionEnd ?? jsonInput.length;
                  const next =
                    jsonInput.slice(0, start) + pasted + jsonInput.slice(end);
                  setJsonInput(next);
                  runStringifyFromInput(next);
                  requestAnimationFrame(() => {
                    const pos = start + pasted.length;
                    el.setSelectionRange(pos, pos);
                  });
                }}
                onKeyDown={handleJsonInputUndoKeyDown}
                placeholder={'{\n  "name": "Alice",\n  "age": 30\n}'}
                className={cn(
                  "w-full min-h-[180px] sm:min-h-[220px] p-3 sm:p-4 rounded-lg border bg-background font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-1",
                  jsonifyError
                    ? "border-red-500/50 focus:ring-red-500/30"
                    : "border-border focus:ring-ring/30",
                )}
              />
              {jsonifyError && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="font-mono">{jsonifyError}</span>
                </div>
              )}
            </div>
            }
            right={
            <div className="flex flex-col gap-2">
              <div className="tool-panel-header">
                <span className="text-sm text-muted-foreground font-medium">
                  Output — Stringified
                </span>
                <div className="tool-panel-actions">
                  {stringifiedOutput && (
                    <button
                      onClick={() => setExpandedOutput("stringified")}
                      className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {stringifiedOutput && <CopyBtn text={stringifiedOutput} />}
                  {stringifiedOutput && (
                    <DownloadBtn
                      text={stringifiedOutput}
                      filename="stringified.txt"
                      label=".txt"
                    />
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "w-full min-h-[180px] sm:min-h-[220px] p-3 sm:p-4 rounded-lg border bg-card font-mono text-sm leading-relaxed overflow-auto whitespace-pre-wrap break-all",
                  stringifiedOutput ? "border-blue-500/30" : "border-border",
                )}
              >
                {stringifiedOutput ? (
                  <span className="text-blue-400 dark:text-blue-300">
                    {stringifiedOutput}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Stringified result will appear here…
                    <br />
                    <br />
                    Example output:
                    <br />
                    <span className="text-blue-400">
                      {'"{\\"name\\":\\"Alice\\",\\"age\\":30}"'}
                    </span>
                  </span>
                )}
              </div>
            </div>
            }
          />

          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={handleStringify}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Stringify <ArrowRight className="h-4 w-4" />
            </button>
            {stringifiedOutput && (
              <button
                onClick={() => {
                  setStringInput(stringifiedOutput);
                  setJsonOutput("");
                  setParseError(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                <ArrowLeftRight className="h-4 w-4" /> Send to Parser
              </button>
            )}
          </div>
        </div>

        {/* ── SECTION B: Stringified → JSON ── */}
        <div className="tool-card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base font-semibold">Stringified → JSON</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Escaped String → Object
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Paste a stringified JSON string (with or without surrounding
            quotes). It will be unescaped and parsed back to a readable JSON
            object.
          </p>

          <ResizableSplit
            storageKey="devtoolkit_stringify_b_split"
            left={
            <div className="flex flex-col gap-2">
              <div className="tool-panel-header">
                <span className="text-sm text-muted-foreground font-medium">
                  Input — Stringified
                </span>
                <div className="tool-panel-actions">
                  <button
                    onClick={() => setFindReplaceTarget("stringInput")}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <Replace className="h-3.5 w-3.5" /> Find &amp; Replace
                  </button>
                  <button
                    onClick={async () => {
                      const pasted = await navigator.clipboard.readText();
                      setStringInput(pasted);
                      runParseFromInput(pasted);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                  </button>
                  <button
                    onClick={() => fileRefB.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload
                  </button>
                  <button
                    onClick={() => {
                      setStringInput("");
                      setJsonOutput("");
                      setParseError(null);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={fileRefB}
                    type="file"
                    accept=".json,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = (ev) => {
                        const text = String(ev.target.result || "");
                        setStringInput(text);
                        runParseFromInput(text);
                      };
                      r.readAsText(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <textarea
                value={stringInput}
                onChange={(e) => {
                  setStringInput(e.target.value);
                  setJsonOutput("");
                  setParseError(null);
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text");
                  const el = e.target;
                  const start = el.selectionStart ?? stringInput.length;
                  const end = el.selectionEnd ?? stringInput.length;
                  const next =
                    stringInput.slice(0, start) +
                    pasted +
                    stringInput.slice(end);
                  setStringInput(next);
                  runParseFromInput(next);
                  requestAnimationFrame(() => {
                    const pos = start + pasted.length;
                    el.setSelectionRange(pos, pos);
                  });
                }}
                onKeyDown={handleStringInputUndoKeyDown}
                placeholder={'"{\\"name\\":\\"Alice\\",\\"age\\":30}"'}
                className={cn(
                  "w-full min-h-[180px] sm:min-h-[220px] p-3 sm:p-4 rounded-lg border bg-background font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-1",
                  parseError
                    ? "border-red-500/50 focus:ring-red-500/30"
                    : "border-border focus:ring-ring/30",
                )}
              />
              {parseError && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="font-mono">{parseError}</span>
                </div>
              )}
            </div>
            }
            right={
            <div className="flex flex-col gap-2">
              <div className="tool-panel-header">
                <span className="text-sm text-muted-foreground font-medium">
                  Output — Parsed JSON
                </span>
                <div className="tool-panel-actions">
                  {jsonOutput && (
                    <button
                      onClick={() => setExpandedOutput("parsed")}
                      className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {jsonOutput && <CopyBtn text={jsonOutput} />}
                  {jsonOutput && (
                    <DownloadBtn
                      text={jsonOutput}
                      filename="parsed.json"
                      label=".json"
                    />
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "w-full min-h-[180px] sm:min-h-[220px] p-3 sm:p-4 rounded-lg border bg-card font-mono text-sm leading-relaxed overflow-auto whitespace-pre-wrap",
                  jsonOutput ? "border-green-500/30" : "border-border",
                )}
              >
                {jsonOutput ? (
                  highlightJson(jsonOutput)
                ) : (
                  <span className="text-muted-foreground">
                    Parsed JSON will appear here…
                  </span>
                )}
              </div>
            </div>
            }
          />

          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={handleParse}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <ArrowLeft className="h-4 w-4" /> Parse to JSON
            </button>
            {jsonOutput && (
              <button
                onClick={() => {
                  setJsonInput(jsonOutput);
                  setStringifiedOutput("");
                  setJsonifyError(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                <ArrowLeftRight className="h-4 w-4" /> Send to Stringifier
              </button>
            )}
          </div>
        </div>
      </div>

      {expandedOutput && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">
              {expandedOutput === "stringified"
                ? "Stringified Output"
                : "Parsed JSON Output"}
            </span>
            <button
              onClick={() => setExpandedOutput(null)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-sm whitespace-pre-wrap break-all">
            {expandedOutput === "stringified"
              ? stringifiedOutput || "No output yet."
              : jsonOutput
                ? highlightJson(jsonOutput)
                : "No output yet."}
          </div>
        </div>
      )}
      <FindReplaceModal
        open={
          findReplaceTarget === "jsonInput" ||
          findReplaceTarget === "stringInput"
        }
        onClose={() => setFindReplaceTarget(null)}
        value={findReplaceValue}
        onChange={handleFindReplaceChange}
      />
    </div>
  );
}
