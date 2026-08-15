import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "../lib/utils";

const MIN_PCT = 20;
const MAX_PCT = 80;

// Two-pane layout with a draggable vertical divider between panes on large
// screens. Falls back to the existing stacked tool-grid on smaller screens,
// where dragging isn't practical anyway.
export default function ResizableSplit({ left, right, storageKey }) {
  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const [leftPct, setLeftPct] = useState(() => {
    if (!storageKey) return 50;
    const saved = Number(localStorage.getItem(storageKey));
    return saved >= MIN_PCT && saved <= MAX_PCT ? saved : 50;
  });

  const handleMove = useCallback((clientX) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setLeftPct(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!draggingRef.current) return;
      handleMove(e.clientX);
    };
    const onTouchMove = (e) => {
      if (!draggingRef.current) return;
      handleMove(e.touches[0].clientX);
    };
    const stopDragging = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (storageKey) localStorage.setItem(storageKey, String(leftPct));
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("touchend", stopDragging);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("touchend", stopDragging);
    };
  }, [handleMove, leftPct, storageKey]);

  const startDragging = () => {
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const resetSplit = () => {
    setLeftPct(50);
    if (storageKey) localStorage.setItem(storageKey, "50");
  };

  return (
    <>
      {/* Stacked layout below lg, unaffected by drag state */}
      <div className="tool-grid lg:hidden">
        {left}
        {right}
      </div>

      {/* Resizable split at lg+ */}
      <div ref={containerRef} className="hidden lg:flex gap-0 items-stretch">
        <div style={{ width: `${leftPct}%` }} className="min-w-0 pr-2.5">
          {left}
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize, double-click to reset"
          onMouseDown={startDragging}
          onTouchStart={startDragging}
          onDoubleClick={resetSplit}
          className="group relative w-2 shrink-0 cursor-col-resize flex items-center justify-center"
        >
          <div className="w-px h-full bg-border transition-colors group-hover:bg-ring/60" />
          <div className="absolute w-1 h-10 rounded-full bg-border group-hover:bg-ring/60 transition-colors" />
        </div>
        <div style={{ width: `${100 - leftPct}%` }} className="min-w-0 pl-2.5">
          {right}
        </div>
      </div>
    </>
  );
}
