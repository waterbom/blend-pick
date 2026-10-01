"use client";

import { SANJI_COLLECTIONS, collectionPath } from "@/lib/catalog-seo";
import { SANJI_IMAGE_ASPECT_RATIO } from "@/lib/sanji-image-layout";
import { useEffect, useMemo, useRef, useState } from "react";
import { fbqTrack } from "@/lib/analytics";
import type { SanjiCard } from "@/lib/sanji-data";
import { sanjiKind, type SanjiKind } from "@/lib/sanji-kind";

// 산지픽 전체 상품(검색) 페이지 (B안 '공구 오렌지') — 헤더 검색·메뉴에서 진입. 산지픽 상품만 보여준다.
// 상단: 검색창 · 칩(전체/농산물/수산물) · 2열(데스크톱은 자동) 그리드 · 하단 탭바. 카드는 /p/<id> 판매 페이지로.

const ORANGE = "#C9430E";
const INK = "#191919";
const MUTED = "#6E6E6E";
const FAINT = "#8A8A8A";
const LINE = "#EDEDED";
const GRAY = "#F4F4F4";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const pct = (p: SanjiCard) => (p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0);

function Img({ src, alt }: { src: string | null; alt: string }) {
  const [bad, setBad] = useState(!src);
  if (bad) return <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#F4F4F4,#FFF1EA)" }} aria-hidden />;
  return <img src={src!} alt={alt} loading="lazy" onError={() => setBad(true)} />;
}

type Filter = "all" | SanjiKind;

export default function SanjiCatalog({ products, linkBase, initialQuery = "", initialCategory = "all" }: { products: SanjiCard[]; linkBase: string; initialQuery?: string; initialCategory?: Filter }) {
  const [q, setQ] = useState(initialQuery);
  const filter = initialCategory;
  const [stockOnly,setStockOnly]=useState(false),[sort,setSort]=useState(''),[maxPrice,setMaxPrice]=useState('');
  const lastSearch = useRef("");
  useEffect(() => {
    const query = q.trim();
    if (!query) { lastSearch.current = ""; return; }
    const timer = setTimeout(() => {
      if (lastSearch.current === query) return;
      // Do not send raw user-entered text (which may contain personal information).
      if (fbqTrack("Search", { content_type: "product" })) lastSearch.current = query;
    }, 700);
    return () => clearTimeout(timer);
  }, [q]);
  const [now] = useState(() => Date.now()); // 렌더 시점 고정 (오픈 예정 판별)
  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return products
      .filter(p=>!stockOnly||p.status==='active'&&p.stock!==0)
      .filter(p=>!Number(maxPrice)||p.price<=Number(maxPrice))
      .filter((p) => !(p.sale_start_at && new Date(p.sale_start_at).getTime() > now))
      .filter((p) => filter === "all" || sanjiKind(p.category) === filter)
      .filter((p) => !kw || p.name.toLowerCase().includes(kw) || (p.brand || "").toLowerCase().includes(kw))
      .sort((a,b)=>sort==='price-asc'?a.price-b.price:sort==='price-desc'?b.price-a.price:0);
  }, [products, q, filter, now,stockOnly,sort,maxPrice]);
  const counts = useMemo(() => ({
    all: products.length,
    produce: products.filter((p) => sanjiKind(p.category) === "produce").length,
    seafood: products.filter((p) => sanjiKind(p.category) === "seafood").length,
  }), [products]);

  return (
    <div className="sc">
      <style>{`
        .sc{position:relative;max-width:1120px;margin:0 auto;background:#fff;min-height:100svh;font-family:inherit;color:${INK};letter-spacing:-.02em;padding-bottom:calc(76px + env(safe-area-inset-bottom))}
        .sc *{box-sizing:border-box}
        .sc a{color:inherit;text-decoration:none}
        .sc button,.sc input{font-family:inherit}
        .sc :focus-visible{outline:2px solid ${ORANGE};outline-offset:2px}
        .sc-hd{position:sticky;top:64px;z-index:25;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-bottom:1px solid ${LINE}}
        .sc-search{display:flex;align-items:center;gap:8px;margin:14px 16px 10px;height:46px;padding:0 16px;border-radius:999px;background:${GRAY}}
        .sc-search:focus-within{box-shadow:0 0 0 2px ${ORANGE}}
        .sc-search input:focus-visible{outline:none}
        .sc-search input{flex:1;min-width:0;border:0;outline:0;background:none;font-size:15px;color:${INK}}
        .sc-search input::placeholder{color:${FAINT}}
        .sc-search button{border:0;background:none;color:${MUTED};padding:0;display:flex;cursor:pointer;width:32px;height:32px;align-items:center;justify-content:center}
        .sc-chips{display:flex;gap:8px;padding:0 16px 12px;overflow-x:auto;scrollbar-width:none}
        .sc-chips::-webkit-scrollbar{display:none}
        .sc-chips a{flex-shrink:0;display:inline-flex;align-items:center;height:38px;padding:0 16px;border-radius:999px;background:${GRAY};font-size:14px;font-weight:600;color:${INK}}
        .sc-chips a:hover{background:#EAEAEA}
        .sc-chips a.on{background:${INK};color:#fff}
        .sc-chips small{font-weight:500;opacity:.7;margin-left:5px;font-size:12px}
        .sc-sec{padding:22px 16px 8px}
        .sc-sec h1{font-size:22px;font-weight:700;margin:0 0 8px;letter-spacing:-.03em}
        .sc-desc{font-size:13px;line-height:1.7;margin:0 0 14px;color:${MUTED}}
        .sc-sub{margin:0 0 14px;font-size:13px;font-weight:600;color:${INK}}
        .sc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 10px}
        .sc-card{min-width:0;display:flex;flex-direction:column}
        .sc-card .th{position:relative;aspect-ratio:${SANJI_IMAGE_ASPECT_RATIO};border-radius:12px;overflow:hidden;background:${GRAY}}
        .sc-card .th>div[aria-hidden="true"]{position:absolute;inset:0}
        .sc-card .th img{position:absolute;inset:0;width:100%;height:100%;padding:4px;object-fit:contain;object-position:center;display:block}
        .sc-card .so{position:absolute;inset:0;background:rgba(0,0,0,.45);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
        .sc-card .nm{min-height:2.8em;margin-top:9px;font-size:14px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
        .sc-card .was{margin-top:4px;font-size:12px;color:${FAINT};text-decoration:line-through;font-variant-numeric:tabular-nums}
        .sc-card .pr{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}
        .sc-card .pr em{font-style:normal;color:${ORANGE};margin-right:5px}
        .sc-empty{padding:48px 16px;text-align:center;font-size:13px;color:${MUTED};line-height:1.7;background:#F7F7F7;border-radius:14px}
        .sc-nav{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:480px;z-index:40;display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border-top:1px solid ${LINE};padding:6px 0 calc(6px + env(safe-area-inset-bottom))}
        .sc-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:48px;font-size:11px;color:${FAINT}}
        .sc-nav a.on{color:${INK};font-weight:700}
        @media(min-width:761px){.sc-search{max-width:560px;margin:18px 28px 12px}.sc-chips{padding:0 28px 14px}.sc-sec{padding:28px 28px 8px}.sc-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:28px 16px}}
        @media(max-width:760px){.sc-hd{top:58px}}
        @media(min-width:1000px){.sc-nav{display:none}.sc{padding-bottom:48px}}
      `}</style>

      <div className="sc-hd">
        <div className="sc-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input list="sanji-search-suggestions" value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾는 산지 상품이 있나요?" aria-label="산지픽 상품 검색" autoFocus={!initialQuery} enterKeyHint="search" />
          {q && (
            <button onClick={() => setQ("")} aria-label="지우기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          )}
        </div>
        <datalist id="sanji-search-suggestions">{products.filter(p=>!p.sale_start_at||new Date(p.sale_start_at).getTime()<=now).slice(0,100).map(p=><option key={p.id} value={p.name}/>)}</datalist>
        <div className="care-actions px-4 pb-3"><label><input type="checkbox" checked={stockOnly} onChange={e=>setStockOnly(e.target.checked)}/> 구매 가능 상품만</label><select aria-label="가격 정렬" value={sort} onChange={e=>setSort(e.target.value)}><option value="">최신순</option><option value="price-asc">낮은 가격순</option><option value="price-desc">높은 가격순</option></select><input aria-label="최대 가격" type="number" min="0" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="최대 가격" style={{maxWidth:110}}/></div>
        <div className="sc-chips">
          {([["all", "전체"], ["produce", "농산물"], ["seafood", "수산물"]] as [Filter, string][]).map(([k, label]) => (
            <a key={k} className={filter === k ? "on" : ""} aria-current={filter===k ? "page":undefined} href={linkBase+collectionPath(k==="all"?undefined:k)}>{label}<small>{counts[k]}</small></a>
          ))}
        </div>
      </div>

      <div className="sc-sec">
        <h1>{SANJI_COLLECTIONS[filter].title}</h1>
        <p className="sc-desc">{SANJI_COLLECTIONS[filter].description}</p>
        <p className="sc-sub">{q ? `'${q}' 검색 결과 ${list.length}개` : `산지 직송 상품 ${list.length}개`}</p>
        {list.length ? (
          <div className="sc-grid">
            {list.map((p) => (
              <a key={p.id} className="sc-card" href={`${linkBase}/p/${p.id}`}>
                <div className="th"><Img src={p.main_image} alt={p.name} />{(p.stock === 0 || p.status === "soldout") && <span className="so">재고 마감</span>}</div>
                <div className="nm">{p.name}</div>
                {pct(p) > 0 && <div className="was">{won(p.original_price!)}</div>}
                <div className="pr">{pct(p) > 0 && <em>{pct(p)}%</em>}{won(p.price)}</div>
              </a>
            ))}
          </div>
        ) : (
          <div className="sc-empty">
            {filter === "seafood" && !q ? <>수산물은 지금 준비 중이에요<br />바다 산지와 손잡는 대로 올라옵니다</> : q ? <>{`'${q}'에 맞는 상품이 아직 없어요`}<br />다른 이름으로 찾아보세요</> : "판매 중인 상품이 없어요"}
          </div>
        )}
      </div>

      <nav className="sc-nav" aria-label="하단 메뉴">
        <a href={linkBase || "/"}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden><path d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>
          홈
        </a>
        <a href={`${linkBase}/about`}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c4-4 8-7.6 8-12a8 8 0 10-16 0c0 4.4 4 8 8 12z"/><circle cx="12" cy="10" r="2.5"/></svg>
          산지 이야기
        </a>
        <a href={`${linkBase}/mypage`}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>
          마이페이지
        </a>
      </nav>
    </div>
  );
}
