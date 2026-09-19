import { useEffect } from "react";
import { History, RotateCcw, X } from "lucide-react";

export default function HistoryModal({
  title,
  history,
  onRestore,
  onClear,
  onClose,
  emptyText = "No history yet.",
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/70 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[min(680px,calc(100vh-1.5rem))] sm:max-h-[min(680px,calc(100vh-3rem))] overflow-hidden rounded-xl border border-border bg-card shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <History className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h2 id="history-modal-title" className="font-semibold truncate">
              {title}
            </h2>
            <span className="text-xs text-muted-foreground">({history.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-3 sm:p-5">
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <div className="space-y-2">
              {history.map((entry, index) => (
                <div
                  key={`${entry.timestamp}-${index}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    <div className="text-xs sm:text-sm font-mono truncate">
                      {entry.preview}…
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onRestore(entry);
                      onClose();
                    }}
                    aria-label="Restore this history entry"
                    className="inline-flex items-center gap-1.5 shrink-0 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-background transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span className="hidden sm:inline">Restore</span>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={onClear}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors pt-2"
              >
                Clear History
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
