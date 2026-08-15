import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Trash2,
  ClipboardPaste,
  FileText,
  Maximize2,
  RefreshCw,
  ExternalLink,
  Replace,
} from "lucide-react";
import ScrollToTop from "../components/ScrollToTop";
import ResizableSplit from "../components/ResizableSplit";
import FindReplaceModal from "../components/FindReplaceModal";
import { useUndoHistory } from "../hooks/use-undo-history";

const STATE_KEY = "devtoolkit_html_preview_state";

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Preview</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      text-align: center;
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    button {
      margin-top: 1.5rem;
      padding: 0.6rem 1.4rem;
      border: none;
      border-radius: 8px;
      background: white;
      color: #6366f1;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>Hello, DevToolkit!</h1>
  <p>Edit the HTML on the left to see it update live.</p>
  <button onclick="alert('Clicked!')">Click me</button>
</body>
</html>
`;

function getState() {
  try {
    return JSON.parse(
      localStorage.getItem(STATE_KEY) || JSON.stringify({ html: SAMPLE_HTML }),
    );
  } catch {
    return { html: SAMPLE_HTML };
  }
}

function setState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // storage quota exceeded — non-critical, state just won't persist
  }
}

export default function HtmlPreviewer() {
  const initialState = getState();
  const [html, setHtmlRaw] = useState(initialState.html);
  const { record: recordHtmlUndo, handleKeyDown: handleHtmlUndoKeyDown } =
    useUndoHistory(html, setHtmlRaw);
  const setHtml = useCallback(
    (val) => {
      setHtmlRaw((prev) => {
        recordHtmlUndo(prev);
        return typeof val === "function" ? val(prev) : val;
      });
    },
    [recordHtmlUndo],
  );
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [previewSrc, setPreviewSrc] = useState(initialState.html);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const fileInputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    setState({ html });
  }, [html]);

  useEffect(() => {
    if (!liveUpdate) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewSrc(html), 300);
    return () => clearTimeout(debounceRef.current);
  }, [html, liveUpdate]);

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

  const handleRun = useCallback(() => setPreviewSrc(html), [html]);

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    setHtml(text);
    setPreviewSrc(text);
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target.result || "");
      setHtml(text);
      setPreviewSrc(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClear = () => {
    setHtml("");
    setPreviewSrc("");
  };

  const handleOpenNewTab = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const inputPanel = (
    <div className="tool-panel">
      <div className="tool-panel-header">
        <div className="tool-panel-title">
          <span className="text-sm font-medium">HTML Source</span>
          {html && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {html.length.toLocaleString()} chars
            </span>
          )}
        </div>
        <div className="tool-panel-actions">
          <button
            onClick={() => setShowFindReplace(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          >
            <Replace className="h-3 w-3" /> Find &amp; Replace
          </button>
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
              setHtml(SAMPLE_HTML);
              setPreviewSrc(SAMPLE_HTML);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          >
            <FileText className="h-3 w-3" /> Sample
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,.txt"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>
      <textarea
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = e.clipboardData.getData("text");
          const el = e.target;
          const start = el.selectionStart ?? html.length;
          const end = el.selectionEnd ?? html.length;
          const next = html.slice(0, start) + pasted + html.slice(end);
          setHtml(next);
          if (liveUpdate) setPreviewSrc(next);
          requestAnimationFrame(() => {
            const pos = start + pasted.length;
            el.setSelectionRange(pos, pos);
          });
        }}
        onKeyDown={(e) => {
          if (handleHtmlUndoKeyDown(e)) return;
          if (e.ctrlKey && e.key === "Enter") handleRun();
        }}
        placeholder="Paste or type HTML here..."
        spellCheck={false}
        className="w-full min-h-[240px] sm:min-h-[420px] p-3 sm:p-4 rounded-lg border border-border bg-card font-mono text-sm resize-y transition-colors focus:outline-none focus:ring-1 focus:ring-ring/30 focus:border-ring/50"
      />
    </div>
  );

  const previewPanel = (
    <div className="tool-panel">
      <div className="tool-panel-header">
        <div className="tool-panel-title">
          <span className="text-sm font-medium">Live Preview</span>
        </div>
        <div className="tool-panel-actions">
          <label className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={liveUpdate}
              onChange={(e) => setLiveUpdate(e.target.checked)}
              className="rounded"
            />
            Live
          </label>
          {!liveUpdate && (
            <button
              onClick={handleRun}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Run
            </button>
          )}
          <button
            onClick={handleOpenNewTab}
            disabled={!html}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <ExternalLink className="h-3 w-3" /> Open
          </button>
          <button
            onClick={() => setShowFullscreen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="w-full min-h-[240px] sm:min-h-[420px] rounded-lg border border-border bg-white overflow-hidden">
        <iframe
          title="HTML Preview"
          srcDoc={previewSrc}
          sandbox="allow-scripts allow-modals allow-forms allow-popups"
          className="w-full h-full min-h-[240px] sm:min-h-[420px] border-0"
        />
      </div>
    </div>
  );

  return (
    <div className="tool-page">
      <div className="tool-page-header">
        <h1 className="tool-page-title">HTML Previewer</h1>
        <p className="tool-page-subtitle">
          Write or paste HTML and see a live, sandboxed preview. Nothing
          leaves your browser.
        </p>
      </div>

      <div className="tool-toolbar">
        <div className="tool-toolbar-main">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={liveUpdate}
              onChange={(e) => setLiveUpdate(e.target.checked)}
              className="rounded"
            />
            Live update
          </label>
        </div>
        <button
          onClick={handleRun}
          className="tool-toolbar-action px-4 py-2 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Run <span className="opacity-60 ml-1">Ctrl+Enter</span>
        </button>
      </div>

      <ResizableSplit
        storageKey="devtoolkit_html_split"
        left={inputPanel}
        right={previewPanel}
      />

      {showFullscreen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">Live Preview</span>
            <button
              onClick={() => setShowFullscreen(false)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 rounded-lg border border-border bg-white overflow-hidden">
            <iframe
              title="HTML Preview Fullscreen"
              srcDoc={previewSrc}
              sandbox="allow-scripts allow-modals allow-forms allow-popups"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}

      <FindReplaceModal
        open={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        value={html}
        onChange={(next) => {
          setHtml(next);
          if (liveUpdate) setPreviewSrc(next);
        }}
      />
      <ScrollToTop />
    </div>
  );
}
