// Supports multiple API keys (VITE_GEMINI_API_KEY_1/2/3, ...) so that if one
// hits its rate limit, the next is tried automatically before surfacing an
// error to the user. Falls back to the single-key VITE_GEMINI_API_KEY name
// too, so existing single-key setups keep working.
const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY,
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
  import.meta.env.VITE_GEMINI_API_KEY_4,
  import.meta.env.VITE_GEMINI_API_KEY_5,
].filter((k) => !!k && k.trim().length > 0);

const MODEL = "gemini-flash-latest";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function hasGeminiKey() {
  return API_KEYS.length > 0;
}

const SYSTEM_INSTRUCTION = {
  role: "user",
  parts: [
    {
      text: "You are the built-in AI assistant for DevToolkit, a web app with tools for formatting JSON/SQL, diffing text, converting Base64, decoding JWTs, and stringifying JSON. Be concise and helpful. When you share code or formatted data, put it in a fenced code block with a language tag (e.g. ```json, ```sql, ```js) so it renders properly.",
    },
  ],
};
const SYSTEM_ACK = {
  role: "model",
  parts: [{ text: "Understood — I'll keep responses concise and use fenced code blocks for code or data." }],
};

// A key's error is worth rotating past (try the next key) rather than
// failing outright — rate limits and key-specific auth problems, not
// generic request errors that another key wouldn't fix.
function isRotatableError(status, detail) {
  if (status === 429) return true;
  if (status === 400 && /API key/i.test(detail)) return true;
  return false;
}

async function callGemini(apiKey, contents, signal) {
  const url = `${BASE_URL}/${MODEL}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
    signal,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message || "";
    } catch {
      // ignore — body wasn't JSON
    }
    const err = new Error(detail || `Gemini request failed (HTTP ${res.status}).`);
    err.status = res.status;
    err.detail = detail;
    err.rotatable = isRotatableError(res.status, detail);
    throw err;
  }

  if (!res.body) {
    throw new Error("Streaming isn't supported in this browser.");
  }

  return res.body;
}

async function streamBody(body, onChunk, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const parts = parsed?.candidates?.[0]?.content?.parts || [];
        // Thinking-enabled models can emit parts that carry only a
        // "thoughtSignature" with no visible text — skip those and
        // concatenate whatever actual text parts came in this chunk.
        const piece = parts
          .filter((p) => p.text && !p.thought)
          .map((p) => p.text)
          .join("");
        if (piece) {
          fullText += piece;
          onChunk(piece);
        }
      } catch {
        // partial/incomplete JSON line — skip, next chunk will complete it
      }
    }
  }

  return fullText;
}

/**
 * Streams a Gemini chat completion. If multiple API keys are configured and
 * one is rate-limited (or rejected as invalid), automatically retries the
 * same request on the next key before giving up — only surfaces an error
 * once every configured key has failed.
 * @param {{role: "user"|"model", text: string}[]} history - prior turns, oldest first
 * @param {(chunkText: string) => void} onChunk - called with each incremental text chunk
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>} the full response text
 */
export async function streamChat(history, onChunk, signal) {
  if (!hasGeminiKey()) {
    throw new Error(
      "No API key configured.",
    );
  }

  const contents = [
    SYSTEM_INSTRUCTION,
    SYSTEM_ACK,
    ...history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
  ];

  let lastError = null;

  for (let i = 0; i < API_KEYS.length; i++) {
    const isLastKey = i === API_KEYS.length - 1;
    try {
      const body = await callGemini(API_KEYS[i], contents, signal);
      // Only rotate to the next key on failures that happen before any
      // text has streamed — once output has reached the UI, retrying on
      // another key would duplicate it, so from here on errors are final.
      return await streamBody(body, onChunk, signal);
    } catch (err) {
      if (err.name === "AbortError") throw err;

      lastError = err;
      if (err.rotatable && !isLastKey) {
        continue; // try the next key
      }

      if (err.status === 429) {
        throw new Error("You have reached the rate limit for the day. Please try again tomorrow.");
      }
      if (err.status === 400 && /API key/i.test(err.detail || "")) {
        throw new Error("All configured API keys were rejected as invalid.");
      }
      throw err;
    }
  }

  throw lastError || new Error("Gemini request failed.");
}
