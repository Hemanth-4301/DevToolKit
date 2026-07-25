// Strips markdown syntax down to plain readable prose — used for the
// read-aloud feature so TTS doesn't speak literal asterisks, hashes, or
// backticks. Code blocks are summarized instead of read character-by-character.
export function stripMarkdownForSpeech(text) {
  return (text || "")
    .replace(/```[\s\S]*?```/g, " Code block omitted. ")
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s*>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // bullet list markers
    .replace(/^\s*\d+\.\s+/gm, "") // numbered list markers
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1") // bold+italic
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/__([^_]+)__/g, "$1") // bold (underscore)
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1") // italic (underscore)
    .replace(/~~([^~]+)~~/g, "$1") // strikethrough
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> label text
    .replace(/^\s*[-*_]{3,}\s*$/gm, "") // horizontal rules
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, ". ")
    .trim();
}
