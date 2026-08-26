import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Share2, ArrowRight } from "lucide-react";
import { RESERVED_SLUGS } from "./SharedSnippet";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

function randomSlug() {
  // Unambiguous-ish, URL-friendly random slug for users who don't want to
  // pick their own name.
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export default function CodeShareLanding() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  const [error, setError] = useState(null);

  const goToSlug = (raw) => {
    const clean = raw.trim().toLowerCase();
    if (!clean) {
      navigate(`/${randomSlug()}`);
      return;
    }
    if (!SLUG_RE.test(clean)) {
      setError(
        "Link must be 2-32 characters: lowercase letters, numbers, and hyphens only, and can't start with a hyphen.",
      );
      return;
    }
    if (RESERVED_SLUGS.has(clean)) {
      setError(`"${clean}" is reserved — try a different link.`);
      return;
    }
    navigate(`/${clean}`);
  };

  return (
    <div className="tool-page flex flex-col items-center justify-center min-h-[calc(100vh-56px)] text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-400 mb-5">
        <Share2 className="h-7 w-7" />
      </div>
      <h1 className="tool-page-title mb-2">Code Share</h1>
      <p className="tool-page-subtitle max-w-md mb-6">
        Pick a link, start typing, and it saves automatically. Share the URL
        with anyone — they'll see exactly what you typed.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToSlug(slug);
        }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center rounded-md border border-border bg-card overflow-hidden">
          <span className="pl-3 pr-1 text-xs text-muted-foreground font-mono shrink-0">
            {window.location.host}/
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32));
              setError(null);
            }}
            placeholder="your-link (optional)"
            autoFocus
            className="flex-1 py-2.5 pr-3 bg-transparent text-sm font-mono focus:outline-none min-w-0"
          />
        </div>

        {error && <p className="text-xs text-red-400 mt-2 text-left">{error}</p>}

        <button
          type="submit"
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {slug.trim() ? "Go to link" : "Create random link"}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
