import { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Search,
  Replace,
  CaseSensitive,
  Sparkles,
  Check,
} from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "./Toast";

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(text, find, caseSensitive) {
  if (!text || !find) return 0;
  const re = new RegExp(escapeRegExp(find), caseSensitive ? "g" : "gi");
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function replaceAll(text, find, replaceWith, caseSensitive) {
  if (!find) return text;
  const re = new RegExp(escapeRegExp(find), caseSensitive ? "g" : "gi");
  return text.replace(re, replaceWith);
}

// Replaces only the next occurrence after `fromIndex` (wraps around).
function replaceNext(text, find, replaceWith, caseSensitive, fromIndex = 0) {
  if (!find) return { text, index: -1 };
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? find : find.toLowerCase();
  let idx = haystack.indexOf(needle, fromIndex);
  if (idx === -1) idx = haystack.indexOf(needle, 0);
  if (idx === -1) return { text, index: -1 };
  const next = text.slice(0, idx) + replaceWith + text.slice(idx + find.length);
  return { text: next, index: idx + replaceWith.length };
}

/**
 * Reusable Find & Replace modal.
 *
 * Props:
 * - open, onClose
 * - value: the current text content to operate on (input/left side, or the
 *   only side for single-pane tools like Diff Checker)
 * - onChange: (newText) => void
 * - secondaryValue / onSecondaryChange: optional second pane (the formatted
 *   output/right side). When provided, a "Apply to both sides" checkbox
 *   appears — off by default, so Replace only touches the output pane and
 *   never clobbers formatted output the user hasn't re-run yet. On, it
 *   applies the same find/replace to both panes.
 * - suggestions?: [{ label, description, find, replace, caseSensitive? }]
 */
export default function FindReplaceModal({
  open,
  onClose,
  value,
  onChange,
  secondaryValue,
  onSecondaryChange,
  suggestions = [],
}) {
  const hasSecondary = secondaryValue !== undefined && !!onSecondaryChange;
  const [find, setFind] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [syncBoth, setSyncBoth] = useState(false);
  // "Replace" (single-occurrence) cursor, tracked per target index so
  // syncing both input and output doesn't let one pane's match position
  // clobber the other's.
  const cursorsRef = useRef([0, 0]);
  const findInputRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (open) {
      cursorsRef.current = [0, 0];
      const focusTimer = setTimeout(
        () => findInputRef.current?.focus(),
        50,
      );
      return () => clearTimeout(focusTimer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onMouseDown = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, onClose]);

  // Which pane(s) a replace should touch: with no secondary pane, always the
  // primary. With a secondary pane, default to output-only (never silently
  // overwrite formatted output the user hasn't re-run) unless "apply to
  // both" is checked.
  const targets = hasSecondary
    ? syncBoth
      ? [
          { get: () => value, set: onChange },
          { get: () => secondaryValue, set: onSecondaryChange },
        ]
      : [{ get: () => secondaryValue, set: onSecondaryChange }]
    : [{ get: () => value, set: onChange }];

  const primaryForCount = hasSecondary && !syncBoth ? secondaryValue : value;
  const matchCount = useMemo(
    () => countMatches(primaryForCount || "", find, caseSensitive),
    [primaryForCount, find, caseSensitive],
  );

  if (!open) return null;

  const handleReplaceOne = () => {
    if (!find) return;
    let replaced = 0;
    targets.forEach((t, i) => {
      const { text, index } = replaceNext(
        t.get() || "",
        find,
        replaceWith,
        caseSensitive,
        cursorsRef.current[i] || 0,
      );
      if (index !== -1) {
        cursorsRef.current[i] = index;
        t.set(text);
        replaced++;
      }
    });
    if (replaced === 0) {
      addToast({ title: "No matches found", type: "error" });
      return;
    }
    addToast({ title: "Replaced 1 occurrence", type: "success" });
  };

  const handleReplaceAll = () => {
    if (!find) return;
    let totalCount = 0;
    for (const t of targets) {
      const count = countMatches(t.get() || "", find, caseSensitive);
      if (count > 0) {
        t.set(replaceAll(t.get() || "", find, replaceWith, caseSensitive));
        totalCount += count;
      }
    }
    if (totalCount === 0) {
      addToast({ title: "No matches found", type: "error" });
      return;
    }
    addToast({
      title: `Replaced ${totalCount} occurrence${totalCount !== 1 ? "s" : ""}`,
      type: "success",
    });
  };

  const applySuggestion = (s) => {
    let totalCount = 0;
    for (const t of targets) {
      const count = countMatches(t.get() || "", s.find, !!s.caseSensitive);
      if (count > 0) {
        t.set(replaceAll(t.get() || "", s.find, s.replace, !!s.caseSensitive));
        totalCount += count;
      }
    }
    if (totalCount === 0) {
      addToast({ title: "No matches found", type: "error" });
      return;
    }
    addToast({
      title: `${s.label}: replaced ${totalCount} occurrence${totalCount !== 1 ? "s" : ""}`,
      type: "success",
    });
  };

  return (
    <div className="fixed inset-0 z-100 pointer-events-none flex items-start justify-end overflow-hidden p-3 sm:p-4">
      <div
        ref={modalRef}
        className="fr-modal fr-modal-fly relative w-full max-w-xs sm:max-w-sm rounded-xl shadow-2xl pointer-events-auto"
      >
        <div className="relative rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Replace className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Find &amp; Replace</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    ref={findInputRef}
                    type="text"
                    value={find}
                    onChange={(e) => setFind(e.target.value)}
                    placeholder="Find..."
                    className="w-full pl-8 pr-3 py-2 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (e.ctrlKey || e.metaKey) handleReplaceAll();
                        else handleReplaceOne();
                      }
                    }}
                  />
                </div>
                <button
                  onClick={() => setCaseSensitive((c) => !c)}
                  title="Case sensitive"
                  className={cn(
                    "p-2 rounded-md border transition-colors shrink-0",
                    caseSensitive
                      ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  <CaseSensitive className="h-3.5 w-3.5" />
                </button>
              </div>
              {find && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {matchCount} match{matchCount !== 1 ? "es" : ""} found
                </p>
              )}
            </div>

            <div className="relative">
              <Replace className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={replaceWith}
                onChange={(e) => setReplaceWith(e.target.value)}
                placeholder="Replace with..."
                className="w-full pl-8 pr-3 py-2 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (e.ctrlKey || e.metaKey) handleReplaceAll();
                    else handleReplaceOne();
                  }
                }}
              />
            </div>

            {hasSecondary && (
              <button
                type="button"
                onClick={() => {
                  setSyncBoth((s) => !s);
                  // Target indices shift meaning when the pane count
                  // changes — stale per-pane cursors would otherwise
                  // resume "Replace" from the wrong spot in the wrong text.
                  cursorsRef.current = [0, 0];
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md border text-left transition-colors",
                  syncBoth
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-border hover:bg-accent/60",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center h-4 w-4 rounded shrink-0 border transition-colors",
                    syncBoth
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-muted-foreground/40 bg-background",
                  )}
                >
                  {syncBoth && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium">
                    Apply to both Input & Output
                  </span>
                </span>
              </button>
            )}

            {suggestions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => applySuggestion(s)}
                    className="w-full flex items-start gap-2 p-2 rounded-md border border-dashed border-border hover:border-solid hover:bg-accent/60 transition-colors text-left"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-400 mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">
                        {s.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {s.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReplaceOne}
              disabled={!find}
              className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={!find}
              className="px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Replace All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
