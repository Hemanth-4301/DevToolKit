import { useState } from "react";
import { ExternalLink, Trash2, Check, X, Loader2 } from "lucide-react";
import { formatTimestamp } from "../../lib/formatDate";
import { cn } from "../../lib/utils";

function formatSize(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

export default function SharesTable({ shares, onDelete }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  if (shares.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-10 text-center text-sm text-muted-foreground">
        No links created yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Preview</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shares.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                <td className="px-4 py-3 font-mono font-medium">/{s.id}</td>
                <td className="px-4 py-3 max-w-[240px]">
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {s.preview || <em className="not-italic opacity-60">empty</em>}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatSize(s.size)}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatTimestamp(s.createdAt)}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatTimestamp(s.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <a
                      href={`/${s.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Open"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <RowDeleteAction
                      confirming={confirmingId === s.id}
                      deleting={deletingId === s.id}
                      onAsk={() => setConfirmingId(s.id)}
                      onCancel={() => setConfirmingId(null)}
                      onConfirm={() => handleDelete(s.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="md:hidden divide-y divide-border">
        {shares.map((s) => (
          <div key={s.id} className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-medium text-sm">/{s.id}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`/${s.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <RowDeleteAction
                  confirming={confirmingId === s.id}
                  deleting={deletingId === s.id}
                  onAsk={() => setConfirmingId(s.id)}
                  onCancel={() => setConfirmingId(null)}
                  onConfirm={() => handleDelete(s.id)}
                />
              </div>
            </div>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {s.preview || <em className="not-italic opacity-60">empty</em>}
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{formatSize(s.size)}</span>
              <span>Created {formatTimestamp(s.createdAt)}</span>
              <span>Updated {formatTimestamp(s.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RowDeleteAction({ confirming, deleting, onAsk, onCancel, onConfirm }) {
  if (deleting) {
    return (
      <span className="p-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      </span>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={onConfirm}
          className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
          title="Confirm delete"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onAsk}
      className={cn(
        "p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors",
      )}
      title="Delete"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
