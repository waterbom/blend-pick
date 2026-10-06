"use client";

import ScrollRail from "@/components/ScrollRail";
import { SANJI_IMAGE_ASPECT_RATIO, SANJI_LARGE_IMAGE_MAX_WIDTH } from "@/lib/sanji-image-layout";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SanjiCard, SanjiHomeReview } from "@/lib/sanji-data";
import { useRouter } from "next/navigation";
import { storefrontSale } from "@/lib/storefront-sale";
import { sanjiKind } from "@/lib/sanji-kind";

// 산지픽 메인 (sanjipick.blendpunch.com/) — B안 '공구 오렌지'.
// 마감 카운트다운 띠 → 칩 탭(전체/농산물/수산물) → 둥근 배너 → 마감 임박 공구(목록) → 진행 중인 공구(2열)
// → 할인 큰 순 가로 줄 → 곧 열리는 공구(연한 오렌지 상자) → 후기 → 하단 탭바. 카드는 전부 /p/<id> 상세(판매 페이지)로 연결.

const ORANGE = "#C9430E"; // 강조·할인율·주요 버튼 (흰 글자 대비 4.9:1)
const INK = "#191919";
const MUTED = "#6E6E6E";
const FAINT = "#8A8A8A";
const LINE = "#EDEDED";
const GRAY = "#F4F4F4";
const SOFT = "#FFF6EF";
const TINT = "#FFF1EA";
const YELLOW = "#FFD43B";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const pct = (p: SanjiCard) => (p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0);
const maskName = (n: string) => (n.length <= 2 ? n[0] + "*" : n[0] + "*".repeat(n.length - 2) + n[n.length - 1]);
function timeAgo(s: string) {
  const diff = Math.max(0, Date.now() - new Date(s).getTime());
  const m = Math.floor(diff / 60e3), h = Math.floor(diff / 3600e3), d = Math.floor(diff / 86400e3);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  if (h < 24) return `${h}시간 전`;
  if (d < 30) return `${d}일 전`;
  return `${Math.floor(d / 30)}개월 전`;
}
// 오픈 예정 라벨 — 오늘/내일/M.D + HH:MM (KST)
function openLabel(iso: string) {
  const t = new Date(iso);
  const kst = new Date(t.getTime() + 9 * 3600e3);
  const nowK = new Date(Date.now() + 9 * 3600e3);
  const dayDiff = Math.floor(kst.getTime() / 86400e3) - Math.floor(nowK.getTime() / 86400e3);
  const day = dayDiff <= 0 ? "오늘" : dayDiff === 1 ? "내일" : `${kst.getUTCMonth() + 1}.${kst.getUTCDate()}`;
  return { day, time: `${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}` };
}
// 공구 마감까지 남은 시간 — 하루 넘으면 "N일 HH:MM", 하루 안이면 "HH:MM:SS"
const two = (n: number) => String(n).padStart(2, "0");
function leftLabel(endIso: string | null, now: number) {
  if (!endIso) return "";
  const left = Date.parse(endIso) - now;
  if (!(left > 0)) return "";
  const d = Math.floor(left / 86400e3), h = Math.floor((left % 86400e3) / 3600e3), m = Math.floor((left % 3600e3) / 60e3), s = Math.floor((left % 60e3) / 1e3);
  return d > 0 ? `${d}일 ${two(h)}:${two(m)}` : `${two(h)}:${two(m)}:${two(s)}`;
}

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }} aria-label={`${n}점`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(n) ? "#FFB400" : "#E3E3E3"}>
          <path d="M12 2l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 18l-6.4 3.4 1.4-7.1L1.7 9.4l7.2-.8z" />
        </svg>
      ))}
    </span>
  );
}

function Clock({ size = 12 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>;
}

function Img({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [bad, setBad] = useState(!src);
  if (bad) return <div className={className} style={{ background: `linear-gradient(135deg,${GRAY},${TINT})` }} aria-hidden />;
  return <img src={src!} alt={alt} className={className} loading="lazy" onError={() => setBad(true)} />;
}

const soldOut = (p: SanjiCard) => p.stock === 0 || p.status === "soldout";
function Price({ p }: { p: SanjiCard }) {
  return (
    <>
      {pct(p) > 0 && <div className="was">{won(p.original_price!)}</div>}
      <div className="pr">{pct(p) > 0 && <em>{pct(p)}%</em>}{won(p.price)}</div>
    </>
  );
}
// 2열 카드 — 사진 위 왼쪽에 남은 시간, 아래 이름·정가·할인가·판매 수
function Card({ p, href, now }: { p: SanjiCard; href: string; now: number }) {
  const left = leftLabel(p.sale_end_at, now);
  return (
    <a className="sh-card" href={href}>
      <div className="th">
        <Img src={p.main_image} alt={p.name} />
        {left && !soldOut(p) && <span className="cd"><Clock size={11} />{left} 남음</span>}
        {soldOut(p) && <span className="so">재고 마감</span>}
      </div>
      <div className="nm">{p.name}</div>
      <Price p={p} />
      {p.sold >= 10 && <div className="meta">{p.sold.toLocaleString()}개 구매</div>}
    </a>
  );
}
function Grid({ items, linkBase, now }: { items: SanjiCard[]; linkBase: string; now: number }) {
  return <div className="sh-grid">{items.map((p) => <Card key={p.id} p={p} href={`${linkBase}/p/${p.id}`} now={now} />)}</div>;
}

export default function SanjiHome({
  products, reviews, linkBase, kakaoUrl,
}: {
  products: SanjiCard[]; reviews: SanjiHomeReview[]; linkBase: string; demo?: boolean; kakaoUrl: string;
}) {
  const href = (p: SanjiCard) => `${linkBase}/p/${p.id}`;
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const refresh = () => { tick(); if (!document.hidden) router.refresh(); };
    const timer = setInterval(tick, 1000);
    const poll = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); clearInterval(poll); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  const live = useMemo(() => products.filter(p => storefrontSale(p, now) === "open"), [products, now]);
  const upcoming = useMemo(() => products.filter(p => storefrontSale(p, now) === "upcoming").sort((a,b) => Date.parse(a.sale_start_at!) - Date.parse(b.sale_start_at!)), [products, now]);
  const newest = useMemo(() => [...live].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [live]);
  // 탭 분기 — 기존 해산물 분류를 포함해 수산물로 표시 (판매량 순)
  const produce = useMemo(() => live.filter((p) => sanjiKind(p.category) === "produce").sort((a, b) => b.sold - a.sold), [live]);
  const seafood = useMemo(() => live.filter((p) => sanjiKind(p.category) === "seafood").sort((a, b) => b.sold - a.sold), [live]);
  const deals = useMemo(() => live.filter((p) => pct(p) > 0).sort((a, b) => pct(b) - pct(a)), [live]);
  // 마감 임박 — 종료 시각이 정해진 판매 중 공구를 빠른 순으로
  const closing = useMemo(() => live.filter((p) => p.sale_end_at && Date.parse(p.sale_end_at) > now).sort((a, b) => Date.parse(a.sale_end_at!) - Date.parse(b.sale_end_at!)), [live, now]);
  const first = closing[0];
  const firstLeftMs = first ? Date.parse(first.sale_end_at!) - now : 0;

  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // 공개 판매 상품 중 대표이미지가 있는 최신 등록 5개를 자동 노출합니다.
  const banners = useMemo(() => newest.filter(p => p.main_image?.trim()).slice(0, 5).map(p => ({
    productId: p.id, src: p.main_image!, alt: p.name, href: `${linkBase}/p/${p.id}`,
  })), [newest, linkBase]);
  const sliderRef = useRef<HTMLDivElement>(null);
  const touching = useRef(false);
  const bannerIds = banners.map(b => b.productId).join(",");
  // 배너 구성이 바뀌면 첫 장부터 — 현재 장 번호는 배너 목록과 묶어 두고, 목록이 바뀌면 0으로 본다
  const [slideAt, setSlideAt] = useState({ ids: bannerIds, i: 0 });
  const slide = slideAt.ids === bannerIds ? slideAt.i : 0;
  useEffect(() => {
    sliderRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [bannerIds]);
  const onSlide = () => {
    const el = sliderRef.current;
    if (el) setSlideAt({ ids: bannerIds, i: Math.round(el.scrollLeft / el.clientWidth) });
  };
  useEffect(() => {
    if (banners.length < 2) return;
    const id = setInterval(() => {
      const el = sliderRef.current;
      if (!el || touching.current || document.hidden || Number(el.dataset.manualUntil) > Date.now() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      const next = (cur + 1) % banners.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: next === 0 ? "auto" : "smooth" });
    }, 3000);
    return () => clearInterval(id);
  }, [banners.length]);

  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const f = () => setShowTop(window.scrollY > 500);
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  const Tabs = ["전체", "농산물", "수산물"];

  return (
    <div className="sh">
      <style>{`
        .sh{position:relative;max-width:1120px;margin:0 auto;background:#fff;min-height:100svh;font-family:inherit;color:${INK};letter-spacing:-.02em;padding-bottom:calc(76px + env(safe-area-inset-bottom))}
        .sh *{box-sizing:border-box}
        .sh a{color:inherit;text-decoration:none}
        .sh button{font-family:inherit;cursor:pointer}
        .sh .sh-strip{display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:8px 16px;background:${INK};color:#fff;font-size:13px;font-weight:600;text-align:center}
        .sh-strip svg{color:${YELLOW};flex-shrink:0}
        .sh-strip b{color:${YELLOW};font-weight:700;font-variant-numeric:tabular-nums}
        .sh .sh-strip:hover{background:#000}
        .sh-hd{position:sticky;top:64px;z-index:25;background:rgba(255,255,255,.97);backdrop-filter:blur(12px)}
        .sh-tabs{display:flex;gap:8px;padding:12px 16px;overflow-x:auto;scrollbar-width:none}
        .sh-tabs::-webkit-scrollbar{display:none}
        .sh-tabs button{flex-shrink:0;height:38px;padding:0 18px;border:0;border-radius:999px;background:${GRAY};color:${INK};font-size:14px;font-weight:600}
        .sh-tabs button:hover{background:#EAEAEA}
        .sh-tabs button.on{background:${INK};color:#fff}
        .sh-ban{position:relative;width:calc(100% - 32px);max-width:${SANJI_LARGE_IMAGE_MAX_WIDTH};margin:4px auto 0}
        .sh-ban__track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;align-items:stretch;width:100%;aspect-ratio:${SANJI_IMAGE_ASPECT_RATIO};border-radius:14px;background:${GRAY}}
        .sh-ban__track::-webkit-scrollbar{display:none}
        .sh-ban__item{position:relative;flex:0 0 100%;min-width:0;min-height:0;scroll-snap-align:start;overflow:hidden}
        .sh-ban__item img,.sh-ban__item>div[aria-hidden="true"]{position:absolute;inset:0;width:100%;height:100%;padding:8px;object-fit:contain;object-position:center;display:block}
        .sh-ban__badge{position:absolute;left:12px;top:12px;z-index:2;background:${YELLOW};color:${INK};font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;pointer-events:none}
        .sh-ban__count{position:absolute;right:12px;bottom:12px;z-index:2;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:500;padding:3px 10px;border-radius:999px;font-variant-numeric:tabular-nums;pointer-events:none}
        .sh-sec{padding:28px 16px 6px}
        .sh-sec__h{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
        .sh-sec__h h2{display:flex;align-items:center;gap:6px;margin:0;font-size:20px;font-weight:700;letter-spacing:-.03em}
        .sh-sec__h a{flex-shrink:0;font-size:13px;color:${MUTED}}
        .sh-sec__h a:hover{color:${ORANGE}}
        .sh-sec__sub{margin:0 0 14px;font-size:13px;color:${MUTED}}
        .sh-hot-badge{font-size:11px;font-weight:700;color:#fff;background:${ORANGE};padding:2px 7px;border-radius:4px;letter-spacing:.02em}
        .sh-hotlist{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
        .sh-hot{min-width:0;display:flex;gap:12px;padding:12px;border:1px solid ${LINE};border-radius:14px;transition:border-color .15s}
        .sh-hot:hover{border-color:#D5D5D5}
        .sh-hot .th{position:relative;flex:0 0 112px;aspect-ratio:${SANJI_IMAGE_ASPECT_RATIO};align-self:flex-start;border-radius:10px;overflow:hidden;background:${GRAY}}
        .sh-hot .th img,.sh-hot .th>div[aria-hidden="true"]{position:absolute;inset:0;width:100%;height:100%;padding:4px;object-fit:contain}
        .sh-hot .bd{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
        .sh-hot .cd{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:${ORANGE};background:${TINT};padding:3px 8px;border-radius:6px;font-variant-numeric:tabular-nums}
        .sh-hot .nm{font-size:14px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
        .sh-hot .pr{font-size:19px}
        .sh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 10px}
        .sh-card{min-width:0;display:flex;flex-direction:column}
        .sh-card .th{position:relative;aspect-ratio:${SANJI_IMAGE_ASPECT_RATIO};border-radius:12px;overflow:hidden;background:${GRAY}}
        .sh-card .th>div[aria-hidden="true"]{position:absolute;inset:0}
        .sh-card .th img{position:absolute;inset:0;width:100%;height:100%;padding:4px;object-fit:contain;object-position:center;display:block}
        .sh-card .cd{position:absolute;left:8px;top:8px;display:inline-flex;align-items:center;gap:4px;background:rgba(25,25,25,.85);color:#fff;font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;font-variant-numeric:tabular-nums}
        .sh-card .so{position:absolute;inset:0;background:rgba(0,0,0,.45);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
        .sh-card .nm{min-height:2.8em;margin-top:9px;font-size:14px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
        .sh .was{margin-top:4px;font-size:12px;color:${FAINT};text-decoration:line-through;font-variant-numeric:tabular-nums}
        .sh .pr{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}
        .sh .pr em{font-style:normal;color:${ORANGE};margin-right:5px}
        .sh-card .meta{margin-top:4px;font-size:12px;color:${MUTED}}
        .sh-row{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px 4px;scroll-padding:0 16px}
        .sh-row::-webkit-scrollbar{display:none}
        .sh-row .sh-card{flex:0 0 148px}
        .sh-soonbox{margin:28px 16px 0;padding:18px;border-radius:14px;background:${SOFT}}
        .sh-soonbox h2{margin:0;font-size:17px;font-weight:700}
        .sh-soonbox>p{margin:4px 0 14px;font-size:13px;color:${MUTED}}
        .sh-soonbox>p a{color:${ORANGE};font-weight:600;text-decoration:underline;text-underline-offset:3px}
        .sh-soonlist{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
        .sh-soon{min-width:0;display:flex;gap:12px;align-items:center;padding:12px;border-radius:12px;background:#fff}
        .sh-soon .th{position:relative;flex:0 0 60px;aspect-ratio:${SANJI_IMAGE_ASPECT_RATIO};border-radius:10px;overflow:hidden;background:${GRAY}}
        .sh-soon .th img,.sh-soon .th>div[aria-hidden="true"]{position:absolute;inset:0;width:100%;height:100%;padding:4px;object-fit:contain;object-position:center}
        .sh-soon .bd{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
        .sh-soon .when{font-size:12px;font-weight:700;color:${ORANGE};font-variant-numeric:tabular-nums}
        .sh-soon .nm{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sh-soon .go{flex-shrink:0;height:34px;padding:0 12px;border:1px solid ${INK};border-radius:999px;display:inline-flex;align-items:center;font-size:13px;font-weight:600}
        .sh-rvlist{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
        .sh-rv{min-width:0;display:flex;gap:12px;padding:12px;border:1px solid ${LINE};border-radius:14px}
        .sh-rv .th{position:relative;flex:0 0 72px;aspect-ratio:${SANJI_IMAGE_ASPECT_RATIO};align-self:flex-start;border-radius:10px;overflow:hidden;background:${GRAY}}
        .sh-rv .th img,.sh-rv .th>div[aria-hidden="true"]{position:absolute;inset:0;width:100%;height:100%;padding:4px;object-fit:contain;object-position:center;display:block}
        .sh-rv .bd{min-width:0;flex:1}
        .sh-rv .meta{display:flex;align-items:center;gap:8px;font-size:12px;color:${MUTED}}
        .sh-rv .tx{margin-top:5px;font-size:14px;line-height:1.5;color:${INK};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .sh-rv .pd{margin-top:4px;font-size:12px;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sh-empty{padding:32px 16px;text-align:center;font-size:13px;color:${MUTED};line-height:1.7;background:#F7F7F7;border-radius:14px}
        .sh-nav{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:480px;z-index:40;display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border-top:1px solid ${LINE};padding:6px 0 calc(6px + env(safe-area-inset-bottom))}
        .sh-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:48px;font-size:11px;color:${FAINT}}
        .sh-nav a.on{color:${INK};font-weight:700}
        .sh-top{position:fixed;right:16px;bottom:calc(90px + env(safe-area-inset-bottom));z-index:19;width:48px;height:48px;border-radius:50%;background:#fff;border:1px solid ${LINE};color:${INK};box-shadow:0 4px 14px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center}
        .sh-kakao{position:fixed;right:16px;bottom:calc(148px + env(safe-area-inset-bottom));z-index:19;width:48px;height:48px;border-radius:50%;background:#FEE500;box-shadow:0 4px 14px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center}
        .sh :focus-visible{outline:2px solid ${ORANGE};outline-offset:2px}
        @container sanji-mobile (min-width:761px){
          .sh-hd{top:64px}
          .sh-tabs{padding:14px 28px}
          .sh-ban{margin-top:10px}
          .sh-sec{padding:36px 28px 8px}
          .sh-sec__h h2{font-size:22px}
          .sh-hotlist{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
          .sh-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:28px 16px}
          .sh-row{margin:0 -28px;padding:0 28px 4px}
          .sh-row .sh-card{flex-basis:180px}
          .sh-soonbox{margin:36px 28px 0;padding:24px}
          .sh-soonlist,.sh-rvlist{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
        }
        @container sanji-mobile (max-width:760px){.sh-hd{top:58px}}
        @container sanji-mobile (min-width:1000px){.sh-nav{display:none}.sh{padding-bottom:48px}}
      `}</style>

      {/* 마감 카운트다운 띠 — 가장 먼저 끝나는 공구로 연결 */}
      {first && tab === 0 && (
        <a className="sh-strip" href={href(first)}>
          <Clock size={15} />
          <span>{firstLeftMs < 86400e3 ? "오늘 공구 마감까지" : "가장 빠른 공구 마감까지"} <b>{leftLabel(first.sale_end_at, now)}</b></span>
        </a>
      )}

      {/* 칩 탭 */}
      <div className="sh-hd">
        <div className="sh-tabs" role="tablist" aria-label="상품 분류">
          {Tabs.map((t, i) => (
            <button key={t} role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => setTab(i as 0 | 1 | 2)}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 1 && (
        <div className="sh-sec">
          <div className="sh-sec__h"><h2>밭에서 바로 온 농산물</h2></div>
          <p className="sh-sec__sub">많이 찾는 순 · 농가에서 수확한 그대로</p>
          {produce.length ? <Grid items={produce} linkBase={linkBase} now={now} /> : <div className="sh-empty">판매 중인 농산물이 없어요</div>}
        </div>
      )}
      {tab === 2 && (
        <div className="sh-sec">
          <div className="sh-sec__h"><h2>바다에서 바로 온 수산물</h2></div>
          <p className="sh-sec__sub">많이 찾는 순 · 항구에서 손질해 바로 발송</p>
          {seafood.length ? <Grid items={seafood} linkBase={linkBase} now={now} /> : <div className="sh-empty">수산물은 지금 준비 중이에요<br />바다 산지와 손잡는 대로 이 자리에 올라옵니다</div>}
        </div>
      )}

      {tab === 0 && (
        <>
          {/* 배너 슬라이드 */}
          {banners.length > 0 && (
            <div className="sh-ban">
              <ScrollRail label="메인 배너"><div
                className="sh-ban__track"
                ref={sliderRef}
                onScroll={onSlide}
                onTouchStart={() => { touching.current = true; }}
                onTouchEnd={() => { setTimeout(() => { touching.current = false; }, 1500); }}
                onMouseEnter={() => { touching.current = true; }}
                onMouseLeave={() => { touching.current = false; }}
              >
                {banners.map((b) => (
                  <a key={b.productId} className="sh-ban__item" href={b.href} data-banner-product={b.productId} aria-label={b.alt}>
                    <Img src={b.src} alt={b.alt} />
                  </a>
                ))}
              </div></ScrollRail>
              <span className="sh-ban__badge">새로 열린 공구</span>
              {banners.length > 1 && <span className="sh-ban__count" aria-hidden>{slide + 1} / {banners.length}</span>}
            </div>
          )}

          {/* 마감 임박 공구 */}
          {closing.length > 0 && (
            <div className="sh-sec">
              <div className="sh-sec__h"><h2>마감 임박 공구 <span className="sh-hot-badge">HOT</span></h2></div>
              <p className="sh-sec__sub">마감되면 다음 수확까지 기다려야 해요</p>
              <div className="sh-hotlist">
                {closing.slice(0, 3).map((p) => (
                  <a key={p.id} className="sh-hot" href={href(p)}>
                    <div className="th"><Img src={p.main_image} alt={p.name} /></div>
                    <div className="bd">
                      <span className="cd"><Clock />{leftLabel(p.sale_end_at, now)} 남음</span>
                      <div className="nm">{p.name}</div>
                      <Price p={p} />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 진행 중인 공구 */}
          <div className="sh-sec">
            <div className="sh-sec__h"><h2>진행 중인 공구</h2><a href={`${linkBase}/products`}>전체 보기 ›</a></div>
            <p className="sh-sec__sub">중간 유통 없이, 농가에서 수확한 그대로 보내드려요</p>
            {newest.length ? <Grid items={newest.slice(0, 8)} linkBase={linkBase} now={now} /> : <div className="sh-empty">판매 중인 산지픽 상품이 아직 없어요</div>}
          </div>

          {/* 할인 큰 순 */}
          {deals.length > 1 && (
            <div className="sh-sec">
              <div className="sh-sec__h"><h2>지금 가장 많이 할인해요</h2></div>
              <p className="sh-sec__sub">수확한 만큼만, 한정 수량 공구가</p>
              <ScrollRail label="할인 상품"><div className="sh-row">
                {deals.slice(0, 8).map((p) => <Card key={p.id} p={p} href={href(p)} now={now} />)}
              </div></ScrollRail>
            </div>
          )}

          {/* 곧 열리는 공구 */}
          {upcoming.length > 0 && (
            <section className="sh-soonbox" aria-labelledby="sh-soon-title">
              <h2 id="sh-soon-title">곧 열리는 공구</h2>
              <p>농가 수확 일정에 맞춰 열려요 · <a href={kakaoUrl} target="_blank" rel="noreferrer">카톡으로 오픈 알림 받기</a></p>
              <div className="sh-soonlist">
                {upcoming.map((p) => {
                  const o = openLabel(p.sale_start_at!);
                  return (
                    <a key={p.id} className="sh-soon" href={href(p)}>
                      <div className="th"><Img src={p.main_image} alt="" /></div>
                      <div className="bd">
                        <span className="when">{o.day} {o.time} 오픈</span>
                        <span className="nm">{p.name}</span>
                      </div>
                      <span className="go">미리보기</span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* 후기 */}
          <div className="sh-sec">
            <div className="sh-sec__h"><h2>받아보신 분들의 한마디</h2></div>
            <p className="sh-sec__sub">포장 뜯고 남겨주신 진짜 후기예요</p>
            {reviews.length ? <div className="sh-rvlist">{reviews.map((r) => {
              const p = products.find((x) => x.id === r.product_id);
              return (
                <a key={r.id} className="sh-rv" href={p ? href(p) : `${linkBase}/p/${r.product_id}`}>
                  <div className="th"><Img src={r.image} alt="" /></div>
                  <div className="bd">
                    <div className="meta"><Stars n={r.rating} /><span>{maskName(r.buyer_name || "고객")} · {timeAgo(r.created_at)}</span></div>
                    <div className="tx">{r.content}</div>
                    <div className="pd">{r.product_name}</div>
                  </div>
                </a>
              );
            })}</div> : <div className="sh-empty">첫 후기를 기다리고 있어요</div>}
          </div>
        </>
      )}

      {/* 플로팅 */}
      <a className="sh-kakao" href={kakaoUrl} target="_blank" rel="noreferrer" aria-label="카카오톡 문의">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#191600"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7L5.6 21l4.3-2.6c.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>
      </a>
      {showTop && (
        <button className="sh-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="맨 위로">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
      )}

      {/* 하단 탭바 */}
      <nav className="sh-nav" aria-label="하단 메뉴">
        <a className="on" href={linkBase || "/"} aria-current="page">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>
          홈
        </a>
        <a href={`${linkBase}/about`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22c4-4 8-7.6 8-12a8 8 0 10-16 0c0 4.4 4 8 8 12z"/><circle cx="12" cy="10" r="2.5"/></svg>
          산지 이야기
        </a>
        <a href={`${linkBase}/mypage`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>
          마이페이지
        </a>
      </nav>
    </div>
  );
}
