import { useState, memo } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "../lib/utils";

function TreeGutter({ children }) {
  return (
    <div className="relative w-7 sm:w-8 shrink-0 flex items-center justify-start mr-3.5 self-stretch">
      {children || <span className="inline-flex h-5 w-5" aria-hidden="true" />}
      <span
        aria-hidden="true"
        className="absolute right-0 inset-y-0 w-px bg-border/70"
      />
    </div>
  );
}

function getValueType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function PrimitiveValue({ value, type }) {
  if (type === "string") {
    return (
      <span className="text-green-600 dark:text-green-400">"{value}"</span>
    );
  }
  if (type === "number") {
    return (
      <span className="text-orange-500 dark:text-orange-400">{value}</span>
    );
  }
  if (type === "boolean") {
    return (
      <span className="text-purple-500 dark:text-purple-400">
        {String(value)}
      </span>
    );
  }
  if (type === "null") {
    return <span className="text-red-500 dark:text-red-400">null</span>;
  }
  return <span>{String(value)}</span>;
}

function JsonNode({ keyName, value, depth, isLast, defaultCollapsed }) {
  const type = getValueType(value);
  const isContainer = type === "object" || type === "array";

  const shouldStartCollapsed =
    isContainer &&
    depth >= (typeof defaultCollapsed === "number" ? defaultCollapsed : 999);

  const [open, setOpen] = useState(!shouldStartCollapsed);

  const indent = { paddingLeft: `${depth * 16}px` };

  if (!isContainer) {
    return (
      <div className="min-h-8 leading-7 whitespace-nowrap flex items-center">
        <TreeGutter />
        <div style={indent} className="min-w-0">
          {keyName !== undefined && (
            <>
              <span className="text-blue-600 dark:text-blue-400">
                "{keyName}"
              </span>
              <span className="text-muted-foreground">: </span>
            </>
          )}
          <PrimitiveValue value={value} type={type} />
          {!isLast && <span className="text-muted-foreground">,</span>}
        </div>
      </div>
    );
  }

  const entries =
    type === "array" ? value.map((v, i) => [i, v]) : Object.entries(value);

  const isEmpty = entries.length === 0;
  const openBracket = type === "array" ? "[" : "{";
  const closeBracket = type === "array" ? "]" : "}";
  const itemCount = entries.length;
  const itemLabel =
    type === "array"
      ? `${itemCount} item${itemCount === 1 ? "" : "s"}`
      : `${itemCount} ${itemCount === 1 ? "key" : "keys"}`;

  return (
    <div>
      <div className="min-h-7 leading-7 whitespace-nowrap flex items-center group">
        <TreeGutter>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "relative inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors duration-200",
              "border-border bg-card text-muted-foreground shadow-sm",
              "hover:bg-accent hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              isEmpty && "invisible",
            )}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <Minus className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </button>
        </TreeGutter>
        <div style={indent} className="min-w-0">
          <span className="min-w-0">
            {keyName !== undefined && (
              <>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  "{keyName}"
                </span>
                <span className="text-muted-foreground">: </span>
              </>
            )}
            <span
              className="text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
              onClick={() => !isEmpty && setOpen((o) => !o)}
            >
              {openBracket}
            </span>
            {!open && !isEmpty && (
              <span
                className="text-muted-foreground/70 text-xs italic ml-1.5 cursor-pointer select-none hover:text-muted-foreground transition-colors"
                onClick={() => setOpen(true)}
              >
                {itemLabel}
              </span>
            )}
            {!open && (
              <span className="text-muted-foreground">
                {closeBracket}
                {!isLast && ","}
              </span>
            )}
            {open && isEmpty && (
              <span className="text-muted-foreground">
                {closeBracket}
                {!isLast && ","}
              </span>
            )}
          </span>
        </div>
      </div>

      {open && !isEmpty && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode
              key={k}
              keyName={type === "array" ? undefined : k}
              value={v}
              depth={depth + 1}
              isLast={i === entries.length - 1}
              defaultCollapsed={defaultCollapsed}
            />
          ))}
          <div className="min-h-8 leading-7 whitespace-nowrap flex items-center">
            <TreeGutter />
            <div style={indent}>
              <span className="text-muted-foreground">{closeBracket}</span>
              {!isLast && <span className="text-muted-foreground">,</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const JsonTree = memo(function JsonTree({ data, defaultCollapsed = 999 }) {
  return (
    <div className="font-mono text-sm text-nowrap panel-animate">
      <JsonNode
        value={data}
        depth={0}
        isLast={true}
        defaultCollapsed={defaultCollapsed}
      />
    </div>
  );
});

export default JsonTree;
