import { useRef, useCallback } from "react";

// Typed characters within this window are treated as one undo step instead
// of one-per-keystroke — matches how native text-editor undo feels (undoing
// a sentence you just typed, not each letter).
const COALESCE_MS = 500;
const MAX_HISTORY = 200;

// Tracks a linear undo/redo history for a piece of string state that's set
// both by direct typing and by programmatic actions (paste, sample, upload,
// clear, restore-from-history) — native textarea undo only sees the former
// and gets clobbered by the latter, so this replaces it entirely.
//
// onRestore(newValue), if given, runs synchronously right after undo/redo
// sets the value — use it to re-run validation/formatting against the
// restored value instead of reading state that hasn't re-rendered yet.
export function useUndoHistory(value, setValue, onRestore) {
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const lastPushTime = useRef(0);
  const skipNextPush = useRef(false);

  // Call after every setValue(next) that should be recorded as an undo step.
  const record = useCallback((prevValue) => {
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    const now = Date.now();
    if (
      undoStack.current.length > 0 &&
      now - lastPushTime.current < COALESCE_MS
    ) {
      // Coalesce into the in-flight edit — keep the original "before" value.
    } else {
      undoStack.current.push(prevValue);
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    }
    lastPushTime.current = now;
    redoStack.current = [];
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop();
    redoStack.current.push(value);
    skipNextPush.current = true;
    lastPushTime.current = 0;
    setValue(prev);
    onRestore?.(prev);
  }, [value, setValue, onRestore]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    undoStack.current.push(value);
    skipNextPush.current = true;
    lastPushTime.current = 0;
    setValue(next);
    onRestore?.(next);
  }, [value, setValue, onRestore]);

  const handleKeyDown = useCallback(
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return false;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return true;
      }
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
        return true;
      }
      return false;
    },
    [undo, redo],
  );

  return { record, undo, redo, handleKeyDown };
}
