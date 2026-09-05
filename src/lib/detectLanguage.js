import { langs } from "@uiw/codemirror-extensions-langs";

// Ordered checks — first match wins. Each is a cheap heuristic over raw
// text, not a real parser, so patterns are picked to be reasonably unique
// to their language and avoid false-positives on plain prose.
const RULES = [
  { lang: "json", test: (t) => /^\s*[\[{]/.test(t) && isJson(t) },
  { lang: "html", test: (t) => /<\/?[a-z][\s\S]*>/i.test(t) && /<(html|div|span|body|head|!doctype)/i.test(t) },
  { lang: "xml", test: (t) => /^\s*<\?xml/i.test(t) || (/<\/?[a-zA-Z][\s\S]*>/.test(t) && /<\/[a-zA-Z]/.test(t)) },
  { lang: "css", test: (t) => /[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/.test(t) && /;\s*\}/.test(t) },
  { lang: "sql", test: (t) => /\b(select|insert\s+into|update\s+\w+\s+set|delete\s+from|create\s+table)\b/i.test(t) },
  { lang: "python", test: (t) => /^\s*(def |class |import |from \w+ import|if __name__)/m.test(t) || /:\s*\n\s+\S/.test(t) && /\bdef\b/.test(t) },
  { lang: "java", test: (t) => /\b(public|private|protected)\s+(static\s+)?(class|void|int|String)\b/.test(t) },
  { lang: "cpp", test: (t) => /#include\s*<[\w.]+>/.test(t) || /\bstd::/.test(t) },
  { lang: "c", test: (t) => /#include\s*<[\w.]+\.h>/.test(t) },
  { lang: "go", test: (t) => /\bfunc\s+\w*\s*\(/.test(t) && /\bpackage\s+\w+/.test(t) },
  { lang: "php", test: (t) => /<\?php/.test(t) },
  { lang: "markdown", test: (t) => /^#{1,6}\s+\S/m.test(t) && /\n\s*[-*]\s+\S/.test(t) },
  { lang: "yaml", test: (t) => /^[\w-]+:\s*.+$/m.test(t) && /^\s{2,}[\w-]+:/m.test(t) },
  {
    lang: "jsx",
    test: (t) =>
      /\b(function|const|let|var)\s+\w+\s*=|\bimport\s+.+\bfrom\b|=>|\bexport\s+(default\s+)?/.test(t) &&
      /[;{}]/.test(t),
  },
];

function isJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

// Returns a CodeMirror language extension for the given text, or null if
// the text doesn't look like recognizable code (plain prose/notes).
export function detectLanguageExtension(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const rule of RULES) {
    if (rule.test(trimmed)) {
      const loader = langs[rule.lang];
      return loader ? loader() : null;
    }
  }
  return null;
}
