import type { HelpReply } from "@/lib/blend-help";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatEvent =
  | { type: "start"; mode: "ai" }
  | { type: "delta"; text: string }
  | { type: "done"; links: HelpReply["links"] }
  | { type: "fallback"; answer: string; links: HelpReply["links"]; notice?: string };

type CompletedTurn = { question: string; reply: HelpReply; status: "pending" | "complete" | "stopped" };

/** Send only a small, complete slice of this open conversation. No browser storage is used. */
export function chatMessages(turns: CompletedTurn[], question: string): ChatMessage[] {
  const recent = turns.filter(turn => turn.status === "complete").slice(-4).map(turn => [
    { role: "user" as const, content: turn.question.slice(0, 500) },
    { role: "assistant" as const, content: turn.reply.answer.slice(0, 4000) },
  ]);
  const latest: ChatMessage = { role: "user", content: question.slice(0, 500) };
  while (recent.length && recent.flat().reduce((size, message) => size + message.content.length, latest.content.length) > 12000) recent.shift();
  return [...recent.flat(), latest];
}

function safeLinks(value: unknown): HelpReply["links"] {
  if (!Array.isArray(value)) return [];
  return value.filter((link): link is HelpReply["links"][number] => {
    if (!link || typeof link.label !== "string" || typeof link.href !== "string" || !link.label.trim() || link.label.length > 120) return false;
    if (/[\\\u0000-\u0020\u007f]/.test(link.href)) return false;
    if (link.href.startsWith("/") && !link.href.startsWith("//")) return true;
    try { const url = new URL(link.href); return url.protocol === "https:" && url.hostname === "pf.kakao.com" && !url.username && !url.password && !url.port; } catch { return false; }
  }).slice(0, 8).map(({ label, href }) => ({ label, href }));
}

function parseEvent(line: string): ChatEvent {
  const data = JSON.parse(line);
  if (data?.type === "start" && data.mode === "ai") return { type: "start", mode: "ai" };
  if (data?.type === "delta" && typeof data.text === "string") return { type: "delta", text: data.text };
  if (data?.type === "done") return { type: "done", links: safeLinks(data.links) };
  if (data?.type === "fallback" && typeof data.answer === "string" && data.answer.trim() && data.answer.length <= 8000) {
    return { type: "fallback", answer: data.answer, links: safeLinks(data.links), notice: typeof data.notice === "string" ? data.notice.slice(0, 240) : undefined };
  }
  throw new Error("Invalid chat event");
}

/** Consume UTF-8 NDJSON even when bytes, characters, or events span network chunks. */
export async function readChatStream(response: Response, signal: AbortSignal, onEvent: (event: ChatEvent) => void): Promise<void> {
  if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("application/x-ndjson")) throw new Error("Chat response unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", answer = "", finished = false;
  function consume(line: string) {
    if (!line.trim() || finished) return;
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const event = parseEvent(line);
    if (event.type === "delta") {
      answer += event.text;
      if (answer.length > 8000) throw new Error("Chat answer too long");
    }
    if (event.type === "done" && !answer.trim()) throw new Error("Chat answer empty");
    onEvent(event);
    finished = event.type === "done" || event.type === "fallback";
  }
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    while (!finished) {
      const { value, done } = await reader.read();
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 24000) throw new Error("Chat event too long");
      let split: number;
      while (!finished && (split = buffer.indexOf("\n")) >= 0) {
        consume(buffer.slice(0, split));
        buffer = buffer.slice(split + 1);
      }
      if (done) {
        if (buffer.trim() && !finished) consume(buffer);
        break;
      }
    }
    if (!finished) throw new Error("Chat response interrupted");
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
