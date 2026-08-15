import { useState } from "react";
import {
  Copy,
  Check,
  Trash2,
  ClipboardPaste,
  AlertCircle,
  ShieldCheck,
  ShieldX,
  FileText,
  Maximize2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "../components/Toast";
import ScrollToTop from "../components/ScrollToTop";
import ResizableSplit from "../components/ResizableSplit";

function base64UrlDecode(str) {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad === 1) throw new Error("Invalid base64url length");
  if (pad) s += "=".repeat(4 - pad);
  try {
    return decodeURIComponent(
      atob(s)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
  } catch {
    return atob(s);
  }
}

function decodeJWT(token) {
  const parts = token.trim().split(".");
  if (parts.length !== 3)
    throw new Error(`JWT must have exactly 3 parts separated by dots (got ${parts.length})`);
  const [rawHeader, rawPayload, rawSignature] = parts;
  let header, payload;
  try { header = JSON.parse(base64UrlDecode(rawHeader)); }
  catch (e) { throw new Error("Failed to decode header: " + e.message); }
  try { payload = JSON.parse(base64UrlDecode(rawPayload)); }
  catch (e) { throw new Error("Failed to decode payload: " + e.message); }
  return { header, payload, signature: rawSignature, parts: { rawHeader, rawPayload, rawSignature } };
}

function formatTime(ts) {
  if (!ts || typeof ts !== "number") return null;
  return new Date(ts * 1000).toLocaleString();
}

function isExpired(exp) {
  if (!exp) return null;
  return Date.now() / 1000 > exp;
}

const CLAIM_DESCRIPTIONS = {
  iss: "Issuer — who issued the token",
  sub: "Subject — whom the token refers to",
  aud: "Audience — who the token is intended for",
  exp: "Expiration Time — token expires after this",
  nbf: "Not Before — token not valid before this time",
  iat: "Issued At — when the token was issued",
  jti: "JWT ID — unique identifier for this token",
};

function highlightJson(jsonStr) {
  const tokens = [];
  const re =
    /("(?:[^"\\]|\\.)*")\s*:|"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|true|false|null|[{}[\],]/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = re.exec(jsonStr)) !== null) {
    if (match.index > lastIndex)
      tokens.push(<span key={key++}>{jsonStr.slice(lastIndex, match.index)}</span>);
    const val = match[0];
    if (val.endsWith(":"))
      tokens.push(<span key={key++} className="text-blue-600 dark:text-blue-400">{val}</span>);
    else if (val.startsWith('"'))
      tokens.push(<span key={key++} className="text-green-600 dark:text-green-400">{val}</span>);
    else if (match[2] !== undefined)
      tokens.push(<span key={key++} className="text-orange-500 dark:text-orange-400">{val}</span>);
    else if (val === "true" || val === "false")
      tokens.push(<span key={key++} className="text-purple-500 dark:text-purple-400">{val}</span>);
    else if (val === "null")
      tokens.push(<span key={key++} className="text-red-500 dark:text-red-400">{val}</span>);
    else
      tokens.push(<span key={key++}>{val}</span>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < jsonStr.length)
    tokens.push(<span key={key++}>{jsonStr.slice(lastIndex)}</span>);
  return tokens;
}

const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

export default function JwtDecoder() {
  const [input, setInput] = useState("");
  const [decoded, setDecoded] = useState(null);
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const decode = (token) => {
    const t = token.trim();
    if (!t) { setDecoded(null); setError(null); return; }
    try {
      setDecoded(decodeJWT(t));
      setAnimKey((k) => k + 1);
      setError(null);
    } catch (e) {
      setDecoded(null);
      setError(e.message);
    }
  };

  const handleInput = (val) => {
    setInput(val);
    decode(val);
  };

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    handleInput(text);
  };

  const handleCopy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    addToast({ title: "Copied!", type: "success" });
  };

  const expired = decoded ? isExpired(decoded.payload?.exp) : null;
  const alg = decoded?.header?.alg || "";
  const isHmac = alg.startsWith("HS");
  const isRsa = alg.startsWith("RS") || alg.startsWith("PS");
  const isEc = alg.startsWith("ES");

  const decodedBody = decoded && (
    <div className="p-4 space-y-4">
      {/* Status */}
      <div className="output-line flex flex-wrap items-center gap-2 text-xs font-mono" style={{ "--line-delay": "0s" }}>
        <span className="px-2 py-1 rounded bg-muted border border-border text-foreground">
          {decoded.header.alg || "—"}
        </span>
        <span className="px-2 py-1 rounded bg-muted border border-border text-foreground">
          {decoded.header.typ || "JWT"}
        </span>
        {decoded.payload.exp && (
          expired ? (
            <span className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-500">
              <ShieldX className="h-3 w-3" /> Expired
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-500">
              <ShieldCheck className="h-3 w-3" /> Not Expired
            </span>
          )
        )}
        <span className="text-muted-foreground text-[10px] hidden sm:inline">
          {isHmac ? "Needs secret to verify" : isRsa ? "Verify with RSA public key" : isEc ? "Verify with EC public key" : ""}
        </span>
      </div>

      {/* HEADER */}
      <div className="output-line" style={{ "--line-delay": "0.06s" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">Header</span>
          <button
            onClick={() => handleCopy(JSON.stringify(decoded.header, null, 2), "header")}
            className={cn("flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors",
              copiedKey === "header" ? "text-green-400" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
          >
            {copiedKey === "header" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Copy
          </button>
        </div>
        <pre className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 font-mono text-sm whitespace-pre-wrap break-all select-text">
          {highlightJson(JSON.stringify(decoded.header, null, 2))}
        </pre>
      </div>

      {/* PAYLOAD */}
      <div className="output-line" style={{ "--line-delay": "0.12s" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400">Payload</span>
          <button
            onClick={() => handleCopy(JSON.stringify(decoded.payload, null, 2), "payload")}
            className={cn("flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors",
              copiedKey === "payload" ? "text-green-400" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
          >
            {copiedKey === "payload" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Copy
          </button>
        </div>
        <pre className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/20 font-mono text-sm whitespace-pre-wrap break-all select-text">
          {highlightJson(JSON.stringify(decoded.payload, null, 2))}
        </pre>
        {/* Claim details */}
        <div className="mt-2 space-y-1">
          {Object.entries(decoded.payload).map(([k, v]) => {
            const isTs = ["exp", "iat", "nbf"].includes(k);
            const timeStr = isTs ? formatTime(v) : null;
            const expiredClaim = k === "exp" ? isExpired(v) : null;
            const desc = CLAIM_DESCRIPTIONS[k];
            return (
              <div key={k} className="flex flex-wrap items-start gap-2 text-xs font-mono px-2 py-1.5 rounded bg-muted/30 border border-border/50">
                <span className="text-violet-500 dark:text-violet-400 shrink-0 w-16 sm:w-20">{k}</span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <span className={cn("break-all",
                    typeof v === "boolean" ? "text-purple-500 dark:text-purple-400" :
                    typeof v === "number" ? "text-orange-500 dark:text-orange-400" :
                    v === null ? "text-red-400" : "text-green-600 dark:text-green-400"
                  )}>
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </span>
                  {timeStr && (
                    <div className={cn(
                      expiredClaim === true ? "text-red-400" :
                      expiredClaim === false ? "text-green-500" : "text-muted-foreground"
                    )}>
                      {timeStr}{expiredClaim === true ? " — EXPIRED" : expiredClaim === false ? " — valid" : ""}
                    </div>
                  )}
                  {desc && <div className="text-muted-foreground/70">{desc}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SIGNATURE */}
      <div className="output-line" style={{ "--line-delay": "0.18s" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400">Signature</span>
          <button
            onClick={() => handleCopy(decoded.signature, "signature")}
            className={cn("flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors",
              copiedKey === "signature" ? "text-green-400" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
          >
            {copiedKey === "signature" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Copy
          </button>
        </div>
        <pre className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 font-mono text-sm text-blue-500 dark:text-blue-400 break-all whitespace-pre-wrap select-text">
          {decoded.signature}
        </pre>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {isHmac
            ? `HMAC-${alg.slice(2)} — requires the secret key to verify.`
            : isRsa
            ? `${alg} (RSA) — verify using the issuer's public key or JWKS endpoint.`
            : isEc
            ? `${alg} (ECDSA) — verify using the issuer's public key or JWKS endpoint.`
            : "Verification requires the secret or public key from the token issuer."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="tool-page">
      <div className="tool-page-header">
        <h1 className="tool-page-title">JWT Decoder</h1>
        <p className="tool-page-subtitle">
          Decode and inspect JSON Web Tokens — header, payload, and signature. No data leaves your browser.
        </p>
      </div>

      <ResizableSplit
        storageKey="devtoolkit_jwt_split"
        left={
        <div className="tool-panel">
          <div className="tool-panel-header">
            <div className="tool-panel-title">
              <span className="text-sm font-medium">JWT Token</span>
              {input && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {input.trim().length} chars
                </span>
              )}
            </div>
            <div className="tool-panel-actions">
              <button
                onClick={handlePaste}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <ClipboardPaste className="h-3 w-3" /> Paste
              </button>
              <button
                onClick={() => handleInput(SAMPLE_JWT)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <FileText className="h-3 w-3" /> Sample
              </button>
              <button
                onClick={() => { setInput(""); setDecoded(null); setError(null); }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
          </div>

          <textarea
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={"Paste your JWT token here...\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ..."}
            className={cn(
              "w-full min-h-[120px] p-3 sm:p-4 rounded-lg border bg-card font-mono text-sm resize-y focus:outline-none focus:ring-1 transition-colors break-all",
              error && input.trim()
                ? "border-red-500/50 focus:ring-red-500/30"
                : decoded
                  ? "border-green-500/50 focus:ring-green-500/30"
                  : "border-border focus:ring-ring/30",
            )}
            spellCheck={false}
          />

          {/* Color-coded token parts preview */}
          {input.trim() && !error && (
            <div className="mt-2 p-2.5 rounded-md bg-muted/40 border border-border font-mono text-xs break-all leading-relaxed">
              {input.trim().split(".").map((part, i) => (
                <span key={i}>
                  <span className={cn(
                    i === 0 ? "text-red-500 dark:text-red-400" :
                    i === 1 ? "text-violet-500 dark:text-violet-400" :
                    "text-blue-500 dark:text-blue-400"
                  )}>{part}</span>
                  {i < 2 && <span className="text-muted-foreground font-bold">.</span>}
                </span>
              ))}
            </div>
          )}

          {error && input.trim() && (
            <div className="flex items-start gap-2 p-3 mt-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="font-mono">{error}</span>
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Header</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Payload</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Signature</span>
          </div>
        </div>
        }
        right={
        <div className="tool-panel">
          <div className="tool-panel-header">
            <div className="tool-panel-title">
              <span className="text-sm font-medium">Decoded Output</span>
              {decoded && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded font-mono",
                  expired === true
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : expired === false
                      ? "bg-green-500/10 text-green-500 border border-green-500/20"
                      : "bg-muted text-muted-foreground"
                )}>
                  {expired === true ? "Expired" : expired === false ? "Valid" : decoded.header.alg}
                </span>
              )}
            </div>
            {decoded && (
              <div className="tool-panel-actions">
                <button
                  onClick={() => handleCopy(JSON.stringify(decoded.payload, null, 2), "payload-top")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                    copiedKey === "payload-top" ? "text-green-400" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  {copiedKey === "payload-top" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Copy Payload
                </button>
                <button
                  onClick={() => setShowFullscreen(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <div key={animKey} className="w-full min-h-[240px] sm:min-h-[420px] rounded-lg border border-border bg-card overflow-auto">
            {!decoded && !error && (
              <div className="flex items-center justify-center h-full min-h-[240px] text-muted-foreground text-sm">
                Decoded output will appear here...
              </div>
            )}
            {decodedBody}
          </div>
        </div>
        }
      />

      {showFullscreen && decoded && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold">Decoded Output</span>
            <button
              onClick={() => setShowFullscreen(false)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
            {decodedBody}
          </div>
        </div>
      )}

      <ScrollToTop />
    </div>
  );
}
