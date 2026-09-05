import { langs } from "@uiw/codemirror-extensions-langs";

// Curated subset of @uiw/codemirror-extensions-langs shown in the manual
// language picker — the full package exposes 100+ loaders (many obscure
// aliases), so this trims it to the languages people actually paste.
export const LANGUAGE_OPTIONS = [
  { id: "auto", label: "Auto-detect" },
  { id: "plain", label: "Plain text" },
  { id: "js", label: "JavaScript" },
  { id: "jsx", label: "JSX" },
  { id: "ts", label: "TypeScript" },
  { id: "tsx", label: "TSX" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "cs", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "php", label: "PHP" },
  { id: "rb", label: "Ruby" },
  { id: "sql", label: "SQL" },
  { id: "html", label: "HTML" },
  { id: "xml", label: "XML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML" },
  { id: "markdown", label: "Markdown" },
  { id: "sh", label: "Shell" },
];

export function languageExtensionFor(id) {
  if (!id || id === "auto" || id === "plain") return null;
  const loader = langs[id];
  return loader ? loader() : null;
}

// Ordered checks — first match wins. Each is a cheap heuristic over raw
// text, not a real parser, so patterns are picked to be reasonably unique
// to their language and avoid false-positives on plain prose.
const RULES = [
  { lang: "json", test: (t) => /^\s*[\[{]/.test(t) && isJson(t) },
  { lang: "html", test: (t) => /<\/?[a-z][\s\S]*>/i.test(t) && /<(html|div|span|body|head|!doctype)/i.test(t) },
  { lang: "xml", test: (t) => /^\s*<\?xml/i.test(t) || (/<\/?[a-zA-Z][\s\S]*>/.test(t) && /<\/[a-zA-Z]/.test(t)) },
  { lang: "css", test: (t) => /[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/.test(t) && /;\s*\}/.test(t) },
  { lang: "sql", test: (t) => /\b(select|insert\s+into|update\s+\w+\s+set|delete\s+from|create\s+table)\b/i.test(t) },
  { lang: "python", test: (t) => /^\s*(def |class |import |from \w+ import|if __name__)/m.test(t) || (/:\s*\n\s+\S/.test(t) && /\bdef\b/.test(t)) },
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

// Returns a language id (from LANGUAGE_OPTIONS) detected from the text, or
// null if it doesn't look like recognizable code (plain prose/notes).
export function detectLanguageId(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const rule of RULES) {
    if (rule.test(trimmed)) return rule.lang;
  }
  return null;
}
