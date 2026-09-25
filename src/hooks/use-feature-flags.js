import { useState, useEffect, useCallback } from "react";
import { getPublicFlags } from "../lib/flagsApi";

const DEFAULT_FLAGS = { chatbot: false, migrationGenerator: false };

// Fetched once per page load (not polled) — flags change rarely enough
// (an admin flipping a toggle) that a stale value for the rest of a
// session is an acceptable trade-off against re-fetching constantly.
export function useFeatureFlags() {
  const [flags, setFlags] = useState(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getPublicFlags();
      setFlags({ ...DEFAULT_FLAGS, ...data });
    } catch {
      // A failed flags fetch shouldn't block the page — fall back to
      // defaults (admin-only), the same as if nothing were ever enabled.
      setFlags(DEFAULT_FLAGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...flags, loading, refresh };
}
