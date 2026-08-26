import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Copy, Check, AlertCircle, Loader2, Link2 } from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";
import ScrollToTop from "../components/ScrollToTop";
import { getShare, createShare } from "../lib/codeShareApi";

// Kept in sync with api/_lib/validate.js's RESERVED_SLUGS — top-level
// paths that must never be treated as a shared-snippet slug.
export const RESERVED_SLUGS = new Set([
  "json", "sql", "diff", "base64", "html", "jwt", "stringify",
  "code-share", "share", "api", "assets", "src", "favicon.ico",
  "logo.png", "index.html", "robots.txt", "sitemap.xml",
]);

const MAX_CODE_LENGTH = 200_000;
// How long to wait after the user stops typing before autosaving — long
// enough to not fire on every keystroke, short enough to feel instant.
const AUTOSAVE_DELAY_MS = 800;

function formatDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return null;
  }
}

export default function SharedSnippet() {
  const { slug } = useParams();
  const [snippet, setSnippet] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [draftCode, setDraftCode] = useState("");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const saveTimerRef = useRef(null);
  const savedOnceRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await getShare(slug);
      setSnippet(data);
    } catch (err) {
      if (/not.*found|nothing.*shared/i.test(err.message || "")) {
        setNotFound(true);
      } else {
        setError(err.message || "Failed to load this link.");
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => clearTimeout(saveTimerRef.current);
  }, []);

  const handleCopyCode = async () => {
    if (!snippet?.code) return;
    await navigator.clipboard.writeText(snippet.code);
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

  const saveDraft = useCallback(
    async (text) => {
      if (!text.trim()) return;
      if (text.length > MAX_CODE_LENGTH) {
        setError(`Code exceeds the maximum size of ${MAX_CODE_LENGTH.toLocaleString()} characters.`);
        return;
      }
      const firstSave = !savedOnceRef.current;
      setSaveState("saving");
      setError(null);
      try {
        await createShare({ code: text, slug });
        savedOnceRef.current = true;
        setSaveState("saved");
        if (firstSave) {
          addToast({ title: "Saved!", type: "success" });
          await load();
        }
      } catch (err) {
        setSaveState("idle");
        setError(err.message || "Failed to save this snippet.");
      }
    },
    [slug, load],
  );

  const handleDraftChange = (text) => {
    setDraftCode(text);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDraft(text), AUTOSAVE_DELAY_MS);
  };

  return (
    <div className="tool-page">
      <div className="tool-page-header">
        <h1 className="tool-page-title font-mono">/{slug}</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      )}

      {!loading && notFound && !savedOnceRef.current && (
        <div className="tool-panel">
          <div className="tool-panel-header">
            <div className="tool-panel-title">
              <span className="text-xs text-muted-foreground">
                Nothing here yet — start typing to create it at this link.
              </span>
            </div>
            <div className="tool-panel-actions">
              {saveState === "saving" && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                </span>
              )}
              {saveState === "saved" && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
          </div>

          <textarea
            value={draftCode}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder="Start typing..."
            spellCheck={false}
            autoFocus
            className="tool-editor caret-foreground"
          />

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {!loading && notFound && savedOnceRef.current && (
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your saved snippet...
        </div>
      )}

      {!loading && !notFound && error && !snippet && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <Link
            to="/"
            className="mt-2 px-4 py-2 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Go home
          </Link>
        </div>
      )}

      {!loading && !notFound && snippet && (
        <div className="tool-panel">
          <div className="tool-panel-header">
            <div className="tool-panel-title flex-wrap gap-2">
              {snippet.createdAt && (
                <span className="text-xs text-muted-foreground">
                  Created {formatDate(snippet.createdAt)}
                </span>
              )}
            </div>
            <div className="tool-panel-actions">
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
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
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

          <pre className="w-full min-h-[240px] rounded-lg border border-border bg-card p-3 sm:p-4 font-mono text-sm overflow-auto whitespace-pre-wrap break-all">
            <code>{snippet.code}</code>
          </pre>
        </div>
      )}

      <ScrollToTop />
    </div>
  );
}
