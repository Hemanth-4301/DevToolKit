import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "../lib/utils";
import { highlightCode } from "../lib/codeHighlight";

// Splits "some text ```lang\ncode\n``` more text" into an array of
// { type: "text", value } | { type: "code", lang, value } segments.
function parseSegments(text) {
  const segments = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      lang: match[1] || "text",
      value: match[2].replace(/\n$/, ""),
    });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

// Inline formatting: **bold**, *italic*, `inline code` — enough for typical
// assistant replies without pulling in a full markdown dependency.
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={`${keyPrefix}-${i}`}
          className="px-1 py-0.5 rounded bg-muted font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={`${keyPrefix}-${i}`} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

const HEADING_SIZES = {
  1: "text-lg font-bold",
  2: "text-base font-bold",
  3: "text-sm font-bold",
  4: "text-sm font-semibold",
  5: "text-sm font-semibold",
  6: "text-sm font-semibold",
};

// Groups lines of plain (non-code-fence) text into block-level elements —
// headings, bullet/numbered list items, and paragraphs — so markdown
// markers like "#" or "-" render as real structure instead of literal
// characters in the chat bubble.
function renderTextBlock(text, keyPrefix) {
  const lines = text.split("\n");
  const blocks = [];
  let para = [];
  let list = null; // { ordered: bool, items: [] }

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "p", value: para.join(" ") });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    const isRule = /^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line);

    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (isRule) {
      flushPara();
      flushList();
      blocks.push({ type: "hr" });
      continue;
    }
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: "h", level: heading[1].length, value: heading[2] });
      continue;
    }
    if (bullet) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { type: "list", ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    if (numbered) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { type: "list", ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();

  return blocks.map((block, bi) => {
    const key = `${keyPrefix}-b${bi}`;
    if (block.type === "hr") {
      return <hr key={key} className="my-2 border-border" />;
    }
    if (block.type === "h") {
      return (
        <p key={key} className={cn("mt-1.5 mb-1 first:mt-0", HEADING_SIZES[block.level])}>
          {renderInline(block.value, key)}
        </p>
      );
    }
    if (block.type === "list") {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          key={key}
          className={cn(
            "my-1.5 pl-5 space-y-0.5",
            block.ordered ? "list-decimal" : "list-disc",
          )}
        >
          {block.items.map((item, ii) => (
            <li key={`${key}-li${ii}`}>{renderInline(item, `${key}-li${ii}`)}</li>
          ))}
        </Tag>
      );
    }
    return (
      <p key={key} className="my-1 first:mt-0 last:mb-0">
        {renderInline(block.value, key)}
      </p>
    );
  });
}

function CodeBlock({ lang, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 rounded-lg border border-border overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
          {lang}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 text-xs rounded transition-colors",
            copied
              ? "text-green-500"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>
          {highlightCode(value).map((tok) => (
            <span key={tok.key} className={tok.cls}>
              {tok.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

export default function ChatMessageContent({ text }) {
  const segments = parseSegments(text || "");
  return (
    <div className="text-sm leading-relaxed wrap-break-word">
      {segments.map((seg, i) =>
        seg.type === "code" ? (
          <CodeBlock key={i} lang={seg.lang} value={seg.value} />
        ) : (
          <div key={i}>{renderTextBlock(seg.value, i)}</div>
        ),
      )}
    </div>
  );
}
