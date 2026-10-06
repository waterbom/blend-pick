import { createHash } from 'node:crypto';

// One EC2 application process today. This is an emergency request cap, not a
// durable billing limit: restart resets it; multiple workers each have a cap.
type Budget = { day: number; used: number; concurrent: number; clients: Map<string, { minute: number; count: number }> };
const state = globalThis as typeof globalThis & { blendChatBudget?: Budget };

export function acquireChatBudget(headers: Headers, now = Date.now()): (() => void) | null {
  const day = Math.floor(now / 86400000);
  const minute = Math.floor(now / 60000);
  const budget = state.blendChatBudget ??= { day, used: 0, concurrent: 0, clients: new Map() };
  if (budget.day !== day) { budget.day = day; budget.used = 0; }
  const configured = Number(process.env.BLEND_AI_DAILY_REQUEST_LIMIT || 300);
  const dailyLimit = Number.isInteger(configured) && configured > 0 ? Math.min(configured, 2000) : 300;
  if (budget.used >= dailyLimit || budget.concurrent >= 3) return null;
  // nginx appends its observed peer address last. Never trust the leftmost value.
  const peer = (headers.get('x-forwarded-for') || '').split(',').at(-1)?.trim().slice(0, 80) || 'unknown';
  const id = createHash('sha256').update(peer).digest('hex');
  for (const [key, value] of budget.clients) if (value.minute !== minute) budget.clients.delete(key);
  const client = budget.clients.get(id) ?? { minute, count: 0 };
  if (client.count >= 10 || budget.clients.size >= 5000 && !budget.clients.has(id)) return null;
  client.count++;
  budget.clients.set(id, client);
  budget.used++;
  budget.concurrent++;
  let released = false;
  return () => { if (!released) { released = true; budget.concurrent--; } };
}
