export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type StreamChatArgs = {
  /** Conversation so far, oldest first, including the message being asked. */
  messages: ChatMessage[];
  /** The document as it stands right now — re-sent every turn so edits are picked up. */
  doc: string;
  signal: AbortSignal;
  onDelta: (text: string) => void;
  /** Non-fatal server notice, e.g. the document was truncated. */
  onNotice?: (text: string) => void;
};

/**
 * POST to the app's own /api/chat and read back the minimal SSE it emits:
 *   {"t": "..."} text delta · {"w": "..."} warning · {"e": "..."} error
 *   · [DONE] end of stream
 * Rejects with the server's message on error so the UI can show it verbatim.
 */
export async function streamChat({
  messages,
  doc,
  signal,
  onDelta,
  onNotice,
}: StreamChatArgs): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doc,
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
    signal,
  });

  if (!res.body) throw new Error("The server sent an empty response.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let failure: string | null = null;
  let sawDone = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        sawDone = true;
        continue;
      }

      try {
        const frame = JSON.parse(payload) as { t?: string; w?: string; e?: string };
        if (frame.e) failure = frame.e;
        else if (frame.w) onNotice?.(frame.w);
        else if (frame.t) onDelta(frame.t);
      } catch {
        // Ignore malformed frames rather than aborting a working stream.
      }
    }
  }

  if (failure) throw new Error(failure);
  // The socket closing without [DONE] means the provider dropped mid-answer.
  // Without this the caller would present a truncated reply as a complete one.
  if (!sawDone) throw new Error("The reply was cut off before it finished.");
}

/** Message text shown when the user has not asked anything yet. */
export const STARTER_PROMPTS = [
  "Summarise this document",
  "What are the key points?",
  "Explain the structure",
];
