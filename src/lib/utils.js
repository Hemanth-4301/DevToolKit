import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Keys whose values are large and safe to drop when quota is exceeded.
const HISTORY_KEYS_PREFIX = [
  "devtoolkit_json_history",
  "devtoolkit_sql_history",
  "devtoolkit_stringify_history",
  "devtoolkit_json_state",
  "devtoolkit_sql_state",
  "devtoolkit_stringify_state",
  "devtoolkit_diff_state",
  "devtoolkit_html_preview_state",
  "devtoolkit_chat_history",
];

function clearHistoryStorage() {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      HISTORY_KEYS_PREFIX.some(
        (prefix) => key === prefix || key.startsWith(prefix),
      )
    ) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

/**
 * localStorage.setItem with quota-exceeded recovery.
 * On QuotaExceededError: clears all history/state keys and retries once.
 * If it still fails, the write is silently dropped (state is non-critical).
 */
export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      clearHistoryStorage();
      try {
        localStorage.setItem(key, value);
      } catch {
        // still over quota after clearing history — drop silently
      }
    }
  }
}
