import { useState, useRef, useEffect } from "react";
import { Lock, X } from "lucide-react";
import { cn } from "../lib/utils";

const PIN_LENGTH = 4;
const CORRECT_PIN = "4301";

export default function PinUnlockModal({ open, onClose, onSuccess }) {
  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(""));
  const [shake, setShake] = useState(false);
  const inputRefs = useRef([]);
  // The modal is opened by the 3rd click of a click burst on the logo
  // (see Navbar's triple-click handler). Trailing clicks from that same
  // burst (4th, 5th, ...) can land on this backdrop the instant it mounts
  // — this ignores outside-clicks for a brief window after opening so
  // those don't immediately dismiss the modal that just appeared.
  const openedAt = useRef(0);

  useEffect(() => {
    if (open) {
      openedAt.current = Date.now();
      setDigits(Array(PIN_LENGTH).fill(""));
      setShake(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const checkPin = (nextDigits) => {
    const entered = nextDigits.join("");
    if (entered.length !== PIN_LENGTH) return;
    if (entered === CORRECT_PIN) {
      onSuccess();
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setDigits(Array(PIN_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      }, 400);
    }
  };

  const handleChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    checkPin(next);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (!pasted) return;
    const next = Array(PIN_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, PIN_LENGTH - 1)]?.focus();
    checkPin(next);
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (Date.now() - openedAt.current < 400) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pin-modal-in w-full max-w-xs rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Enter PIN</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <div
            className={cn("flex items-center gap-3", shake && "pin-shake")}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className={cn(
                  "h-12 w-10 text-center text-lg font-semibold rounded-lg border bg-background focus:outline-none focus:ring-1 transition-colors",
                  shake
                    ? "border-red-500/60 focus:ring-red-500/30"
                    : "border-border focus:ring-ring/30",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            This unlocks a hidden feature.
          </p>
        </div>
      </div>
    </div>
  );
}
