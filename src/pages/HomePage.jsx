import {
  ChevronDown,
  Code2,
  Database,
  ArrowLeftRight,
  GitCompare,
  FileCode2,
  Zap,
  WifiOff,
  UserX,
  HardDrive,
} from "lucide-react";
import { cn } from "../lib/utils";

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
  { icon: Zap, label: "5 Tools" },
  { icon: WifiOff, label: "100% Offline" },
  { icon: UserX, label: "No Sign-up" },
  { icon: HardDrive, label: "localStorage" },
];

const UGLY_JSON = `{"name":"John","age":30,"address":{"city":"NYC","zip":"10001"},"tags":["dev","js"],"active":true}`;
const PRETTY_JSON = `{
  "name": "John",
  "age": 30,
  "address": {
    "city": "NYC",
    "zip": "10001"
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

        {/* Radial gradient center glow — theme-aware */}
        <div
          className="absolute inset-0"
          style={{
            background: devMode
              ? "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,255,0,0.08) 0%, transparent 70%)"
              : "radial-gradient(ellipse 70% 55% at 50% 40%, hsl(var(--background)) 20%, transparent 80%)",
          }}
        />

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
                ? "text-green-400"
                : "text-foreground/50 dark:text-foreground/40",
            )}
            style={{
              left: s.x,
              bottom: "-80px",
              animationDuration: s.duration,
              animationDelay: s.delay,
              opacity: 0,
              textShadow: devMode ? "0 0 8px rgba(0,255,0,0.8)" : undefined,
            }}
          >
            {s.text}
          </span>
        ))}

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          {devMode && (
            <div className="font-mono text-green-400 text-sm mb-4 opacity-80">
              &gt; initializing DevToolkit v1.0.0 ... [OK]
              <br />
              &gt; loading modules ... [DONE]
              <br />
              &gt; <span className="cursor-blink">_</span>
            </div>
          )}

          <h1
            className={cn(
              "font-bold tracking-tight leading-none mb-6",
              devMode
                ? "text-4xl sm:text-5xl md:text-6xl text-green-400 font-mono"
                : "text-4xl sm:text-5xl md:text-6xl",
            )}
            style={devMode ? { textShadow: "0 0 20px rgba(0,255,0,0.5)" } : {}}
          >
            {devMode ? "> Every Dev Tool" : "Every Dev Tool"}
            <br />
            {devMode ? (
              "  You Need._"
            ) : (
              <>
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
              devMode ? "text-green-300/80 font-mono" : "text-muted-foreground",
            )}
          >
            Format JSON. Beautify SQL. Convert strings. Diff anything. All in
            one place — no installs, no sign-ups, fully offline.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <button
              onClick={() => onTabChange("json")}
              className={cn(
                "px-6 py-2.5 rounded-lg font-medium text-base hover:opacity-90 active:scale-95 transition-all duration-150 w-full sm:w-auto",
                devMode
                  ? "bg-green-400 text-black font-mono shadow-[0_0_20px_rgba(0,255,0,0.4)] hover:shadow-[0_0_30px_rgba(0,255,0,0.6)]"
                  : "bg-foreground text-background",
              )}
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
                "px-6 py-2.5 rounded-lg border font-medium text-base transition-all duration-150 w-full sm:w-auto",
                devMode
                  ? "border-green-500/60 text-green-400 font-mono hover:bg-green-500/10"
                  : "border-border text-foreground hover:bg-accent",
              )}
            >
              Explore Tools
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14">
            {STATS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border backdrop-blur-sm hover:-translate-y-1 transition-all duration-200",
                  devMode
                    ? "border-green-500/30 bg-green-500/5 hover:border-green-400/60 hover:shadow-[0_0_15px_rgba(0,255,0,0.1)]"
                    : "border-border bg-card/60 hover:shadow-md",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    devMode ? "text-green-400" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    devMode && "text-green-300 font-mono",
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Live JSON preview */}
          <LiveJsonPreview devMode={devMode} />
        </div>

        {/* Scroll indicator */}
        <div
          className={cn(
            "absolute bottom-8 left-1/2 -translate-x-1/2 bounce-down",
            devMode ? "text-green-400" : "text-muted-foreground",
          )}
        >
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
              devMode && "text-green-400 font-mono",
            )}
          >
            {devMode
              ? "> Everything you need, nothing you don't."
              : "Everything you need, nothing you don't."}
          </h2>
          <p className="text-muted-foreground text-base">
            Five powerful tools, zero dependencies, all in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
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
                    ? "border-green-500/30 bg-green-500/5 hover:border-green-400/70 hover:shadow-[0_20px_40px_rgba(0,255,0,0.15)]"
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
                {devMode && (
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                )}

                {/* Top shine line */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    devMode
                      ? "bg-gradient-to-r from-transparent via-green-400/60 to-transparent"
                      : `bg-gradient-to-r from-transparent via-current to-transparent ${tool.color}`,
                  )}
                />

                <div className="relative z-10">
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-300",
                        devMode
                          ? "bg-green-500/10 border-green-500/30 group-hover:border-green-400/60 group-hover:shadow-[0_0_15px_rgba(0,255,0,0.2)]"
                          : cn(
                              tool.iconBg,
                              "border-border group-hover:scale-110",
                            ),
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 transition-all",
                          devMode ? "text-green-400" : tool.color,
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border font-medium opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0",
                        devMode
                          ? "border-green-500/40 text-green-400/80 bg-green-500/5 font-mono"
                          : cn(
                              "border-border text-muted-foreground",
                              tool.color.replace("text-", "text-"),
                            ),
                      )}
                    >
                      {tool.badge}
                    </span>
                  </div>

                  <h3
                    className={cn(
                      "font-semibold text-base mb-2 transition-colors",
                      devMode &&
                        "text-green-300 font-mono group-hover:text-green-400",
                    )}
                  >
                    {tool.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                    {tool.desc}
                  </p>

                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2",
                      devMode ? "text-green-400 font-mono" : tool.color,
                    )}
                  >
                    Open Tool
                    <span className="transition-transform group-hover:translate-x-1">
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
        "rounded-xl border overflow-hidden text-left max-w-lg mx-auto shadow-lg",
        devMode
          ? "border-green-500/30 bg-black/80 shadow-[0_0_30px_rgba(0,255,0,0.1)]"
          : "border-border bg-card/80 backdrop-blur",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 px-4 py-3 border-b text-sm",
          devMode
            ? "border-green-500/20 bg-green-500/5"
            : "border-border bg-background/50",
        )}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <span
          className={cn(
            "ml-2 text-xs font-mono",
            devMode ? "text-green-400/70" : "text-muted-foreground",
          )}
        >
          json-formatter.js
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="p-4">
          <div
            className={cn(
              "text-xs mb-2 font-medium font-mono",
              devMode ? "text-green-400/60" : "text-muted-foreground",
            )}
          >
            Input
          </div>
          <pre
            className={cn(
              "text-xs font-mono leading-relaxed overflow-hidden whitespace-pre-wrap break-all",
              devMode ? "text-red-400/70" : "text-red-400/80",
            )}
          >
            {UGLY_JSON}
          </pre>
        </div>
        <div className="p-4">
          <div
            className={cn(
              "text-xs mb-2 font-medium font-mono",
              devMode ? "text-green-400/60" : "text-muted-foreground",
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
