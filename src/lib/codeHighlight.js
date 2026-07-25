// Lightweight, dependency-free syntax highlighter for chat code blocks.
// Not a full language parser — just enough token classification (keywords,
// strings, comments, numbers, function calls) to make code readable at a
// glance across the common languages the assistant replies in.

const KEYWORDS = new Set(
  [
    // control flow / declarations (JS/TS/Python/Java/C-family/Go/Rust/etc.)
    "if", "else", "elif", "for", "while", "do", "switch", "case", "default",
    "break", "continue", "return", "yield", "function", "def", "fn", "func",
    "class", "struct", "interface", "enum", "trait", "impl", "extends",
    "implements", "new", "delete", "try", "catch", "except", "finally",
    "throw", "raise", "async", "await", "import", "export", "from", "as",
    "package", "namespace", "using", "include", "require", "module",
    "const", "let", "var", "final", "static", "public", "private",
    "protected", "readonly", "abstract", "override", "virtual", "void",
    "null", "None", "nil", "undefined", "true", "false", "True", "False",
    "self", "this", "super", "lambda", "with", "pass", "global", "nonlocal",
    "in", "of", "is", "not", "and", "or", "typeof", "instanceof", "new",
    // types
    "int", "float", "double", "bool", "boolean", "string", "str", "char",
    "byte", "long", "short", "list", "List", "dict", "Dict", "map", "Map",
    "set", "Set", "tuple", "Tuple", "Optional", "Array", "Vec", "any",
    // SQL
    "SELECT", "FROM", "WHERE", "JOIN", "INSERT", "UPDATE", "DELETE",
    "CREATE", "TABLE", "ALTER", "DROP", "GROUP", "ORDER", "BY", "HAVING",
    "LIMIT", "VALUES", "INTO", "SET", "AND", "OR", "NOT", "NULL", "AS",
    "DISTINCT", "UNION", "ON", "INNER", "LEFT", "RIGHT", "OUTER",
    // shell
    "echo", "then", "fi", "done", "esac", "export", "local",
  ].flatMap((w) => [w, w.toUpperCase(), w.toLowerCase()]),
);

const TOKEN_RE =
  /(\/\/[^\n]*|#[^\n]*|--[^\n]*)|(\/\*[\s\S]*?\*\/)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)(?=\s*\()|(\b[A-Za-z_$][A-Za-z0-9_$]*\b)|([{}()[\];,.:])/g;

export function highlightCode(code) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ key: key++, text: code.slice(lastIndex, match.index) });
    }
    const [full, comment, blockComment, string, number, funcCall, word, punct] = match;
    if (comment || blockComment) {
      nodes.push({ key: key++, text: full, cls: "text-slate-400 dark:text-slate-500 italic" });
    } else if (string) {
      nodes.push({ key: key++, text: full, cls: "text-green-600 dark:text-green-400" });
    } else if (number) {
      nodes.push({ key: key++, text: full, cls: "text-orange-500 dark:text-orange-400" });
    } else if (funcCall) {
      nodes.push({ key: key++, text: full, cls: "text-yellow-600 dark:text-yellow-400" });
    } else if (word) {
      if (KEYWORDS.has(word)) {
        nodes.push({ key: key++, text: full, cls: "text-purple-500 dark:text-purple-400 font-medium" });
      } else {
        nodes.push({ key: key++, text: full });
      }
    } else if (punct) {
      nodes.push({ key: key++, text: full, cls: "text-muted-foreground" });
    } else {
      nodes.push({ key: key++, text: full });
    }
    lastIndex = TOKEN_RE.lastIndex;
  }
  if (lastIndex < code.length) {
    nodes.push({ key: key++, text: code.slice(lastIndex) });
  }
  return nodes;
}
