// Both storefronts use the existing advertising account. Never pass checkout/customer objects here.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "2567356913769604";
type PixelEvent = { event: string; params: Record<string, unknown>; eventID?: string };
type PixelWindow = Window & { fbq?: (...args: unknown[]) => void };
const pending: PixelEvent[] = [];
const purchases = new Set<string>();
const PURCHASE_KEY = "meta-purchases-v1";

export function isPixelRoute(path: string) {
  const route = path.replace(/^\/sanji(?=\/|$)/, "") || "/";
  return !/^\/(admin|api|auth|login|signup|register|mypage|my|account|orders|reservations|influencer)(\/|$)/.test(route)
    && route !== "/hotel/lookup";
}

// A bounded queue bridges hydration and next/script. Ad blockers must never break shopping.
export function flushMetaEvents() {
  if (typeof window === "undefined" || !isPixelRoute(window.location.pathname)) return;
  const w = window as PixelWindow;
  if (typeof w.fbq !== "function") return;
  while (pending.length) {
    const item = pending[0];
    try {
      if (item.eventID) w.fbq("trackSingle", META_PIXEL_ID, item.event, item.params, { eventID: item.eventID });
      else w.fbq("trackSingle", META_PIXEL_ID, item.event, item.params);
      pending.shift();
    } catch { return; }
  }
}

export function fbqTrack(event: string, params: Record<string, unknown> = {}, eventID?: string) {
  if (typeof window === "undefined" || !isPixelRoute(window.location.pathname) || !/^\d+$/.test(META_PIXEL_ID)) return false;
  flushMetaEvents();
  if (pending.length >= 100) return false;
  pending.push({ event, params, eventID });
  flushMetaEvents();
  return true;
}

export type PixelItem = { id: string; quantity: number; price: number };
export function commerceParams(items: PixelItem[], total?: number) {
  const valid = (Array.isArray(items) ? items : []).filter(i => i && typeof i.id === "string" && i.id && Number.isInteger(i.quantity) && i.quantity > 0 && Number.isFinite(i.price) && i.price >= 0);
  const value = total ?? valid.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return {
    content_type: "product",
    content_ids: [...new Set(valid.map(i => i.id))],
    contents: valid.map(i => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
    num_items: valid.reduce((sum, i) => sum + i.quantity, 0),
    ...(Number.isFinite(value) && value >= 0 ? { value, currency: "KRW" } : {}),
  };
}

export function trackCartAdded(
  rows: { product_id: string; option_id: string | null; quantity: number }[],
  product: { price: number }, options: { id: string; extra_price?: number | null }[],
) {
  if (!rows.length) return;
  fbqTrack("AddToCart", commerceParams(rows.map(row => ({
    id: row.product_id, quantity: row.quantity,
    price: options.find(o => o.id === row.option_id)?.extra_price ?? product.price,
  }))));
}

// Only call after server-confirmed payment success. Never use the callback URL's amount.
// Persistent browser dedupe plus a stable eventID covers callback retries and refreshes.
export function trackPurchase(flow: string, orderId: string, amount: unknown, items: PixelItem[] = []) {
  if (typeof window === "undefined" || !orderId || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return false;
  const eventID = `${window.location.hostname}:${flow}:${orderId}`;
  let saved: string[] = [];
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(PURCHASE_KEY) || "[]");
    if (Array.isArray(raw)) saved = raw.filter((v): v is string => typeof v === "string").slice(-199);
  } catch { /* Storage can be disabled; in-memory dedupe still works. */ }
  if (purchases.has(eventID) || saved.includes(eventID)) return false;
  if (!fbqTrack("Purchase", commerceParams(items, amount), eventID)) return false;
  purchases.add(eventID);
  try { window.localStorage.setItem(PURCHASE_KEY, JSON.stringify([...saved, eventID])); } catch { /* Non-fatal. */ }
  return true;
}
