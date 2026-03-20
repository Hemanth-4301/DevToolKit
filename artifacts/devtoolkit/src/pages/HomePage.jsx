import { useEffect, useRef } from "react";
import { ChevronDown, Code2, Database, ArrowLeftRight, GitCompare, Zap, WifiOff, UserX, HardDrive } from "lucide-react";
import { cn } from "../lib/utils";

const FLOATING_SNIPPETS = [
  { text: '{"name": "dev"}', x: "8%", delay: "0s", duration: "14s", opacity: 0.5 },
  { text: "SELECT * FROM", x: "20%", delay: "3s", duration: "18s", opacity: 0.35 },
  { text: 'JSON.stringify()', x: "40%", delay: "1.5s", duration: "16s", opacity: 0.4 },
  { text: "diffLines(a, b)", x: "60%", delay: "5s", duration: "20s", opacity: 0.3 },
  { text: '{"id": 42}', x: "75%", delay: "2s", duration: "15s", opacity: 0.45 },
  { text: "WHERE id = ?", x: "85%", delay: "4s", duration: "17s", opacity: 0.3 },
  { text: "formatSQL()", x: "30%", delay: "7s", duration: "19s", opacity: 0.35 },
  { text: '\\n\\t"key": "val"', x: "55%", delay: "6s", duration: "13s", opacity: 0.4 },
];

const TOOLS = [
  {
    id: "json",
    icon: Code2,
    name: "JSON Formatter",
    desc: "Validate, format, minify, and explore JSON with syntax highlighting and error detection.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 dark:bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    id: "sql",
    icon: Database,
    name: "SQL Formatter",
    desc: "Beautify SQL queries across all major dialects with keyword highlighting and clause formatting.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    id: "stringify",
    icon: ArrowLeftRight,
    name: "Stringify ↔ JSON",
    desc: "Convert between JSON objects and stringified strings with live bidirectional sync mode.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  {
    id: "diff",
    icon: GitCompare,
    name: "Diff Checker",
    desc: "Compare any two texts side-by-side or unified — JSON, SQL, code, plain text, and more.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
];

const STATS = [
  { icon: Zap, label: "4 Tools" },
  { icon: WifiOff, label: "100% Offline" },
  { icon: UserX, label: "No Sign-up" },
  { icon: HardDrive, label: "localStorage Only" },
];

const UGLY_JSON = `{"name":"John","age":30,"address":{"city":"NYC","zip":"10001"},"tags":["dev","js"],"active":true}`;

const PRETTY_JSON = `{
  "name": "John",
  "age": 30,
  "address": {
    "city": "NYC",
    "zip": "10001"
  },
  "tags": [
    "dev",
    "js"
  ],
  "active": true
}`;

export default function HomePage({ onTabChange }) {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4 py-20">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 50%, hsl(var(--background)) 30%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 50% 40% at 50% 40%, hsl(240 10% 12% / 0.8) 0%, transparent 70%)",
          }}
        />

        {FLOATING_SNIPPETS.map((s, i) => (
          <span
            key={i}
            className="floating-code text-foreground/30"
            style={{
              left: s.x,
              bottom: "-60px",
              animationDuration: s.duration,
              animationDelay: s.delay,
              opacity: 0,
            }}
          >
            {s.text}
          </span>
        ))}

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-none mb-6">
            Every Dev Tool
            <br />
            You Need.
            <span className="cursor-blink ml-1 text-muted-foreground">|</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Format JSON. Beautify SQL. Convert strings. Diff anything.
            All in one place — no installs, no sign-ups, fully offline.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <button
              onClick={() => onTabChange("json")}
              className="px-6 py-2.5 rounded-lg bg-foreground text-background font-medium text-sm hover:opacity-90 active:scale-95 transition-all duration-150 w-full sm:w-auto"
            >
              Open JSON Formatter →
            </button>
            <button
              onClick={() => {
                document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-6 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-accent transition-all duration-150 w-full sm:w-auto"
            >
              Explore Tools
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14">
            {STATS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>

          <LiveJsonPreview />
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground bounce-down">
          <ChevronDown className="h-5 w-5" />
        </div>
      </section>

      <section id="features-section" className="px-4 py-20 max-w-screen-xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Everything you need, nothing you don't.</h2>
          <p className="text-muted-foreground text-sm">Four powerful tools, zero dependencies, all in your browser.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOOLS.map(tool => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                className="group p-6 rounded-xl border border-border bg-card hover:-translate-y-1 hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => onTabChange(tool.id)}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-4 border", tool.bg, tool.border)}>
                  <Icon className={cn("h-5 w-5", tool.color)} />
                </div>
                <h3 className="font-semibold text-sm mb-2">{tool.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">{tool.desc}</p>
                <span className="text-xs font-medium text-foreground group-hover:underline">Open Tool →</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function LiveJsonPreview() {
  return (
    <div className="rounded-xl border border-border bg-card/80 backdrop-blur overflow-hidden text-left max-w-lg mx-auto shadow-lg">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-background/50">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <span className="ml-2 text-xs text-muted-foreground font-mono">json-formatter.js</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="p-4">
          <div className="text-xs text-muted-foreground mb-2 font-medium">Input</div>
          <pre className="text-xs font-mono text-red-400/80 leading-relaxed overflow-hidden whitespace-pre-wrap break-all">
            {UGLY_JSON}
          </pre>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted-foreground mb-2 font-medium">Formatted ✓</div>
          <pre className="text-xs font-mono leading-relaxed overflow-hidden">
            <JsonHighlight json={PRETTY_JSON} />
          </pre>
        </div>
      </div>
    </div>
  );
}

function JsonHighlight({ json }) {
  const tokens = [];
  const re = /("(?:[^"\\]|\\.)*")\s*:|"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|true|false|null|[{}[\],]/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(json)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={lastIndex}>{json.slice(lastIndex, match.index)}</span>);
    }
    const val = match[0];
    if (val.endsWith(":")) {
      tokens.push(<span key={match.index} className="text-blue-400">{val}</span>);
    } else if (val.startsWith('"')) {
      tokens.push(<span key={match.index} className="text-green-400">{val}</span>);
    } else if (match[2] !== undefined) {
      tokens.push(<span key={match.index} className="text-orange-400">{val}</span>);
    } else if (val === "true" || val === "false") {
      tokens.push(<span key={match.index} className="text-purple-400">{val}</span>);
    } else if (val === "null") {
      tokens.push(<span key={match.index} className="text-red-400">{val}</span>);
    } else {
      tokens.push(<span key={match.index}>{val}</span>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < json.length) {
    tokens.push(<span key={lastIndex}>{json.slice(lastIndex)}</span>);
  }
  return <>{tokens}</>;
}
