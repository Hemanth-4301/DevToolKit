import {
  ChevronDown,
  Code2,
  Database,
  ArrowLeftRight,
  GitCompare,
  FileCode2,
  KeyRound,
  Zap,
  WifiOff,
  UserX,
  HardDrive,
  Sparkles,
  Globe,
} from "lucide-react";
import { cn } from "../lib/utils";

// Deterministic pseudo-random binary strings for the Dev Mode hero rain —
// fixed per column (not re-rolled on every render) so the effect doesn't
// visibly "jump" on re-renders triggered by unrelated state changes.
const BINARY_RAIN_COLUMN_COUNT = 32;
const BINARY_RAIN_COLUMNS = Array.from(
  { length: BINARY_RAIN_COLUMN_COUNT },
  (_, i) => {
    let seed = i * 7919 + 13;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const length = 20 + Math.floor(rand() * 16);
    const digits = Array.from({ length }, () =>
      rand() < 0.5 ? "0" : "1",
    ).join("\n");
    return {
      digits,
      x: `${(i / BINARY_RAIN_COLUMN_COUNT) * 100 + rand() * 2}%`,
      // Negative delay starts each column already mid-fall instead of
      // waiting to begin — so the rain is already falling on first paint
      // instead of sitting static for a beat before the earliest column
      // kicks off.
      delay: `-${rand() * 8}s`,
      duration: `${5 + rand() * 5}s`,
      fontSize: `${11 + Math.floor(rand() * 4)}px`,
    };
});

const FLOATING_SNIPPETS = [
  { text: '{"name": "dev"}', x: "5%", delay: "0s", duration: "12s" },
  { text: "SELECT * FROM users", x: "18%", delay: "2.5s", duration: "16s" },
  { text: "JSON.stringify(obj)", x: "38%", delay: "1s", duration: "14s" },
  { text: "diffLines(a, b)", x: "58%", delay: "4s", duration: "18s" },
  { text: '{"id": 42, "ok": true}', x: "72%", delay: "1.8s", duration: "13s" },
  { text: "WHERE status = 'active'", x: "83%", delay: "3.5s", duration: "15s" },
  { text: "formatSQL(query)", x: "28%", delay: "6s", duration: "17s" },
  { text: '\\n\\t"key": "value"', x: "50%", delay: "5s", duration: "11s" },
  { text: "JSON.parse(str)", x: "90%", delay: "0.5s", duration: "19s" },
  { text: "GROUP BY id", x: "12%", delay: "7s", duration: "20s" },
];

const TOOLS = [
  {
    id: "json",
    icon: Code2,
    name: "JSON Formatter",
    desc: "Validate, format, minify and repair JSON with full syntax highlighting and error detection.",
    color: "text-blue-400",
    glow: "shadow-blue-500/20",
    gradient: "from-blue-500/15 to-blue-600/5",
    border: "border-blue-500/25 hover:border-blue-400/50",
    iconBg: "bg-blue-500/15",
    badge: "Format & Validate",
  },
  {
    id: "sql",
    icon: Database,
    name: "SQL Formatter",
    desc: "Beautify SQL queries across all major dialects with keyword highlighting and clause formatting.",
    color: "text-emerald-400",
    glow: "shadow-emerald-500/20",
    gradient: "from-emerald-500/15 to-emerald-600/5",
    border: "border-emerald-500/25 hover:border-emerald-400/50",
    iconBg: "bg-emerald-500/15",
    badge: "Multi-Dialect",
  },
  {
    id: "diff",
    icon: GitCompare,
    name: "Diff Checker",
    desc: "Compare any two texts side-by-side or unified — JSON, SQL, code, plain text, and more.",
    color: "text-orange-400",
    glow: "shadow-orange-500/20",
    gradient: "from-orange-500/15 to-orange-600/5",
    border: "border-orange-500/25 hover:border-orange-400/50",
    iconBg: "bg-orange-500/15",
    badge: "Side-by-Side",
  },
  {
    id: "base64",
    icon: FileCode2,
    name: "Base64 Converter",
    desc: "Convert files like PDF, DOCX, XLSX, images, and more into clean Base64 output with drag and drop.",
    color: "text-cyan-400",
    glow: "shadow-cyan-500/20",
    gradient: "from-cyan-500/15 to-cyan-600/5",
    border: "border-cyan-500/25 hover:border-cyan-400/50",
    iconBg: "bg-cyan-500/15",
    badge: "File to Base64",
  },
  {
    id: "html",
    icon: Globe,
    name: "HTML Previewer",
    desc: "Write or paste HTML and see a live, sandboxed preview update as you type.",
    color: "text-amber-400",
    glow: "shadow-amber-500/20",
    gradient: "from-amber-500/15 to-amber-600/5",
    border: "border-amber-500/25 hover:border-amber-400/50",
    iconBg: "bg-amber-500/15",
    badge: "Live Preview",
  },
  {
    id: "jwt",
    icon: KeyRound,
    name: "JWT Decoder",
    desc: "Decode and inspect JSON Web Tokens — view header, payload, signature, and expiry at a glance.",
    color: "text-pink-400",
    glow: "shadow-pink-500/20",
    gradient: "from-pink-500/15 to-pink-600/5",
    border: "border-pink-500/25 hover:border-pink-400/50",
    iconBg: "bg-pink-500/15",
    badge: "Decode & Inspect",
  },
  {
    id: "stringify",
    icon: ArrowLeftRight,
    name: "Stringify ↔ JSON",
    desc: "Convert between JSON objects and escaped strings with live bidirectional sync mode.",
    color: "text-purple-400",
    glow: "shadow-purple-500/20",
    gradient: "from-purple-500/15 to-purple-600/5",
    border: "border-purple-500/25 hover:border-purple-400/50",
    iconBg: "bg-purple-500/15",
    badge: "Bidirectional",
  },
];

const STATS = [
  { icon: Zap, label: "7 Tools" },
  { icon: WifiOff, label: "100% Offline" },
  { icon: UserX, label: "No Sign-up" },
  { icon: HardDrive, label: "localStorage" },
];

const UGLY_JSON = `{"name":"Hemanth","age":22,"address":{"city":"Mysore","zip":"571311"},"tags":["dev","js"],"active":true}`;
const PRETTY_JSON = `{
  "name": "Hemanth",
  "age": 22,
  "address": {
    "city": "Mysore",
    "zip": "571311"
  },
  "tags": ["dev", "js"],
  "active": true
}`;

export default function HomePage({ onTabChange, devMode }) {
  return (
    <div className="min-h-screen">
      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4 py-20">
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Binary rain — hero section only, all themes. Dev Mode gets a
            green tint via .binary-rain's devMode class; light/dark use the
            theme-aware foreground color instead. */}
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          {BINARY_RAIN_COLUMNS.map((col, i) => (
            <span
              key={i}
              className={cn("binary-rain", devMode && "binary-rain-dev")}
              style={{
                left: col.x,
                fontSize: col.fontSize,
                animationDuration: col.duration,
                animationDelay: col.delay,
              }}
            >
              {col.digits}
            </span>
          ))}
        </div>

        {/* Radial gradient center glow — disabled entirely in Dev Mode,
            which stays flat with no ambient glow of any kind. */}
        {!devMode && (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 40%, hsl(var(--background)) 20%, transparent 80%)",
            }}
          />
        )}

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent, hsl(var(--background)))",
          }}
        />

        {/* Floating snippets */}
        {FLOATING_SNIPPETS.map((s, i) => (
          <span
            key={i}
            className={cn(
              "floating-code",
              devMode
                ? "text-emerald-400/25"
                : "text-foreground/50 dark:text-foreground/40",
            )}
            style={{
              left: s.x,
              bottom: "-80px",
              animationDuration: s.duration,
              animationDelay: s.delay,
              opacity: 0,
            }}
          >
            {s.text}
          </span>
        ))}

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          {devMode && (
            <div className="glass inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium mb-6 studio-rise">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              <span className="gradient-text font-semibold">Dev Mode</span>
              <span className="text-muted-foreground">
                — built for design lovers
              </span>
            </div>
          )}

          <h1
            className={cn(
              "font-bold tracking-tight leading-none mb-6",
              "text-4xl sm:text-5xl md:text-6xl",
              devMode && "studio-rise",
            )}
            style={devMode ? { animationDelay: "0.05s" } : undefined}
          >
            {devMode ? (
              <>
                Every Dev Tool
                <br />
                <span className="gradient-text">You'll Love to Use.</span>
              </>
            ) : (
              <>
                Every Dev Tool
                <br />
                You Need.
                <span className="cursor-blink ml-1 text-muted-foreground">
                  |
                </span>
              </>
            )}
          </h1>

          <p
            className={cn(
              "text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed",
              devMode
                ? "text-muted-foreground studio-rise"
                : "text-muted-foreground",
            )}
            style={devMode ? { animationDelay: "0.1s" } : undefined}
          >
            Format JSON. Beautify SQL. Convert strings. Diff anything. All in
            one place — no installs, no sign-ups, fully offline.
          </p>

          <div
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-3 mb-12",
              devMode && "studio-rise",
            )}
            style={devMode ? { animationDelay: "0.15s" } : undefined}
          >
            <button
              onClick={() => onTabChange("json")}
              className={cn(
                "px-6 py-2.5 rounded-xl font-medium text-base active:scale-95 transition-all duration-200 w-full sm:w-auto",
                devMode
                  ? "text-[#0b0d10] studio-glow-strong shimmer-hover hover:-translate-y-0.5"
                  : "bg-foreground text-background hover:opacity-90",
              )}
              style={
                devMode ? { background: "var(--dev-fill)" } : undefined
              }
            >
              Open JSON Formatter →
            </button>
            <button
              onClick={() => {
                document
                  .getElementById("features-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className={cn(
                "px-6 py-2.5 rounded-xl border font-medium text-base transition-all duration-200 w-full sm:w-auto",
                devMode
                  ? "glass text-emerald-100 hover:bg-emerald-400/10 hover:-translate-y-0.5"
                  : "border-border text-foreground hover:bg-accent",
              )}
            >
              Explore Tools
            </button>
          </div>

          {/* Stats */}
          <div
            className={cn(
              "grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14",
              devMode && "studio-rise",
            )}
            style={devMode ? { animationDelay: "0.2s" } : undefined}
          >
            {STATS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-2xl border hover:-translate-y-1 transition-all duration-200",
                  devMode
                    ? "glass hover:bg-emerald-400/10"
                    : "border-border bg-card/60 backdrop-blur-sm hover:shadow-md",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    devMode ? "text-emerald-300" : "text-muted-foreground",
                  )}
                />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>

          {/* Live JSON preview */}
          <LiveJsonPreview devMode={devMode} />
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bounce-down text-muted-foreground">
          <ChevronDown className="h-5 w-5" />
        </div>
      </section>

      {/* ── TOOLS SECTION ── */}
      <section
        id="features-section"
        className="px-4 py-20 max-w-screen-xl mx-auto"
      >
        <div className="text-center mb-12">
          <h2
            className={cn(
              "text-2xl sm:text-3xl font-bold mb-3",
              devMode && "gradient-text",
            )}
          >
            Everything you need, nothing you don't.
          </h2>
          <p className="text-muted-foreground text-base">
            Seven powerful tools, zero dependencies, all in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onTabChange(tool.id)}
                className={cn(
                  "group relative text-left p-6 rounded-2xl border transition-all duration-300 overflow-hidden",
                  "hover:-translate-y-2 hover:shadow-2xl",
                  devMode
                    ? "glass gradient-border hover:bg-emerald-400/8"
                    : cn(
                        "border bg-card",
                        tool.border,
                        `hover:shadow-${tool.glow}`,
                      ),
                )}
              >
                {/* Gradient background */}
                {!devMode && (
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                      tool.gradient,
                    )}
                  />
                )}

                {/* Top shine line */}
                {!devMode && (
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                      `bg-gradient-to-r from-transparent via-current to-transparent ${tool.color}`,
                    )}
                  />
                )}

                <div className="relative z-10">
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-300",
                        devMode
                          ? "glass-strong group-hover:scale-110"
                          : cn(
                              tool.iconBg,
                              "border-border group-hover:scale-110",
                            ),
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 transition-all",
                          devMode ? "text-emerald-300" : tool.color,
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0",
                        devMode
                          ? "border-emerald-400/25 text-emerald-300 bg-emerald-400/5"
                          : cn(
                              "border-border text-muted-foreground",
                              tool.color.replace("text-", "text-"),
                            ),
                      )}
                    >
                      {tool.badge}
                    </span>
                  </div>

                  <h3 className="font-semibold text-base mb-2 transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                    {tool.desc}
                  </p>

                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2",
                      devMode ? "gradient-text" : tool.color,
                    )}
                  >
                    Open Tool
                    <span
                      className={cn(
                        "transition-transform group-hover:translate-x-1",
                        devMode && "text-emerald-300",
                      )}
                    >
                      →
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function JsonHighlight({ json }) {
  const tokens = [];
  const re =
    /("(?:[^"\\]|\\.)*")\s*:|"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|true|false|null|[{}[\],]/g;
  let lastIndex = 0;
  let match;
  let k = 0;
  while ((match = re.exec(json)) !== null) {
    if (match.index > lastIndex)
      tokens.push(<span key={k++}>{json.slice(lastIndex, match.index)}</span>);
    const val = match[0];
    if (val.endsWith(":"))
      tokens.push(
        <span key={k++} className="text-blue-400">
          {val}
        </span>,
      );
    else if (val.startsWith('"'))
      tokens.push(
        <span key={k++} className="text-green-400">
          {val}
        </span>,
      );
    else if (match[2] !== undefined)
      tokens.push(
        <span key={k++} className="text-orange-400">
          {val}
        </span>,
      );
    else if (val === "true" || val === "false")
      tokens.push(
        <span key={k++} className="text-purple-400">
          {val}
        </span>,
      );
    else if (val === "null")
      tokens.push(
        <span key={k++} className="text-red-400">
          {val}
        </span>,
      );
    else tokens.push(<span key={k++}>{val}</span>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < json.length)
    tokens.push(<span key={k++}>{json.slice(lastIndex)}</span>);
  return <>{tokens}</>;
}

function LiveJsonPreview({ devMode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden text-left max-w-lg mx-auto shadow-lg",
        devMode
          ? "glass-strong studio-glow"
          : "border-border bg-card/80 backdrop-blur",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 px-4 py-3 border-b text-sm",
          devMode
            ? "border-emerald-400/20 bg-black"
            : "border-border bg-background/50",
        )}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <span
          className={cn(
            "ml-2 text-xs font-mono",
            devMode ? "text-emerald-400/60" : "text-muted-foreground",
          )}
        >
          json-formatter.js
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-border">
        <div className="p-4">
          <div
            className={cn(
              "text-xs mb-2 font-medium font-mono",
              devMode ? "text-emerald-400/50" : "text-muted-foreground",
            )}
          >
            Input
          </div>
          <pre
            className={cn(
              "text-xs font-mono leading-relaxed overflow-hidden whitespace-pre-wrap break-all",
              "text-red-400/80",
            )}
          >
            {UGLY_JSON}
          </pre>
        </div>
        <div className="p-4">
          <div
            className={cn(
              "text-xs mb-2 font-medium font-mono",
              devMode ? "text-emerald-400/50" : "text-muted-foreground",
            )}
          >
            Formatted ✓
          </div>
          <pre className="text-xs font-mono leading-relaxed overflow-hidden">
            <JsonHighlight json={PRETTY_JSON} />
          </pre>
        </div>
      </div>
    </div>
  );
}
