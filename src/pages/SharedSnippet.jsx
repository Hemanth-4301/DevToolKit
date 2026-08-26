import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Copy, Check, AlertCircle, Loader2, Link2, ArrowUp } from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";
import CodeLoader from "../components/CodeLoader";
import { getShare, createShare } from "../lib/codeShareApi";

// Kept in sync with api/_lib/validate.js's RESERVED_SLUGS — top-level
// paths that must never be treated as a shared-snippet slug. Tool names
// (json, sql, jwt, ...) are intentionally NOT reserved: those tools are
// only reachable via the navbar now, so their names are free to use as
// slugs — only real routes, API paths, and static assets are off-limits.
export const RESERVED_SLUGS = new Set([
  "code-share", "share", "api", "assets", "src", "favicon.ico",
  "logo.png", "index.html", "robots.txt", "sitemap.xml",
]);

// Kept in sync with api/_lib/validate.js's MAX_CODE_LENGTH — Vercel
// serverless functions hard-cap request bodies at 4.5MB, so this is the
// largest payload that can actually reach the API in one request.
export const MAX_CODE_LENGTH = 4_000_000; // ~4MB of text

// How long to wait after the user stops typing before autosaving. Scaled
// up for large payloads so a multi-MB snippet isn't re-uploaded on every
// short pause while typing — the editor itself never locks either way.
function autosaveDelayFor(length) {
  if (length > 2_000_000) return 3000;
  if (length > 500_000) return 1500;
  return 800;
}

// Polling interval for picking up another viewer's saved changes without
// a page refresh — Vercel's plain serverless functions have no
// persistent connection, so this is the simplest way to approximate live
// sync without adding a third-party real-time service.
const POLL_INTERVAL_MS = 2000;

export default function SharedSnippet() {
  const { slug } = useParams();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | pending | saving | saved | error
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [createdAt, setCreatedAt] = useState(null);

  const saveTimerRef = useRef(null);
  // Tracks the most recently *requested* save so a slow earlier request
  // can't clobber the UI state after a newer one already resolved.
  const latestSaveTokenRef = useRef(0);
  const lastSavedCodeRef = useRef(null);
  const textareaRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [remoteUpdateAvailable, setRemoteUpdateAvailable] = useState(false);
  // Mirrors state that the polling interval's closure needs to read
  // without re-subscribing the interval on every keystroke.
  const isEditingRef = useRef(false);
  const codeRef = useRef("");
  codeRef.current = code;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const data = await getShare(slug);
        if (cancelled) return;
        setCode(data.code);
        setCreatedAt(data.createdAt);
        lastSavedCodeRef.current = data.code;
      } catch (err) {
        if (cancelled) return;
        if (!/not.*found|nothing.*shared/i.test(err.message || "")) {
          setLoadError(err.message || "Failed to load this link.");
        }
        // "not found" just means this is a brand-new, empty slug — no
        // error, the editor simply starts blank.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    return () => clearTimeout(saveTimerRef.current);
  }, []);

  // Poll for changes saved by another viewer of the same link — the
  // closest approximation of "live" sync without a persistent connection.
  // Skipped entirely while the user has unsent local edits in flight, so
  // a slower remote fetch can never overwrite what they just typed.
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(async () => {
      if (isEditingRef.current) return;
      try {
        const data = await getShare(slug);
        if (isEditingRef.current) return; // re-check post-await
        if (data.code !== codeRef.current) {
          setCode(data.code);
          lastSavedCodeRef.current = data.code;
          setCreatedAt(data.createdAt);
          setRemoteUpdateAvailable(true);
          setTimeout(() => setRemoteUpdateAvailable(false), 2000);
        }
      } catch {
        // A missed poll (network blip, or the snippet was deleted
        // elsewhere) isn't worth surfacing as an error — just try again
        // on the next tick.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [slug, loading]);

  const performSave = useCallback(
    async (text, token) => {
      setSaveState("saving");
      setSaveError(null);
      try {
        const result = await createShare({ code: text, slug });
        if (token !== latestSaveTokenRef.current) return; // superseded by a newer save
        lastSavedCodeRef.current = text;
        setCreatedAt((prev) => prev || result.createdAt);
        setSaveState("saved");
      } catch (err) {
        if (token !== latestSaveTokenRef.current) return;
        setSaveState("error");
        setSaveError(err.message || "Failed to save.");
      } finally {
        if (token === latestSaveTokenRef.current) isEditingRef.current = false;
      }
    },
    [slug],
  );

  const handleChange = (text) => {
    if (text.length > MAX_CODE_LENGTH) {
      setSaveError(`Code exceeds the maximum size of ${(MAX_CODE_LENGTH / 1_000_000).toFixed(0)}MB.`);
      return;
    }
    setCode(text);
    setSaveError(null);
    clearTimeout(saveTimerRef.current);

    if (text === lastSavedCodeRef.current) {
      setSaveState(lastSavedCodeRef.current ? "saved" : "idle");
      isEditingRef.current = false;
      return;
    }

    isEditingRef.current = true;
    setSaveState("pending");
    const token = ++latestSaveTokenRef.current;
    saveTimerRef.current = setTimeout(
      () => performSave(text, token),
      autosaveDelayFor(text.length),
    );
  };

  const handleCopyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    addToast({ title: "Code copied!", type: "success" });
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    addToast({ title: "Link copied!", type: "success" });
  };

  const handleScrollToTop = () => {
    textareaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm font-medium truncate">/{slug}</span>
          {createdAt && (
            <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
              Created {new Date(createdAt).toLocaleString()}
            </span>
          )}
          <SaveStatus state={saveState} />
          {remoteUpdateAvailable && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <ArrowUp className="h-3 w-3 rotate-180" /> Updated
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopyLink}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
              copiedLink
                ? "text-green-400"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {copiedLink ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
            {copiedLink ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={handleCopyCode}
            disabled={!code}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
              copiedCode
                ? "text-green-400"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {copiedCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedCode ? "Copied!" : "Copy Code"}
          </button>
        </div>
      </div>

      {(loadError || saveError) && (
        <div className="flex items-start gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs shrink-0">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{loadError || saveError}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <CodeLoader text={`fetching /${slug}...`} />
          </div>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => handleChange(e.target.value)}
              onScroll={(e) => setShowScrollTop(e.currentTarget.scrollTop > 300)}
              placeholder="Start typing..."
              spellCheck={false}
              autoFocus
              className="w-full h-full p-4 bg-background font-mono text-sm resize-none focus:outline-none caret-foreground"
            />
            <button
              type="button"
              onClick={handleScrollToTop}
              aria-label="Scroll to top"
              className={cn(
                "absolute bottom-6 right-6 h-11 w-11 rounded-full border border-border bg-card/95 backdrop-blur shadow-lg flex items-center justify-center text-foreground hover:bg-accent hover:scale-105 active:scale-95 transition-all duration-200",
                showScrollTop
                  ? "opacity-100 pointer-events-auto translate-y-0"
                  : "opacity-0 pointer-events-none translate-y-2",
              )}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SaveStatus({ state }) {
  if (state === "pending") {
    return <span className="text-xs text-muted-foreground">Editing…</span>;
  }
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-red-400">
        <AlertCircle className="h-3 w-3" /> Save failed
      </span>
    );
  }
  return null;
}
