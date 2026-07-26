import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-v4-pro";
// OpenRouter attribution — shows the app on the model's leaderboard page.
const SITE_URL = "https://md.akbarakma.com";
const SITE_NAME = "Markdown Viewer";

/** ~120k tokens. Past this the document is truncated and both sides are told. */
const DOC_CHAR_LIMIT = 400_000;
/** Last 10 turns. Older context is dropped to keep each request bounded. */
const MAX_HISTORY = 20;
/**
 * A DOC_CHAR_LIMIT document JSON-escapes to well under this. Checked against
 * Content-Length *before* req.json(), which would otherwise buffer the whole
 * body into memory first.
 */
const MAX_BODY_BYTES = 2_000_000;
/** Conversation text only — the document is bounded separately by DOC_CHAR_LIMIT. */
const MAX_HISTORY_CHARS = 100_000;

type Role = "user" | "assistant";
type ChatMessage = { role: Role; content: string };

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
}

function buildSystemPrompt(doc: string, truncated: boolean): string {
  return [
    "You are a reading assistant embedded in a Markdown viewer. The user's current",
    "document is reproduced below. It is the single source of truth: the user can edit",
    "it at any moment, so it may differ from what you saw earlier in this conversation.",
    "Always answer from THIS version and ignore any older copy you remember.",
    "",
    "Rules:",
    "- Answer from the document. If it does not contain the answer, say so plainly",
    "  instead of guessing.",
    "- Be concise. Refer to sections by their heading when it helps the user find them.",
    "- Reply in the same language the user writes in.",
    "- You cannot edit the document — you can only discuss it. If asked to rewrite",
    "  something, show the replacement in a fenced code block for the user to copy.",
    truncated
      ? `\nNOTE: the document exceeded ${DOC_CHAR_LIMIT} characters and was truncated. Say so if the user asks about material that may be past the cut-off.`
      : "",
    "",
    "--- BEGIN DOCUMENT ---",
    doc,
    "--- END DOCUMENT ---",
  ].join("\n");
}

function sse(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/** One-shot SSE response, for errors raised before the upstream stream opens. */
function sseError(message: string, status: number): Response {
  return new Response(sse({ e: message }) + "data: [DONE]\n\n", {
    status,
    headers: streamHeaders(),
  });
}

/** Translate one upstream SSE line into our own protocol. */
function emitLine(
  line: string,
  controller: TransformStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): void {
  const trimmed = line.trim();
  // OpenRouter also sends ": OPENROUTER PROCESSING" keep-alive comments.
  if (!trimmed.startsWith("data:")) return;

  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") {
    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    return;
  }

  try {
    const json = JSON.parse(payload) as {
      choices?: { delta?: { content?: string } }[];
      error?: { message?: string };
    };
    if (json.error?.message) {
      controller.enqueue(encoder.encode(sse({ e: json.error.message })));
      return;
    }
    const text = json.choices?.[0]?.delta?.content;
    if (text) controller.enqueue(encoder.encode(sse({ t: text })));
  } catch {
    // Partial or non-JSON frame — skip it rather than killing the stream.
  }
}

function streamHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    // `no-transform` and X-Accel-Buffering stop the nginx reverse proxy in front
    // of the container from buffering the whole stream before flushing it.
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return sseError("AI chat is not configured on this server (no OPENROUTER_API_KEY).", 503);
  }

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return sseError("Request too large.", 413);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return sseError("Malformed request body.", 400);
  }

  const parsed = body as { messages?: unknown; doc?: unknown };
  if (!Array.isArray(parsed.messages) || typeof parsed.doc !== "string") {
    return sseError("Request must be { messages: ChatMessage[], doc: string }.", 400);
  }

  // Slice before filtering: filtering first would walk and allocate across an
  // arbitrarily long array just to throw all but the last MAX_HISTORY away.
  const history = parsed.messages.slice(-MAX_HISTORY).filter(isChatMessage);
  if (history.length === 0) {
    return sseError("No message to send.", 400);
  }

  const historyChars = history.reduce((n, m) => n + m.content.length, 0);
  if (historyChars > MAX_HISTORY_CHARS) {
    return sseError("Conversation is too long — start a new chat.", 413);
  }

  const truncated = parsed.doc.length > DOC_CHAR_LIMIT;
  const doc = truncated ? parsed.doc.slice(0, DOC_CHAR_LIMIT) : parsed.doc;

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": SITE_URL,
        "X-OpenRouter-Title": SITE_NAME,
      },
      body: JSON.stringify({
        model: MODEL,
        // Pin to DeepSeek's own endpoint — it is the cheapest provider for this
        // model, and fallbacks would silently route to a pricier one.
        provider: { order: ["deepseek"], allow_fallbacks: false },
        // V4 Pro is a hybrid reasoning model; "none" switches thinking off so we
        // don't pay for reasoning tokens on what are short lookup questions.
        reasoning: { effort: "none" },
        stream: true,
        // The document goes first and stays byte-stable between turns, so
        // DeepSeek's automatic prefix cache serves it at cache-read pricing.
        messages: [{ role: "system", content: buildSystemPrompt(doc, truncated) }, ...history],
      }),
      signal: req.signal,
    });
  } catch {
    return sseError("Could not reach OpenRouter.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    let message = `OpenRouter returned ${upstream.status}.`;
    try {
      const parsedDetail = JSON.parse(detail) as { error?: { message?: string } };
      if (parsedDetail.error?.message) message = parsedDetail.error.message;
    } catch {
      if (detail) message = detail.slice(0, 300);
    }
    return sseError(message, 502);
  }

  // Re-emit OpenRouter's SSE as a minimal protocol the client can read without
  // knowing anything about the provider's payload shape:
  //   {"t": "..."} text delta · {"w": "..."} warning · {"e": "..."} error
  //   · [DONE] end of stream
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      // Telling only the model it was truncated leaves the user staring at a
      // confident answer about a document the model never saw all of.
      if (truncated) {
        controller.enqueue(
          encoder.encode(
            sse({
              w: `Document is larger than ${DOC_CHAR_LIMIT.toLocaleString("en-US")} characters — only the first part was sent.`,
            }),
          ),
        );
      }
    },
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) emitLine(line, controller, encoder);
    },
    flush(controller) {
      // Drain anything the upstream left without a trailing newline, plus any
      // bytes still held by the decoder, so a final frame is never dropped.
      buffer += decoder.decode();
      if (buffer) emitLine(buffer, controller, encoder);
    },
  });

  return new Response(upstream.body.pipeThrough(transform), { headers: streamHeaders() });
}
