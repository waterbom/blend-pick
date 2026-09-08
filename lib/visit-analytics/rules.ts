import type { SiteKey } from '@/lib/sites';

export const VISITOR_LIFETIME_MS = 90 * 86400000;
export const SESSION_IDLE_MS = 30 * 60000;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PAGE_LABELS: Record<string, string> = {
  home: '메인', catalog: '상품 목록', product: '상품 상세', cart: '장바구니',
  checkout: '구매 진행', login: '로그인', signup: '회원가입', mypage: '마이페이지',
  about: '브랜드 소개', guide: '이용 안내', terms: '이용약관', privacy: '개인정보 안내',
  hotel: '숙박', campaign: '공구', influencer: '인플루언서',
};
// 쿼리·상품/주문 번호·검색어는 서버로 보내지 않는다. 등록한 고객 화면만 분류한다.
export function pageGroup(path: string): string | null {
  const p = path.replace(/^\/sanji(?=\/|$)/, '') || '/';
  if (p === '/') return 'home';
  if (/^\/products\/?$/.test(p)) return 'catalog';
  if (/^\/(?:products|p)\/[a-z0-9_-]+\/?$/i.test(p)) return 'product';
  if (/^\/(?:products|campaigns)\/[a-z0-9_-]+\/checkout\/?$/i.test(p) || p === '/cart/checkout') return 'checkout';
  const fixed: Record<string, string> = { '/cart':'cart', '/login':'login', '/signup':'signup', '/mypage':'mypage', '/about':'about', '/guide':'guide', '/terms':'terms', '/privacy':'privacy', '/hotel':'hotel', '/hotel/utop':'hotel', '/hotel/dangung':'hotel', '/campaigns':'campaign', '/influencer':'influencer' };
  return fixed[p.replace(/\/$/, '')] || null;
}
export type PageviewInput = { eventId: string; visitorId: string; page: string };
export function parsePageview(value: unknown): PageviewInput | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['eventId','visitorId','page'].includes(k))) return null;
  if (typeof v.eventId !== 'string' || !UUID.test(v.eventId) || typeof v.visitorId !== 'string' || !UUID.test(v.visitorId) || typeof v.page !== 'string' || !Object.hasOwn(PAGE_LABELS, v.page)) return null;
  return { eventId: v.eventId.toLowerCase(), visitorId: v.visitorId.toLowerCase(), page: v.page };
}
export function sessionExpired(last: Date, now: Date): boolean {
  return now.getTime() - last.getTime() >= SESSION_IDLE_MS;
}
export function analyticsRange(days: number, now = new Date()) {
  if (![1,7,30].includes(days)) throw Error('Unsupported range');
  const date = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0,10);
  const midnight = new Date(date + 'T00:00:00+09:00');
  return { from: new Date(midnight.getTime() - (days - 1) * 86400000), to: now };
}
export type VisitSummary = {
  site: SiteKey; days: number; state: 'disabled' | 'unconfigured' | 'empty' | 'active' | 'error';
  from: string; to: string; lastEventAt: string | null;
  totals: { visitors: number; sessions: number; pageviews: number } | null;
  pages: { page: string; views: number }[];
  daily: { day: string; visitors: number; sessions: number; pageviews: number }[];
};
