"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { STARTER_PROMPTS, streamChat, type ChatMessage } from "@/lib/ai-chat";
import { useMediaQuery } from "@/lib/use-media-query";

type AiChatProps = {
  /** Current document. Re-sent with every message so mid-chat edits are picked up. */
  doc: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};

let messageSeq = 0;
const nextId = () => String(++messageSeq);

// react-markdown has no internal memoisation — it re-runs the whole unified
// pipeline on every render. This panel re-renders on every keystroke in the
// editor (it takes `doc` as a prop), so without this the entire transcript would
// be re-parsed on each one, even while the chat is closed.
const AssistantMessage = memo(function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-paper prose-chat max-w-none text-[13.5px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
});

export function AiChat({ doc, open, onOpen, onClose }: AiChatProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  // The document as it was when the last request went out — drives the
  // "document changed" hint so the user knows the next reply will re-read it.
  // State, not a ref: it is read during render.
  const [lastSentDoc, setLastSentDoc] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const pinnedRef = useRef(true);

  const busy = streaming !== null;
  const docChanged = lastSentDoc !== null && lastSentDoc !== doc;
  // Only the mobile sheet is sized from visualViewport; the desktop drawer uses
  // inset-y-0. Derived rather than cleared in the effect, so no cascading render.
  const sheetHeight = open && !isDesktop ? panelHeight : null;

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus in on open, and hand it back to the trigger on close — otherwise a
  // keyboard user is left focused on a control inside the now-`inert` panel.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpenRef.current) fabRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  // `interactiveWidget: "resizes-content"` (see app/layout.tsx) already shrinks the
  // layout viewport when the keyboard opens, but Safari has not always honoured
  // it. Sizing the mobile sheet from visualViewport is the fallback that keeps
  // the composer reachable; where the meta tag works, the two agree and this is
  // a no-op.
  useEffect(() => {
    if (!open || isDesktop) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => setPanelHeight(vv.height);
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [open, isDesktop]);

  // Follow the stream, unless the user has scrolled up to read something.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      const outgoing: ChatMessage[] = [
        ...messages,
        { id: nextId(), role: "user", content: trimmed },
      ];
      setMessages(outgoing);
      setDraft("");
      setError(null);
      setNotice(null);
      setStreaming("");
      pinnedRef.current = true;
      setLastSentDoc(doc);

      const controller = new AbortController();
      abortRef.current = controller;
      // `reset` clears abortRef before aborting, so this is false for a request
      // the user has walked away from. Without it, the abort rejection lands
      // after "New chat" has emptied the list and re-appends the abandoned reply
      // into a conversation that no longer has a question in it.
      const isCurrent = () => abortRef.current === controller;

      let received = "";
      const keepPartial = () => {
        if (received) {
          setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: received }]);
        }
      };

      try {
        await streamChat({
          messages: outgoing,
          doc,
          signal: controller.signal,
          onNotice: (text) => {
            if (isCurrent()) setNotice(text);
          },
          onDelta: (delta) => {
            received += delta;
            if (isCurrent()) setStreaming(received);
          },
        });
        if (!isCurrent()) return;
        if (received) keepPartial();
        else setError("The model returned an empty reply.");
      } catch (err) {
        if (!isCurrent()) return;
        // Whether the user pressed Stop or the provider dropped the connection,
        // the text already on screen is real — keep it rather than making the
        // half-answer vanish and leaving only an error string behind.
        keepPartial();
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        if (isCurrent()) {
          abortRef.current = null;
          setStreaming(null);
        }
      }
    },
    [busy, doc, messages],
  );

  const stop = () => abortRef.current?.abort();

  const reset = () => {
    const inFlight = abortRef.current;
    abortRef.current = null;
    inFlight?.abort();
    setMessages([]);
    setStreaming(null);
    setError(null);
    setNotice(null);
    setDraft("");
    setLastSentDoc(null);
  };

  const onDraftKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <>
      {!open && (
        <button
          ref={fabRef}
          type="button"
          onClick={onOpen}
          aria-label="Ask about this document"
          className="fixed bottom-4 right-4 z-30 grid size-12 place-items-center rounded-full border border-rule bg-paper text-ink-soft shadow-lg transition-colors duration-150 ease-out hover:border-ember hover:text-ember focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          <IconSparkle />
        </button>
      )}

      <aside
        role="dialog"
        aria-modal={!isDesktop}
        aria-label="Ask about this document"
        aria-hidden={!open}
        // `aria-hidden` alone still leaves the closed panel's buttons in the tab
        // order; `inert` actually removes them.
        inert={!open}
        style={sheetHeight ? { height: sheetHeight } : undefined}
        // Desktop: starts below the h-14 header, because this drawer has no
        // backdrop — the toolbar has to stay clickable while the chat is open.
        // Mobile: full screen, where it is modal anyway.
        className={`fixed inset-0 z-40 flex flex-col border-rule bg-paper transition-transform md:bottom-0 md:left-auto md:right-0 md:top-14 md:w-[min(420px,92vw)] md:border-l ${
          open
            ? "translate-x-0 translate-y-0 duration-[240ms] ease-out"
            : "pointer-events-none translate-y-full duration-[160ms] ease-out md:translate-x-full md:translate-y-0"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-rule px-4 sm:px-5">
          <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">Ask</span>
          <span className="truncate text-[15px] font-semibold tracking-tight text-ink">
            this document
          </span>
          <div className="ml-auto flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-ink-muted transition-colors duration-150 hover:text-ember focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ember"
              >
                New chat
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="grid size-8 place-items-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-paper-deep hover:text-ember focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path
                  d="M2 2 L12 12 M12 2 L2 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-5 sm:px-5"
        >
          {messages.length === 0 && !busy ? (
            <div className="flex flex-col gap-4">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                Ask anything about the document in the editor. It is re-read on every
                message, so edits are always picked up.
              </p>
              <div className="flex flex-col items-start gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void send(prompt)}
                    className="rounded-full border border-rule px-3 py-1.5 text-left text-[12px] text-ink-soft transition-colors duration-150 hover:border-ember hover:text-ember focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-paper-deep px-3.5 py-2 text-[13.5px] leading-relaxed text-ink">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <AssistantMessage key={message.id} content={message.content} />
                ),
              )}

              {streaming !== null &&
                (streaming ? (
                  <AssistantMessage content={streaming} />
                ) : (
                  <p className="text-[13.5px] text-ink-muted">Reading the document…</p>
                ))}

              {error && (
                <p className="rounded-md border border-ember-soft bg-[color-mix(in_srgb,var(--ember)_6%,var(--paper))] px-3 py-2 font-mono text-[12px] leading-relaxed text-ink-soft">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* No safe-area padding needed: without `viewport-fit=cover` (see
            app/layout.tsx) the browser already insets the viewport past the home
            indicator. */}
        <div className="shrink-0 border-t border-rule px-4 pb-3 pt-3 sm:px-5">
          {notice && <p className="mb-2 text-[11px] text-ember">{notice}</p>}
          {docChanged && (
            <p className="mb-2 text-[11px] text-ink-muted">
              Document changed — it will be re-read on your next message.
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onDraftKeyDown}
              placeholder="Ask about this document…"
              aria-label="Message"
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[13.5px] leading-relaxed text-ink-soft placeholder:text-ink-muted/60 focus:outline-none"
            />
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="shrink-0 rounded-full border border-ember px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-ember transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void send(draft)}
                disabled={!draft.trim()}
                className="shrink-0 rounded-full border border-rule px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-soft transition-colors duration-150 hover:border-ember hover:text-ember disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink-soft focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M9 2.5L10.3 6.7L14.5 8L10.3 9.3L9 13.5L7.7 9.3L3.5 8L7.7 6.7L9 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M13.8 12.2L14.3 13.7L15.8 14.2L14.3 14.7L13.8 16.2L13.3 14.7L11.8 14.2L13.3 13.7L13.8 12.2Z" fill="currentColor" />
    </svg>
  );
}
