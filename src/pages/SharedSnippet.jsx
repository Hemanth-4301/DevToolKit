import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Copy, Check, AlertCircle, Loader2, Link2, ArrowUp, ChevronDown } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";
import CodeLoader from "../components/CodeLoader";
import { getShare, createShare } from "../lib/codeShareApi";
import { detectLanguageId, languageExtensionFor, LANGUAGE_OPTIONS } from "../lib/detectLanguage";
import { EDITOR_THEMES, getEditorTheme } from "../lib/editorThemes";

const EDITOR_THEME_STORAGE_KEY = "devtoolkit_codeshare_theme";

// Matches the app's CSS variable theme so the editor doesn't look like a
// foreign widget dropped onto the page — used instead of CodeMirror's
// built-in "light"/"dark" themes, whose fixed palettes clash with Dev
// Mode's near-black + neon-green surface.
const cmTheme = EditorView.theme({
  "&": { backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))", height: "100%" },
  ".cm-content": { fontFamily: "var(--font-mono, monospace)", fontSize: "0.875rem", caretColor: "hsl(var(--foreground))" },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--background))",
    color: "hsl(var(--muted-foreground))",
    border: "none",
  },
  ".cm-activeLineGutter": { backgroundColor: "hsl(var(--accent))" },
  ".cm-activeLine": { backgroundColor: "hsl(var(--accent) / 0.4)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "hsl(var(--accent)) !important",
  },
});

// Light-background palette — chosen for contrast against a white/near-white
// --background rather than CodeMirror's default light theme.
const lightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#a626a4" },
  { tag: [t.name, t.propertyName], color: "#383a42" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#4078f2" },
  { tag: t.definition(t.variableName), color: "#986801" },
  { tag: [t.string, t.special(t.string)], color: "#50a14f" },
  { tag: t.number, color: "#986801" },
  { tag: t.bool, color: "#986801" },
  { tag: t.null, color: "#986801" },
  { tag: t.comment, color: "#a0a1a7", fontStyle: "italic" },
  { tag: [t.className, t.typeName], color: "#c18401" },
  { tag: t.operator, color: "#0184bc" },
  { tag: [t.tagName], color: "#e45649" },
  { tag: [t.attributeName], color: "#986801" },
  { tag: t.meta, color: "#a626a4" },
  { tag: t.invalid, color: "#e45649" },
]);

// Dark palette used for both regular dark mode and Dev Mode — tuned
// against near-black backgrounds (dark: ~4% lightness, dev-mode: ~3%
// with a green accent), high-contrast without clashing with dev-mode's
// signature green border/accent color.
const darkHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#c678dd" },
  { tag: [t.name, t.propertyName], color: "#e5e9f0" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#61afef" },
  { tag: t.definition(t.variableName), color: "#e5c07b" },
  { tag: [t.string, t.special(t.string)], color: "#98c379" },
  { tag: t.number, color: "#d19a66" },
  { tag: t.bool, color: "#d19a66" },
  { tag: t.null, color: "#d19a66" },
  { tag: t.comment, color: "#7f848e", fontStyle: "italic" },
  { tag: [t.className, t.typeName], color: "#e5c07b" },
  { tag: t.operator, color: "#56b6c2" },
  { tag: [t.tagName], color: "#e06c75" },
  { tag: [t.attributeName], color: "#d19a66" },
  { tag: t.meta, color: "#c678dd" },
  { tag: t.invalid, color: "#f44747" },
]);

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

// DD/MM/YYYY, h:mm AM/PM — e.g. "05/09/2026, 2:30 PM".
function formatTimestamp(value) {
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${dd}/${mm}/${yyyy}, ${hours}:${minutes} ${ampm}`;
}

export default function SharedSnippet() {
  const { slug } = useParams();
  // Both regular dark mode and Dev Mode add the "dark" class to <html>
  // (see App.jsx), so reading it directly covers both without needing a
  // separate devMode prop threaded down to this page.
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const [selectedLang, setSelectedLang] = useState("auto");
  const [editorThemeId, setEditorThemeId] = useState(
    () => localStorage.getItem(EDITOR_THEME_STORAGE_KEY) || "default",
  );
  useEffect(() => {
    localStorage.setItem(EDITOR_THEME_STORAGE_KEY, editorThemeId);
  }, [editorThemeId]);
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
  const scrollerRef = useRef(null);
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
    scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const effectiveLangId = useMemo(
    () => (selectedLang === "auto" ? detectLanguageId(code) : selectedLang),
    [selectedLang, code],
  );
  const languageExtension = useMemo(() => languageExtensionFor(effectiveLangId), [effectiveLangId]);
  const selectedEditorTheme = getEditorTheme(editorThemeId);
  const extensions = useMemo(() => {
    const exts =
      selectedEditorTheme.id === "default"
        ? [cmTheme, syntaxHighlighting(isDark ? darkHighlight : lightHighlight)]
        : [selectedEditorTheme.extension];
    exts.push(EditorView.lineWrapping);
    if (languageExtension) exts.push(languageExtension);
    return exts;
  }, [languageExtension, isDark, selectedEditorTheme]);

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm font-medium truncate">/{slug}</span>
          {createdAt && (
            <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
              Created {formatTimestamp(createdAt)}
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
          <div className="relative shrink-0">
            <select
              value={editorThemeId}
              onChange={(e) => setEditorThemeId(e.target.value)}
              aria-label="Editor theme"
              className="appearance-none pl-2 pr-6 py-1 text-xs rounded border border-border bg-background text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {EDITOR_THEMES.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
          <div className="relative shrink-0">
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              aria-label="Language"
              className="appearance-none pl-2 pr-6 py-1 text-xs rounded border border-border bg-background text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
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
            <CodeMirror
              value={code}
              onChange={handleChange}
              theme="none"
              extensions={extensions}
              autoFocus
              placeholder="Start typing..."
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
              height="100%"
              className="h-full [&_.cm-editor]:h-full"
              onCreateEditor={(view) => {
                scrollerRef.current = view.scrollDOM;
                view.scrollDOM.addEventListener("scroll", () => {
                  setShowScrollTop(view.scrollDOM.scrollTop > 300);
                });
              }}
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
