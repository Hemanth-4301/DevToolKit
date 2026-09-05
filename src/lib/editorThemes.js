import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { monokai } from "@uiw/codemirror-theme-monokai";
import { solarizedDark, solarizedLight } from "@uiw/codemirror-theme-solarized";
import { nord } from "@uiw/codemirror-theme-nord";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { materialDark, materialLight } from "@uiw/codemirror-theme-material";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";

// "default" isn't listed here — it's handled separately in SharedSnippet
// since it isn't a CodeMirror Extension, it's the app's own CSS-variable
// theme + custom HighlightStyle that adapts to light/dark/dev mode.
export const EDITOR_THEMES = [
  { id: "default", label: "DevToolkit (default)", dark: null },
  { id: "vscode-dark", label: "VS Code Dark", extension: vscodeDark, dark: true },
  { id: "vscode-light", label: "VS Code Light", extension: vscodeLight, dark: false },
  { id: "dracula", label: "Dracula", extension: dracula, dark: true },
  { id: "monokai", label: "Monokai", extension: monokai, dark: true },
  { id: "github-dark", label: "GitHub Dark", extension: githubDark, dark: true },
  { id: "github-light", label: "GitHub Light", extension: githubLight, dark: false },
  { id: "nord", label: "Nord", extension: nord, dark: true },
  { id: "solarized-dark", label: "Solarized Dark", extension: solarizedDark, dark: true },
  { id: "solarized-light", label: "Solarized Light", extension: solarizedLight, dark: false },
  { id: "material-dark", label: "Material Dark", extension: materialDark, dark: true },
  { id: "material-light", label: "Material Light", extension: materialLight, dark: false },
  { id: "tokyo-night", label: "Tokyo Night", extension: tokyoNight, dark: true },
];

export function getEditorTheme(id) {
  return EDITOR_THEMES.find((t) => t.id === id) || EDITOR_THEMES[0];
}
