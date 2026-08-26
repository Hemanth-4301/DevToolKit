// Distinctive loading indicator for Code Share — a line that "types
// itself out" in a loop with a blinking cursor, instead of a generic spinner.
export default function CodeLoader({ text = "loading snippet...", label }) {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <div className="font-mono text-sm flex items-center">
        <span className="text-foreground/70 select-none mr-1.5">{">"}</span>
        <span
          className="code-typing-loader"
          style={{
            "--type-chars": `${text.length}ch`,
            "--type-steps": text.length,
          }}
        >
          {text}
        </span>
        <span className="cursor-blink w-[7px] h-[1em] bg-foreground/70 ml-0.5" />
      </div>
      {label && <span className="text-xs">{label}</span>}
    </div>
  );
}
