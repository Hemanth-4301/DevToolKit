import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  X,
  SendHorizontal,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  Loader2,
  AlertCircle,
  Square,
  Maximize2,
  Minimize2,
  RotateCw,
  Pencil,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "../lib/utils";
import { streamChat, hasGeminiKey } from "../lib/gemini";
import { stripMarkdownForSpeech } from "../lib/markdown";
import ChatMessageContent from "./ChatMessageContent";

const STORAGE_KEY = "devtoolkit_chat_history";
const MAX_STORED_MESSAGES = 40;

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)),
    );
  } catch {
    // best-effort — chat history isn't critical
  }
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const recognitionRef = useRef(null);

  const speechSupported = !!getSpeechRecognition();
  const ttsSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const keyConfigured = hasGeminiKey();

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [messages, open, isStreaming]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(
    (text, id) => {
      if (!ttsSupported) return;
      window.speechSynthesis.cancel();
      const clean = stripMarkdownForSpeech(text);
      const utter = new SpeechSynthesisUtterance(clean);
      utter.rate = 1;
      utter.onstart = () => setSpeakingId(id);
      utter.onend = () => setSpeakingId(null);
      utter.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utter);
    },
    [ttsSupported],
  );

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  };

  // Core completion runner — takes the full message list to send as context
  // (already including the just-added/edited user turn) and streams a new
  // assistant reply into a fresh placeholder message at the end.
  const runCompletion = async (historyForApi) => {
    const assistantId = Date.now() + Math.random();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "model", text: "", failed: false },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const full = await streamChat(
        historyForApi.map((m) => ({ role: m.role, text: m.text })),
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: m.text + chunk } : m,
            ),
          );
        },
        controller.signal,
      );
      if (autoSpeak && full.trim()) speak(full, assistantId);
    } catch (err) {
      if (err.name === "AbortError") {
        // user-initiated stop — keep whatever streamed in so far
      } else {
        const message = err.message || "Something went wrong talking to Gemini.";
        setMessages((prev) => {
          const withoutEmptyPlaceholder = prev.filter(
            (m) => m.id !== assistantId || m.text,
          );
          // Mark the triggering user message (now the last one) as failed
          // so a retry action can render right under it, ChatGPT-style.
          const lastUserIdx = [...withoutEmptyPlaceholder]
            .reverse()
            .findIndex((m) => m.role === "user");
          if (lastUserIdx === -1) return withoutEmptyPlaceholder;
          const idx = withoutEmptyPlaceholder.length - 1 - lastUserIdx;
          return withoutEmptyPlaceholder.map((m, i) =>
            i === idx ? { ...m, failed: true, errorMessage: message } : m,
          );
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSend = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || isStreaming) return;

    setInput("");
    const userMsg = { id: Date.now(), role: "user", text, failed: false };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    await runCompletion(nextMessages);
  };

  // Retries the same failed user turn without duplicating it.
  const handleRetry = async (messageId) => {
    if (isStreaming) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const historyUpToAndIncluding = messages.slice(0, idx + 1);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, failed: false } : m)),
    );
    await runCompletion(historyUpToAndIncluding);
  };

  // Re-runs the last assistant reply from the same prior context.
  const handleRegenerate = async (assistantMessageId) => {
    if (isStreaming) return;
    const idx = messages.findIndex((m) => m.id === assistantMessageId);
    if (idx === -1) return;
    const historyBefore = messages.slice(0, idx);
    setMessages(historyBefore);
    await runCompletion(historyBefore);
  };

  const startEdit = (message) => {
    if (isStreaming) return;
    setEditingId(message.id);
    setEditDraft(message.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  // Edits a past user message and truncates everything after it, then
  // re-sends — same behavior as ChatGPT's "edit message" affordance.
  const handleEditSave = async (messageId) => {
    const text = editDraft.trim();
    if (!text) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    const truncated = messages.slice(0, idx);
    const editedMsg = { id: messageId, role: "user", text, failed: false };
    const nextMessages = [...truncated, editedMsg];
    setEditingId(null);
    setEditDraft("");
    setMessages(nextMessages);
    await runCompletion(nextMessages);
  };

  const handleCopyMessage = async (message) => {
    await navigator.clipboard.writeText(message.text);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleClear = () => {
    window.speechSynthesis?.cancel();
    setMessages([]);
    setEditingId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const toggleListening = () => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalTranscript = "";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += chunk;
        else interim += chunk;
      }
      setInput((finalTranscript + interim).trim());
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        className={cn(
          "fixed bottom-5 right-5 z-90 h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300",
          "bg-foreground text-background hover:opacity-90 hover:scale-105 active:scale-95",
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {open && (
        <div
          className={cn(
            "chat-panel-in chat-panel-surface fixed z-90 flex flex-col overflow-hidden transition-[width,height,top,left,right,bottom,border-radius] duration-300 ease-out",
            isExpanded
              ? "inset-4 sm:inset-6 rounded-2xl"
              : "bottom-24 right-5 w-[calc(100vw-2.5rem)] max-w-sm sm:max-w-md h-[min(640px,calc(100vh-8rem))] rounded-2xl",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">DevToolkit AI</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setAutoSpeak((s) => !s)}
                disabled={!ttsSupported}
                title={
                  ttsSupported
                    ? autoSpeak
                      ? "Auto read-aloud: ON"
                      : "Auto read-aloud: OFF"
                    : "Read-aloud not supported in this browser"
                }
                className={cn(
                  "p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                  autoSpeak
                    ? "text-blue-500 bg-blue-500/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {autoSpeak ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={handleClear}
                title="Clear conversation"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsExpanded((e) => !e)}
                title={isExpanded ? "Collapse" : "Expand to fullscreen"}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            className={cn(
              "flex-1 overflow-y-auto px-4 py-4 space-y-4",
              isExpanded && "flex flex-col items-center",
            )}
          >
            <div className={cn("w-full space-y-4", isExpanded && "max-w-2xl")}>
            {!keyConfigured && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  No Gemini API key configured. Add{" "}
                  <code className="font-mono">VITE_GEMINI_API_KEY_1</code> to
                  your <code className="font-mono">.env</code> file and
                  restart the dev server.
                </span>
              </div>
            )}

            {messages.length === 0 && keyConfigured && (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <Bot className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">Ask me anything</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                  I can help with JSON, SQL, diffing, Base64, JWTs, or general
                  coding questions.
                </p>
              </div>
            )}

            {messages.map((m, mi) => {
              const isLastAssistant =
                m.role === "model" &&
                mi === messages.length - 1 &&
                m.text &&
                !isStreaming;
              const isEditing = editingId === m.id;

              return (
                <div
                  key={m.id}
                  className={cn(
                    "group flex flex-col gap-1",
                    m.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "flex gap-2 w-full",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {m.role === "model" && (
                      <div className="h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}

                    {isEditing ? (
                      <div className="max-w-[85%] w-full">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleEditSave(m.id);
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                          rows={2}
                          className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring/30"
                        />
                        <div className="flex items-center justify-end gap-2 mt-1.5">
                          <button
                            onClick={cancelEdit}
                            className="px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleEditSave(m.id)}
                            disabled={!editDraft.trim()}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
                          >
                            Save &amp; resend
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2.5",
                          m.role === "user"
                            ? "bg-foreground text-background rounded-br-md"
                            : "bg-muted rounded-bl-md",
                          m.failed && "opacity-60",
                        )}
                      >
                        {m.text ? (
                          <ChatMessageContent text={m.text} />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>

                  {m.failed && (
                    <div className="flex items-center gap-2 pr-0.5">
                      <span className="text-xs text-red-500">
                        {m.errorMessage || "Failed to send."}
                      </span>
                      <button
                        onClick={() => handleRetry(m.id)}
                        disabled={isStreaming}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                      >
                        <RotateCw className="h-3 w-3" /> Retry
                      </button>
                    </div>
                  )}

                  {!isEditing && m.role === "user" && !m.failed && (
                    <div className="flex items-center gap-0.5 pr-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopyMessage(m)}
                        title="Copy"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        {copiedId === m.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={() => startEdit(m)}
                        disabled={isStreaming}
                        title="Edit &amp; resend"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {!isEditing && m.role === "model" && m.text && (
                    <div className="flex items-center gap-0.5 pl-8">
                      <button
                        onClick={() => handleCopyMessage(m)}
                        title="Copy"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        {copiedId === m.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      {ttsSupported && (
                        <button
                          onClick={() =>
                            speakingId === m.id
                              ? stopSpeaking()
                              : speak(m.text, m.id)
                          }
                          title={
                            speakingId === m.id ? "Stop reading" : "Read aloud"
                          }
                          className={cn(
                            "p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
                            speakingId === m.id && "text-blue-500",
                          )}
                        >
                          {speakingId === m.id ? (
                            <VolumeX className="h-3 w-3" />
                          ) : (
                            <Volume2 className="h-3 w-3" />
                          )}
                        </button>
                      )}
                      {isLastAssistant && (
                        <button
                          onClick={() => handleRegenerate(m.id)}
                          disabled={isStreaming}
                          title="Regenerate response"
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                        >
                          <RotateCw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>

          <div className="border-t border-border p-3 shrink-0">
            <div
              className={cn(
                "flex items-center gap-2 mx-auto",
                isExpanded && "max-w-2xl",
              )}
            >
              <div className="flex-1 relative h-10.5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    isListening ? "Listening…" : "Message DevToolkit AI…"
                  }
                  rows={1}
                  disabled={!keyConfigured}
                  className="absolute inset-0 w-full h-full max-h-32 resize-none rounded-xl border border-border bg-background pl-3.5 pr-9 text-sm leading-6.5 focus:outline-none focus:ring-1 focus:ring-ring/30 disabled:opacity-50"
                />
                {speechSupported && (
                  <button
                    onClick={toggleListening}
                    disabled={!keyConfigured}
                    title={isListening ? "Stop listening" : "Voice input"}
                    className={cn(
                      "absolute right-2 top-0 h-10.5 w-6 flex items-center justify-center transition-colors disabled:opacity-30",
                      isListening
                        ? "text-red-500 animate-pulse"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="h-10.5 w-10.5 shrink-0 rounded-xl bg-red-500 text-white flex items-center justify-center hover:opacity-90 transition-opacity"
                  title="Stop generating"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || !keyConfigured}
                  className="h-10.5 w-10.5 shrink-0 rounded-xl bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Send"
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
