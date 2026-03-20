import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

let listeners = [];
let toasts = [];
let nextId = 1;

export function addToast({ title, description, type = "default", duration = 3000 }) {
  const id = nextId++;
  const toast = { id, title, description, type };
  toasts = [...toasts, toast];
  listeners.forEach(l => l([...toasts]));
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    listeners.forEach(l => l([...toasts]));
  }, duration);
}

export function ToastContainer() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => { listeners = listeners.filter(l => l !== setItems); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {items.map(toast => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all",
            "bg-card text-card-foreground border-border",
            toast.type === "success" && "border-green-500/30 bg-green-500/10",
            toast.type === "error" && "border-red-500/30 bg-red-500/10"
          )}
        >
          {toast.type === "success" && <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />}
          {toast.type === "error" && <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            {toast.title && <p className="text-sm font-medium">{toast.title}</p>}
            {toast.description && <p className="text-xs text-muted-foreground mt-0.5">{toast.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
