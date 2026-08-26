import { highlightCode } from "../lib/codeHighlight";

// Distinctive, larger loading indicator for Code Share — a mock
// code-editor window whose lines type themselves in on a staggered loop
// with a blinking cursor, instead of a generic spinner. Reuses the same
// highlightCode() tokenizer the app already uses for real code display,
// so the mock lines are syntax-colored consistently with everywhere else.
const LINES = [
  { text: "// fetching your snippet", delay: 0 },
  { text: "const snippet = await connect(link);", delay: 0.9 },
  { text: "render(snippet);", delay: 1.8 },
];

export default function CodeLoader({ text = "loading snippet...", label }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="editor-loader-glow absolute -inset-6 rounded-3xl bg-blue-500/20 dark:bg-blue-400/15 blur-2xl pointer-events-none" />

        <div className="relative w-[min(90vw,420px)] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-muted/40">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
            <span className="ml-2 text-[11px] text-muted-foreground font-mono truncate">
              {text}
            </span>
          </div>

          <div className="px-4 py-5 sm:px-5 sm:py-6 font-mono text-sm leading-7 min-h-[132px]">
            {LINES.map((line, i) => (
              <div key={i} className="flex items-center">
                <span className="text-muted-foreground/50 select-none w-5 shrink-0 text-xs">
                  {i + 1}
                </span>
                <span
                  className="editor-loader-line"
                  style={{
                    "--type-chars": `${line.text.length}ch`,
                    "--type-steps": line.text.length,
                    "--type-delay": `${line.delay}s`,
                  }}
                >
                  {highlightCode(line.text).map((tok) => (
                    <span key={tok.key} className={tok.cls}>
                      {tok.text}
                    </span>
                  ))}
                </span>
                {i === LINES.length - 1 && (
                  <span className="cursor-blink w-[8px] h-[1.1em] bg-foreground/70 ml-0.5 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}
