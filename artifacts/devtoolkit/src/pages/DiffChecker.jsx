import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeftRight, Copy, Upload, Trash2, Settings, ChevronDown, Check, ClipboardPaste, FileText } from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";

const LANGUAGES = [
  "Plain Text", "JSON", "SQL", "JavaScript", "TypeScript",
  "Python", "HTML", "CSS", "XML", "YAML", "Markdown", "Java", "C/C++", "PHP", "Bash/Shell"
];

const SAMPLES = {
  "Plain Text": ["The quick brown fox jumps over the lazy dog.\nThis is the original text.", "The quick brown fox jumps over a lazy dog.\nThis is the modified text with changes."],
  "JSON": ['{\n  "name": "Alice",\n  "age": 30,\n  "role": "developer"\n}', '{\n  "name": "Alice",\n  "age": 31,\n  "role": "senior developer",\n  "team": "platform"\n}'],
  "SQL": ["SELECT id, name, email\nFROM users\nWHERE active = 1\nORDER BY name ASC;", "SELECT id, name, email, role\nFROM users\nWHERE active = 1 AND verified = 1\nORDER BY name ASC\nLIMIT 100;"],
};

function computeDiff(a, b, options = {}) {
  const { ignoreWhitespace, ignoreCase, trimTrailing } = options;

  const normalize = (line) => {
    let s = line;
    if (trimTrailing) s = s.trimEnd();
    if (ignoreWhitespace) s = s.replace(/\s+/g, " ").trim();
    if (ignoreCase) s = s.toLowerCase();
    return s;
  };

  const aLines = a.split("\n").map((l, i) => ({ original: l, normalized: normalize(l), idx: i }));
  const bLines = b.split("\n").map((l, i) => ({ original: l, normalized: normalize(l), idx: i }));

  if (options.ignoreBlankLines) {
    aLines.filter((l, i, arr) => { arr.splice(i, l.normalized.trim() === "" ? 1 : 0); return true; });
  }

  const lcsTable = Array.from({ length: aLines.length + 1 }, () => new Array(bLines.length + 1).fill(0));
  for (let i = aLines.length - 1; i >= 0; i--) {
    for (let j = bLines.length - 1; j >= 0; j--) {
      if (aLines[i].normalized === bLines[j].normalized) {
        lcsTable[i][j] = lcsTable[i + 1][j + 1] + 1;
      } else {
        lcsTable[i][j] = Math.max(lcsTable[i + 1][j], lcsTable[i][j + 1]);
      }
    }
  }

  const result = [];
  let i = 0, j = 0;
  while (i < aLines.length || j < bLines.length) {
    if (i < aLines.length && j < bLines.length && aLines[i].normalized === bLines[j].normalized) {
      result.push({ type: "equal", left: aLines[i].original, right: bLines[j].original, leftIdx: i, rightIdx: j });
      i++; j++;
    } else if (j < bLines.length && (i >= aLines.length || lcsTable[i][j + 1] >= lcsTable[i + 1][j])) {
      result.push({ type: "added", right: bLines[j].original, rightIdx: j });
      j++;
    } else {
      result.push({ type: "removed", left: aLines[i].original, leftIdx: i });
      i++;
    }
  }

  return result;
}

function computeInlineCharDiff(a, b) {
  if (!a || !b) return [{ type: a ? "removed" : "added", text: a || b }];
  const result = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (result.length && result[result.length - 1].type === "equal") result[result.length - 1].text += a[i];
      else result.push({ type: "equal", text: a[i] });
      i++; j++;
    } else if (j < b.length && (i >= a.length)) {
      if (result.length && result[result.length - 1].type === "added") result[result.length - 1].text += b[j];
      else result.push({ type: "added", text: b[j] });
      j++;
    } else {
      if (result.length && result[result.length - 1].type === "removed") result[result.length - 1].text += a[i];
      else result.push({ type: "removed", text: a[i] });
      i++;
    }
  }
  return result;
}

function SideBySideDiff({ diff, options }) {
  const CONTEXT = options.showUnchanged ? Infinity : 3;
  const changed = new Set(diff.filter(d => d.type !== "equal").map((_, i) => i));

  const visible = diff.reduce((acc, item, idx) => {
    if (item.type !== "equal") { acc.push(idx); return acc; }
    const nearby = diff.some((d, di) => Math.abs(di - idx) <= CONTEXT && d.type !== "equal");
    if (nearby) acc.push(idx);
    return acc;
  }, []);

  let prev = -2;
  const rows = [];
  for (const idx of visible) {
    if (idx - prev > 1 && prev >= 0) {
      rows.push(
        <div key={`sep-${idx}`} className="flex text-xs text-muted-foreground/60 bg-muted/30">
          <div className="w-12 shrink-0 px-2 py-1 text-center border-r border-border">···</div>
          <div className="flex-1 px-4 py-1">···</div>
          <div className="w-12 shrink-0 px-2 py-1 text-center border-x border-border">···</div>
          <div className="flex-1 px-4 py-1">···</div>
        </div>
      );
    }
    const item = diff[idx];
    const leftNum = item.leftIdx !== undefined ? item.leftIdx + 1 : "";
    const rightNum = item.rightIdx !== undefined ? item.rightIdx + 1 : "";
    const leftBg = item.type === "removed" ? "bg-red-500/10" : item.type === "equal" ? "" : "bg-transparent";
    const rightBg = item.type === "added" ? "bg-green-500/10" : item.type === "equal" ? "" : "bg-transparent";

    let leftContent = item.left || "";
    let rightContent = item.right || "";

    if (options.inlineCharDiff && item.type !== "equal" && item.left && item.right) {
      const charDiff = computeInlineCharDiff(item.left, item.right);
      leftContent = charDiff.map((cd, ci) => (
        cd.type === "removed" ? <mark key={ci} className="bg-red-500/30 text-red-300">{cd.text}</mark> :
        cd.type === "equal" ? <span key={ci}>{cd.text}</span> : null
      )).filter(Boolean);
      rightContent = charDiff.map((cd, ci) => (
        cd.type === "added" ? <mark key={ci} className="bg-green-500/30 text-green-300">{cd.text}</mark> :
        cd.type === "equal" ? <span key={ci}>{cd.text}</span> : null
      )).filter(Boolean);
    }

    rows.push(
      <div key={idx} className="flex text-xs font-mono group">
        <div className="w-12 shrink-0 px-2 py-1 text-right text-muted-foreground/50 select-none border-r border-border">{leftNum}</div>
        <div className={cn("flex-1 px-4 py-1 min-w-0 whitespace-pre-wrap break-all", leftBg, item.type === "removed" && "text-red-400")}>
          {leftContent}
        </div>
        <div className="w-12 shrink-0 px-2 py-1 text-right text-muted-foreground/50 select-none border-x border-border">{rightNum}</div>
        <div className={cn("flex-1 px-4 py-1 min-w-0 whitespace-pre-wrap break-all", rightBg, item.type === "added" && "text-green-400")}>
          {rightContent}
        </div>
      </div>
    );
    prev = idx;
  }
  return <div className="font-mono text-xs divide-y divide-border/50">{rows}</div>;
}

function UnifiedDiff({ diff, options }) {
  const CONTEXT = options.showUnchanged ? Infinity : 3;
  const visible = diff.reduce((acc, item, idx) => {
    if (item.type !== "equal") { acc.push(idx); return acc; }
    const nearby = diff.some((d, di) => Math.abs(di - idx) <= CONTEXT && d.type !== "equal");
    if (nearby) acc.push(idx);
    return acc;
  }, []);

  let prev = -2;
  const rows = [];
  for (const idx of visible) {
    if (idx - prev > 1 && prev >= 0) {
      rows.push(
        <div key={`sep-${idx}`} className="text-xs text-muted-foreground/50 px-4 py-1 bg-muted/30">···</div>
      );
    }
    const item = diff[idx];
    const prefix = item.type === "added" ? "+" : item.type === "removed" ? "−" : " ";
    const rowBg = item.type === "added" ? "bg-green-500/10 text-green-400" : item.type === "removed" ? "bg-red-500/10 text-red-400" : "";
    const lineNum = item.rightIdx !== undefined ? item.rightIdx + 1 : item.leftIdx !== undefined ? item.leftIdx + 1 : "";
    const content = item.right || item.left || "";
    rows.push(
      <div key={idx} className={cn("flex text-xs font-mono", rowBg)}>
        <div className="w-10 shrink-0 px-2 py-1 text-right text-muted-foreground/50 select-none border-r border-border">{lineNum}</div>
        <div className="w-6 shrink-0 px-1 py-1 text-center select-none">{prefix}</div>
        <div className="flex-1 px-2 py-1 whitespace-pre-wrap break-all">{content}</div>
      </div>
    );
    prev = idx;
  }
  return <div className="font-mono text-xs divide-y divide-border/50">{rows}</div>;
}

export default function DiffChecker() {
  const [lang, setLang] = useState("Plain Text");
  const [viewMode, setViewMode] = useState("side");
  const [leftLabel, setLeftLabel] = useState("Original");
  const [rightLabel, setRightLabel] = useState("Modified");
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [diff, setDiff] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState({
    ignoreWhitespace: false,
    ignoreBlankLines: false,
    ignoreCase: false,
    trimTrailing: true,
    showUnchanged: false,
    inlineCharDiff: true,
  });

  const leftFile = useRef(null);
  const rightFile = useRef(null);

  const handleCompare = () => {
    if (!leftText && !rightText) {
      addToast({ title: "Nothing to compare", description: "Enter text in both panels.", type: "error" });
      return;
    }
    const result = computeDiff(leftText, rightText, options);
    setDiff(result);
  };

  const handleSwap = () => {
    setLeftText(rightText);
    setRightText(leftText);
    setDiff(null);
  };

  const handleSample = () => {
    const sample = SAMPLES[lang] || SAMPLES["Plain Text"];
    setLeftText(sample[0]);
    setRightText(sample[1]);
    setDiff(null);
  };

  const summary = diff ? {
    added: diff.filter(d => d.type === "added").length,
    removed: diff.filter(d => d.type === "removed").length,
    equal: diff.filter(d => d.type === "equal").length,
    total: diff.length,
  } : null;

  const similarity = summary
    ? Math.round((summary.equal / Math.max(summary.total, 1)) * 100)
    : null;

  const optionToggle = (key) => setOptions(o => ({ ...o, [key]: !o[key] }));

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div>
          <h1 className="text-xl font-bold mb-0.5">Diff Checker</h1>
          <p className="text-sm text-muted-foreground">Compare any two texts side-by-side or unified.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={lang}
            onChange={e => { setLang(e.target.value); setDiff(null); }}
            className="px-2 py-1.5 text-xs rounded-md border border-border bg-background hover:bg-accent focus:outline-none"
          >
            {LANGUAGES.map(l => <option key={l}>{l}</option>)}
          </select>

          <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
            <button onClick={() => setViewMode("side")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "side" ? "bg-foreground text-background" : "hover:bg-accent text-muted-foreground")}>
              Side by Side
            </button>
            <button onClick={() => setViewMode("unified")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "unified" ? "bg-foreground text-background" : "hover:bg-accent text-muted-foreground")}>
              Unified
            </button>
          </div>

          <button onClick={handleSwap} className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors">
            <ArrowLeftRight className="h-3 w-3" /> Swap
          </button>

          <button onClick={handleSample} className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors">
            <FileText className="h-3 w-3" /> Sample
          </button>

          <button
            onClick={() => setShowOptions(o => !o)}
            className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors", showOptions ? "border-foreground bg-accent" : "border-border hover:bg-accent")}
          >
            <Settings className="h-3 w-3" /> Options
          </button>

          <button
            onClick={handleCompare}
            className="px-4 py-1.5 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Compare <span className="opacity-60 ml-1">Ctrl+Enter</span>
          </button>

          <button onClick={() => { setLeftText(""); setRightText(""); setDiff(null); }} className="px-3 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {showOptions && (
        <div className="mb-4 p-4 rounded-lg border border-border bg-card">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { key: "ignoreWhitespace", label: "Ignore whitespace" },
              { key: "ignoreBlankLines", label: "Ignore blank lines" },
              { key: "ignoreCase", label: "Case insensitive" },
              { key: "trimTrailing", label: "Trim trailing whitespace" },
              { key: "showUnchanged", label: "Show all lines" },
              { key: "inlineCharDiff", label: "Inline char diff" },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={options[opt.key]} onChange={() => optionToggle(opt.key)} className="rounded" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PanelInput
          label={leftLabel}
          onLabelChange={setLeftLabel}
          text={leftText}
          onChange={(t) => { setLeftText(t); setDiff(null); }}
          onPaste={async () => { const t = await navigator.clipboard.readText(); setLeftText(t); setDiff(null); }}
          onUpload={(t) => { setLeftText(t); setDiff(null); }}
          onClear={() => { setLeftText(""); setDiff(null); }}
          fileRef={leftFile}
        />
        <PanelInput
          label={rightLabel}
          onLabelChange={setRightLabel}
          text={rightText}
          onChange={(t) => { setRightText(t); setDiff(null); }}
          onPaste={async () => { const t = await navigator.clipboard.readText(); setRightText(t); setDiff(null); }}
          onUpload={(t) => { setRightText(t); setDiff(null); }}
          onClear={() => { setRightText(""); setDiff(null); }}
          fileRef={rightFile}
        />
      </div>

      {diff && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
              +{summary.added} added
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">
              −{summary.removed} removed
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
              {summary.equal} unchanged
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
              {similarity}% similar
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={async () => {
                  const text = diff.map(d => {
                    if (d.type === "added") return `+ ${d.right}`;
                    if (d.type === "removed") return `- ${d.left}`;
                    return `  ${d.left}`;
                  }).join("\n");
                  await navigator.clipboard.writeText(text);
                  addToast({ title: "Diff copied!", type: "success" });
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Copy className="h-3 w-3" /> Copy Diff
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-auto">
            <div className="flex items-center border-b border-border px-4 py-2 bg-muted/30 text-xs font-medium">
              {viewMode === "side" ? (
                <>
                  <div className="w-12 shrink-0" />
                  <div className="flex-1 pl-4">{leftLabel}</div>
                  <div className="w-12 shrink-0" />
                  <div className="flex-1 pl-4">{rightLabel}</div>
                </>
              ) : (
                <>
                  <div className="w-16 shrink-0" />
                  <div className="flex-1">Diff</div>
                </>
              )}
            </div>
            {viewMode === "side"
              ? <SideBySideDiff diff={diff} options={options} />
              : <UnifiedDiff diff={diff} options={options} />}
          </div>
        </div>
      )}
    </div>
  );
}

function PanelInput({ label, onLabelChange, text, onChange, onPaste, onUpload, onClear, fileRef }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(label);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              autoFocus
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={() => { onLabelChange(editVal); setEditing(false); }}
              onKeyDown={e => { if (e.key === "Enter") { onLabelChange(editVal); setEditing(false); } }}
              className="text-sm font-medium bg-transparent border-b border-border focus:outline-none px-0 w-28"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="text-sm font-medium hover:text-muted-foreground transition-colors" title="Click to rename">
              {label}
            </button>
          )}
          {text && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{text.split("\n").length} lines</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onPaste} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
            <ClipboardPaste className="h-3 w-3" /> Paste
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
            <Upload className="h-3 w-3" /> Upload
          </button>
          <button onClick={onClear} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
          <input ref={fileRef} type="file" accept="*" className="hidden" onChange={e => {
            const f = e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = ev => onUpload(ev.target.result);
            r.readAsText(f);
            e.target.value = "";
          }} />
        </div>
      </div>
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder="Type or paste content here..."
        className="w-full min-h-[280px] p-4 rounded-lg border border-border bg-card font-mono text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring/30 transition-colors"
      />
    </div>
  );
}
