"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SanjiCard, SanjiHomeReview } from "@/lib/sanji-data";
import { SANJI_BANNERS, bannerSrc, bannerTarget } from "@/lib/sanji-banners";

// 산지픽 메인 (sanjipick.blendpunch.com/) — 오늘과일(쿠마) 메인 구성을 산지픽 톤으로.
// 헤더(로고·검색·장바구니) → 탭(추천/베스트/신상품) → 배너 슬라이드 → 큰 2열 카드 → 한정특가 3열
// → 신상품 가로 스크롤 → 곧 오픈 예정 → 고객 후기 리스트 → 하단 탭바. 카드는 전부 /p/<id> 상세(판매 페이지)로 연결.

const GREEN = "#2F5D34"; // 로고 그린
const CREAM = "#FBF8F1"; // 로고 바탕 크림
const INK = "#1E2A1F";
const MUTED = "#8A8A8A";
const LINE = "#E8E3D6";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const pct = (p: SanjiCard) => (p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0);
const gap = (p: SanjiCard) => (p.original_price && p.original_price > p.price ? p.original_price - p.price : 0);
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

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} aria-label={`${n}점`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(n) ? "#FFB400" : "#E3E3E3"}>
          <path d="M12 2l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 18l-6.4 3.4 1.4-7.1L1.7 9.4l7.2-.8z" />
        </svg>
      ))}
    </span>
  );
}

function Img({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [bad, setBad] = useState(!src);
  if (bad) return <div className={className} style={{ background: "linear-gradient(135deg,#F3E9D2,#DFE9D0)" }} aria-hidden />;
  return <img src={src!} alt={alt} className={className} loading="lazy" onError={() => setBad(true)} />;
}

export default function SanjiHome({
  products, reviews, linkBase, kakaoUrl,
}: {
  products: SanjiCard[]; reviews: SanjiHomeReview[]; linkBase: string; demo?: boolean; kakaoUrl: string;
}) {
  const href = (p: SanjiCard) => `${linkBase}/p/${p.id}`;
  const now = Date.now();
  const isUpcoming = (p: SanjiCard) => !!p.sale_start_at && new Date(p.sale_start_at).getTime() > now;
  const isOpen = (p: SanjiCard) => !isUpcoming(p) && !(p.sale_end_at && new Date(p.sale_end_at).getTime() < now);
  const live = useMemo(() => products.filter(isOpen), [products]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcoming = useMemo(() => products.filter(isUpcoming).sort((a, b) => new Date(a.sale_start_at!).getTime() - new Date(b.sale_start_at!).getTime()), [products]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = useMemo(() => [...live].sort((a, b) => b.sold - a.sold), [live]);
  const newest = useMemo(() => [...live].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [live]);
  const deals = useMemo(() => live.filter((p) => pct(p) > 0).sort((a, b) => pct(b) - pct(a)), [live]);

  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // 배너 슬라이드 — lib/sanji-banners 의 광고 배너 5장, 3초 자동 넘김, 누르면 상품 상세
  const banners = useMemo(() => SANJI_BANNERS.map((b) => {
    const t = bannerTarget(b, products);
    return { ...b, href: t ? `${linkBase}/p/${t.id}` : live[0] ? href(live[0]) : (linkBase || "/") };
  }), [products, live, linkBase]); // eslint-disable-line react-hooks/exhaustive-deps
  const sliderRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const touching = useRef(false);
  const onSlide = () => {
    const el = sliderRef.current;
    if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };
  useEffect(() => {
    if (banners.length < 2) return;
    const id = setInterval(() => {
      const el = sliderRef.current;
      if (!el || touching.current || document.hidden) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      const next = (cur + 1) % banners.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: next === 0 ? "auto" : "smooth" });
    }, 3000);
    return () => clearInterval(id);
  }, [banners.length]);

  // 대표 상품 큰 카드 — 3.5초마다 한 장씩 자동 넘김 (손대는 동안·화면 벗어나면 멈춤, 끝나면 처음으로)
  const bigRef = useRef<HTMLDivElement>(null);
  const bigTouch = useRef(false);
  const bigCount = Math.min(live.length, 6);
  useEffect(() => {
    if (bigCount < 2 || tab !== 0) return;
    const id = setInterval(() => {
      const el = bigRef.current;
      if (!el || bigTouch.current || document.hidden) return;
      const card = el.querySelector<HTMLElement>(".sh-bigcard");
      if (!card) return;
      const step = card.offsetWidth + 12;
      const cur = Math.round(el.scrollLeft / step);
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      const next = atEnd ? 0 : cur + 1;
      el.scrollTo({ left: next * step, behavior: next === 0 ? "auto" : "smooth" });
    }, 3500);
    return () => clearInterval(id);
  }, [bigCount, tab]);

  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const f = () => setShowTop(window.scrollY > 500);
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  const Grid = ({ items }: { items: SanjiCard[] }) => (
    <div className="sh-grid">
      {items.map((p) => (
        <a key={p.id} className="sh-card" href={href(p)}>
          <div className="th"><Img src={p.main_image} alt={p.name} />{(p.stock === 0 || p.status === "soldout") && <span className="so">품절</span>}</div>
          <div className="nm">{p.name}</div>
          <div className="pr">{pct(p) > 0 && <em>{pct(p)}%</em>}{won(p.price)}</div>
        </a>
      ))}
    </div>
  );

  return (
    <div className="sh">
      <style>{`
        .sh{position:relative;max-width:480px;margin:0 auto;background:${CREAM};min-height:100svh;font-family:'Noto Sans KR',-apple-system,sans-serif;color:${INK};letter-spacing:-.01em;padding-bottom:calc(76px + env(safe-area-inset-bottom))}
        .sh *{box-sizing:border-box}
        .sh a{color:inherit;text-decoration:none}
        .sh button{font-family:inherit;cursor:pointer}
        .sh-hd{position:sticky;top:0;z-index:10;background:${CREAM}}
        .sh-hd__row{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px}
        .sh-logo{display:inline-flex;align-items:center;gap:8px;color:${GREEN};line-height:1}
        .sh-logo img{height:52px;width:auto;display:block}
        .sh-hd__icons{display:flex;gap:18px;color:${INK}}
        .sh-tabs{display:flex;gap:4px;padding:0 16px;border-bottom:1px solid ${LINE}}
        .sh-tabs button{height:44px;padding:0 6px;border:0;background:none;font-size:16px;font-weight:600;color:#7A8074;position:relative}
        .sh-tabs button.on{color:${GREEN}}
        .sh-tabs button.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:${GREEN}}
        .sh-ban{position:relative;margin-top:14px}
        .sh-ban__track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;aspect-ratio:1200/760;background:#E9E4D6}
        .sh-ban__dots{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;gap:6px;pointer-events:none}
        .sh-ban__dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 0 0 1px rgba(0,0,0,.08);transition:width .2s,background .2s}
        .sh-ban__dots i.on{width:18px;border-radius:3px;background:#fff}
        .sh-ban__track::-webkit-scrollbar{display:none}
        .sh-ban__item{position:relative;flex:0 0 100%;scroll-snap-align:start;overflow:hidden}
        .sh-ban__item img,.sh-ban__item .ph{width:100%;height:100%;object-fit:cover;display:block}
        .sh-ban__cnt{position:absolute;right:12px;bottom:10px;color:#fff;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;background:rgba(0,0,0,.35);padding:2px 8px;border-radius:999px}
        .sh-sec{padding:28px 16px 8px}
        .sh-sec__h{display:flex;align-items:baseline;justify-content:space-between}
        .sh-sec__h h2{margin:0;font-size:21px;font-weight:800;letter-spacing:-.03em}
        .sh-sec__h a{font-size:13px;color:${MUTED}}
        .sh-sec__sub{margin:4px 0 14px;font-size:14px;color:#777}
        .sh-big{display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px 4px;scroll-snap-type:x mandatory;scroll-padding:0 16px}
        .sh-big::-webkit-scrollbar{display:none}
        .sh-bigcard{flex:0 0 78%;scroll-snap-align:start}
        .sh-bigcard:last-child{margin-right:16px}
        .sh-bigcard .th{position:relative;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#E9E4D6;border:1px solid ${LINE}}
        .sh-bigcard .th img{width:100%;height:100%;object-fit:cover;display:block}
        .sh-bigcard .pill{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,.6);color:#fff;font-size:13px;font-weight:700;padding:7px 14px;border-radius:999px;white-space:nowrap;backdrop-filter:blur(4px)}
        .sh-bigcard .pill::before{content:"%";display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:${GREEN};font-size:10px}
        .sh-bigcard .left{display:flex;align-items:center;gap:5px;margin-top:12px;font-size:13px;color:#777}
        .sh-bigcard .ttl{margin-top:8px;font-size:18px;font-weight:800;line-height:1.45;word-break:keep-all}
        .sh-bigcard .ttl span{background:linear-gradient(transparent 55%,#DCEBD6 55%)}
        .sh-bigcard .pr{margin-top:8px;font-size:22px;font-weight:900;font-variant-numeric:tabular-nums}
        .sh-bigcard .pr em{font-style:normal;color:${GREEN};margin-right:6px}
        .sh-bigcard .br{margin-top:2px;font-size:13px;color:#777}
        .sh-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 10px}
        .sh-card .th{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#E9E4D6;border:1px solid ${LINE}}
        .sh-card .th img{width:100%;height:100%;object-fit:cover;display:block}
        .sh-card .so{position:absolute;inset:0;background:rgba(0,0,0,.4);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
        .sh-card .nm{margin-top:8px;font-size:14px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .sh-card .pr{margin-top:4px;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
        .sh-card .pr em{font-style:normal;color:${GREEN};margin-right:4px}
        .sh-row{display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px 4px;scroll-padding:0 16px}
        .sh-row::-webkit-scrollbar{display:none}
        .sh-row .sh-card{flex:0 0 150px}
        .sh-row .sh-card .nm{font-size:15px}
        .sh-soon .th{position:relative}
        .sh-soon .th::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.42)}
        .sh-soon .when{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.5)}
        .sh-soon .when small{font-size:13px;font-weight:600}
        .sh-soon .when b{font-size:26px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.1}
        .sh-rv{display:grid;grid-template-columns:130px 1fr;gap:14px;padding:14px 0;border-bottom:1px solid ${LINE}}
        .sh-rv .th{aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:#E9E4D6}
        .sh-rv .th img{width:100%;height:100%;object-fit:cover;display:block}
        .sh-rv .nm{font-size:16px;font-weight:700}
        .sh-rv .meta{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;color:${MUTED}}
        .sh-rv .tx{margin-top:8px;font-size:14px;line-height:1.55;color:#333;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
        .sh-rv .pd{margin-top:6px;font-size:12px;color:${MUTED}}
        .sh-empty{padding:28px 0;text-align:center;font-size:13px;color:${MUTED};line-height:1.7}
        .sh-nav{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:480px;z-index:20;display:grid;grid-template-columns:repeat(3,1fr);background:${CREAM};border-top:1px solid ${LINE};padding:8px 0 calc(8px + env(safe-area-inset-bottom))}
        .sh-nav a{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:#777}
        .sh-nav a.on{color:${GREEN}}
        .sh-top{position:fixed;right:16px;bottom:calc(90px + env(safe-area-inset-bottom));z-index:19;width:48px;height:48px;border-radius:50%;background:${CREAM};border:1px solid ${LINE};color:${GREEN};box-shadow:0 4px 14px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center}
        .sh-kakao{position:fixed;right:16px;bottom:calc(148px + env(safe-area-inset-bottom));z-index:19;width:48px;height:48px;border-radius:50%;background:#FEE500;box-shadow:0 4px 14px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center}
      `}</style>

      {/* 헤더 + 탭 */}
      <div className="sh-hd">
        <div className="sh-hd__row">
          <a href={linkBase || "/"} className="sh-logo" aria-label="산지픽 홈"><img src="/sanji/logo-wide.png" alt="산지픽 SANJI PICK" /></a>
          <div className="sh-hd__icons">
            <a href="/products" aria-label="검색">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            </a>
            <a href="/cart" aria-label="장바구니">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.9a2 2 0 002-1.6L22 7H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/></svg>
            </a>
          </div>
        </div>
        <div className="sh-tabs">
          {["산지 추천", "베스트", "신상품"].map((t, i) => (
            <button key={t} className={tab === i ? "on" : ""} onClick={() => setTab(i as 0 | 1 | 2)}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 1 && (
        <div className="sh-sec">
          <div className="sh-sec__h"><h2>🏆 지금 제일 잘 나가요</h2></div>
          <p className="sh-sec__sub">누적 판매량 순</p>
          {best.length ? <Grid items={best} /> : <div className="sh-empty">판매 중인 상품이 없어요</div>}
        </div>
      )}
      {tab === 2 && (
        <div className="sh-sec">
          <div className="sh-sec__h"><h2>🔔 따끈따끈한 신상품!</h2></div>
          <p className="sh-sec__sub">최근 등록 순</p>
          {newest.length ? <Grid items={newest} /> : <div className="sh-empty">등록된 상품이 없어요</div>}
        </div>
      )}

      {tab === 0 && (
        <>
          {/* 배너 슬라이드 */}
          {banners.length > 0 && (
            <div className="sh-ban">
              <div
                className="sh-ban__track"
                ref={sliderRef}
                onScroll={onSlide}
                onTouchStart={() => { touching.current = true; }}
                onTouchEnd={() => { setTimeout(() => { touching.current = false; }, 1500); }}
                onMouseEnter={() => { touching.current = true; }}
                onMouseLeave={() => { touching.current = false; }}
              >
                {banners.map((b) => (
                  <a key={b.file} className="sh-ban__item" href={b.href} aria-label={b.alt}>
                    <Img src={bannerSrc(b)} alt={b.alt} />
                  </a>
                ))}
              </div>
              <div className="sh-ban__dots" aria-hidden>
                {banners.map((b, i) => <i key={b.file} className={i === slide ? "on" : ""} />)}
              </div>
              <span className="sh-ban__cnt">{slide + 1}/{banners.length}</span>
            </div>
          )}

          {/* 큰 2열 카드 — 산지 직송 대표 상품 */}
          <div className="sh-sec">
            <div className="sh-sec__h"><h2>산지에서 바로 온 그 상품!</h2></div>
            <p className="sh-sec__sub">아묻따! 농가에서 직접 보내는 산지 직송</p>
            {live.length ? (
              <div
                className="sh-big"
                ref={bigRef}
                onTouchStart={() => { bigTouch.current = true; }}
                onTouchEnd={() => { setTimeout(() => { bigTouch.current = false; }, 2500); }}
                onMouseEnter={() => { bigTouch.current = true; }}
                onMouseLeave={() => { bigTouch.current = false; }}
              >
                {live.slice(0, 6).map((p) => (
                  <a key={p.id} className="sh-bigcard" href={href(p)}>
                    <div className="th">
                      <Img src={p.main_image} alt={p.name} />
                      {gap(p) > 0 && <span className="pill">{won(gap(p))} 추가 할인</span>}
                    </div>
                    <div className="left">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>
                      {p.stock > 0 ? `${p.stock.toLocaleString()}개 남음` : "품절"}
                    </div>
                    <div className="ttl"><span>{p.name}</span></div>
                    <div className="pr">{pct(p) > 0 && <em>{pct(p)}%</em>}{won(p.price)}</div>
                    <div className="br">{p.brand}</div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="sh-empty">판매 중인 산지픽 상품이 아직 없어요</div>
            )}
          </div>

          {/* 한정특가 3열 */}
          {deals.length > 0 && (
            <div className="sh-sec">
              <div className="sh-sec__h"><h2>눈 깜짝할 새 없어지는 한정특가!</h2></div>
              <p className="sh-sec__sub">수확한 만큼만 드리는 산지 초특가</p>
              <Grid items={deals.slice(0, 6)} />
            </div>
          )}

          {/* 신상품 가로 */}
          {newest.length > 0 && (
            <div className="sh-sec">
              <div className="sh-sec__h"><h2>🔔 따끈따끈한 신상품!</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab(2); window.scrollTo({ top: 0 }); }}>더보기 ›</a></div>
              <p className="sh-sec__sub">이번 주 새로 올라온 산지 상품</p>
              <div className="sh-row">
                {newest.slice(0, 8).map((p) => (
                  <a key={p.id} className="sh-card" href={href(p)}>
                    <div className="th"><Img src={p.main_image} alt={p.name} /></div>
                    <div className="nm">{p.name}</div>
                    <div className="pr">{pct(p) > 0 && <em>{pct(p)}%</em>}{won(p.price)}</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 곧 오픈 예정 */}
          {upcoming.length > 0 && (
            <div className="sh-sec">
              <div className="sh-sec__h"><h2>🔔 곧 오픈 예정!</h2></div>
              <p className="sh-sec__sub">장바구니 비워 두셨나요? 수확 맞춰 열리는 공구예요</p>
              <div className="sh-row">
                {upcoming.map((p) => {
                  const o = openLabel(p.sale_start_at!);
                  return (
                    <a key={p.id} className="sh-card sh-soon" href={href(p)}>
                      <div className="th">
                        <Img src={p.main_image} alt={p.name} />
                        <div className="when"><small>{o.day}</small><b>{o.time}</b></div>
                      </div>
                      <div className="nm">{p.name}</div>
                      <div className="pr">{pct(p) > 0 && <em>{pct(p)}%</em>}{won(p.price)}</div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* 후기 */}
          <div className="sh-sec">
            <div className="sh-sec__h"><h2>고객분들의 솔직 담백한 후기</h2></div>
            <p className="sh-sec__sub">직접 받아본 분들의 이야기</p>
            {reviews.length ? reviews.map((r) => {
              const p = products.find((x) => x.id === r.product_id);
              return (
                <a key={r.id} className="sh-rv" href={p ? href(p) : `${linkBase}/p/${r.product_id}`}>
                  <div className="th"><Img src={r.image} alt="" /></div>
                  <div>
                    <div className="nm">{maskName(r.buyer_name || "고객")}</div>
                    <div className="meta"><Stars n={r.rating} /><span>{timeAgo(r.created_at)}</span></div>
                    <div className="tx">{r.content}</div>
                    <div className="pd">{r.product_name}</div>
                  </div>
                </a>
              );
            }) : <div className="sh-empty">첫 후기를 기다리고 있어요</div>}
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
      <nav className="sh-nav">
        <a className="on" href={linkBase || "/"}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>
          쇼핑
        </a>
        <a href={`${linkBase}/about`}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c4-4 8-7.6 8-12a8 8 0 10-16 0c0 4.4 4 8 8 12z"/><circle cx="12" cy="10" r="2.5"/></svg>
          산지 이야기
        </a>
        <a href="/mypage">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>
          마이페이지
        </a>
      </nav>
    </div>
  );
}
