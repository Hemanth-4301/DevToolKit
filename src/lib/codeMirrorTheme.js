import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Matches the app's CSS variable theme so the editor doesn't look like a
// foreign widget dropped onto the page — used instead of CodeMirror's
// built-in "light"/"dark" themes, whose fixed palettes clash with Dev
// Mode's near-black + neon-green surface. Shared by every CodeMirror
// instance in the app (Code Share, Migration Generator) so they all look
// consistent and stay in sync with a single edit.
export const cmTheme = EditorView.theme({
  "&": { backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))", height: "100%" },
  ".cm-content": { fontFamily: "var(--font-mono, monospace)", fontSize: "0.875rem", caretColor: "hsl(var(--foreground))" },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--background))",
    color: "hsl(var(--muted-foreground))",
    border: "none",
  },
  ".cm-activeLineGutter": { backgroundColor: "hsl(var(--accent))" },
  ".cm-activeLine": { backgroundColor: "hsl(var(--accent) / 0.4)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "hsl(var(--accent)) !important",
  },
});

// Light-background palette — chosen for contrast against a white/near-white
// --background rather than CodeMirror's default light theme.
export const lightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#a626a4" },
  { tag: [t.name, t.propertyName], color: "#383a42" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#4078f2" },
  { tag: t.definition(t.variableName), color: "#986801" },
  { tag: [t.string, t.special(t.string)], color: "#50a14f" },
  { tag: t.number, color: "#986801" },
  { tag: t.bool, color: "#986801" },
  { tag: t.null, color: "#986801" },
  { tag: t.comment, color: "#a0a1a7", fontStyle: "italic" },
  { tag: [t.className, t.typeName], color: "#c18401" },
  { tag: t.operator, color: "#0184bc" },
  { tag: [t.tagName], color: "#e45649" },
  { tag: [t.attributeName], color: "#986801" },
  { tag: t.meta, color: "#a626a4" },
  { tag: t.invalid, color: "#e45649" },
]);

// Dark palette used for both regular dark mode and Dev Mode — tuned
// against near-black backgrounds (dark: ~4% lightness, dev-mode: ~3%
// with a green accent), high-contrast without clashing with dev-mode's
// signature green border/accent color.
export const darkHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#c678dd" },
  { tag: [t.name, t.propertyName], color: "#e5e9f0" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#61afef" },
  { tag: t.definition(t.variableName), color: "#e5c07b" },
  { tag: [t.string, t.special(t.string)], color: "#98c379" },
  { tag: t.number, color: "#d19a66" },
  { tag: t.bool, color: "#d19a66" },
  { tag: t.null, color: "#d19a66" },
  { tag: t.comment, color: "#7f848e", fontStyle: "italic" },
  { tag: [t.className, t.typeName], color: "#e5c07b" },
  { tag: t.operator, color: "#56b6c2" },
  { tag: [t.tagName], color: "#e06c75" },
  { tag: [t.attributeName], color: "#d19a66" },
  { tag: t.meta, color: "#c678dd" },
  { tag: t.invalid, color: "#f44747" },
]);
