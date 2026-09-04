"use client";

import { useMemo, useState } from "react";
import type { SanjiCard } from "@/lib/sanji-data";
import { sanjiKind, type SanjiKind } from "@/lib/sanji-kind";

// 산지픽 전체 상품(검색) 페이지 — 메인 돋보기에서 진입. 산지픽 상품만 보여주고, 헤더는 메인과 같은 크기.
// 상단: 로고 + 검색창 · 칩(전체/농산물/해산물) · 3열 그리드 · 하단 탭바. 카드는 /p/<id> 판매 페이지로.

const GREEN = "#2F5D34";
const CREAM = "#FBF8F1";
const INK = "#1E2A1F";
const MUTED = "#8A8A8A";
const LINE = "#E8E3D6";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const pct = (p: SanjiCard) => (p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0);

function Img({ src, alt }: { src: string | null; alt: string }) {
  const [bad, setBad] = useState(!src);
  if (bad) return <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#F3E9D2,#DFE9D0)" }} aria-hidden />;
  return <img src={src!} alt={alt} loading="lazy" onError={() => setBad(true)} />;
}

type Filter = "all" | SanjiKind;

export default function SanjiCatalog({ products, linkBase, initialQuery = "" }: { products: SanjiCard[]; linkBase: string; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>("all");
  const now = Date.now();
  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return products
      .filter((p) => !(p.sale_start_at && new Date(p.sale_start_at).getTime() > now))
      .filter((p) => filter === "all" || sanjiKind(p.category) === filter)
      .filter((p) => !kw || p.name.toLowerCase().includes(kw) || (p.brand || "").toLowerCase().includes(kw));
  }, [products, q, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => ({
    all: products.length,
    produce: products.filter((p) => sanjiKind(p.category) === "produce").length,
    seafood: products.filter((p) => sanjiKind(p.category) === "seafood").length,
  }), [products]);

  return (
    <div className="sc">
      <style>{`
        .sc{position:relative;max-width:480px;margin:0 auto;background:${CREAM};min-height:100svh;font-family:'Noto Sans KR',-apple-system,sans-serif;color:${INK};letter-spacing:-.01em;padding-bottom:calc(76px + env(safe-area-inset-bottom))}
        .sc *{box-sizing:border-box}
        .sc a{color:inherit;text-decoration:none}
        .sc button,.sc input{font-family:inherit}
        .sc-hd{position:sticky;top:0;z-index:10;background:${CREAM}}
        .sc-hd__row{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px}
        .sc-logo img{height:52px;width:auto;display:block}
        .sc-hd__icons{display:flex;gap:18px;color:${INK}}
        .sc-search{display:flex;align-items:center;gap:8px;margin:4px 16px 10px;height:44px;padding:0 14px;border-radius:12px;background:#fff;border:1px solid ${LINE}}
        .sc-search input{flex:1;border:0;outline:0;background:none;font-size:15px;color:${INK}}
        .sc-search input::placeholder{color:#A9A9A9}
        .sc-search button{border:0;background:none;color:${MUTED};padding:0;display:flex;cursor:pointer}
        .sc-chips{display:flex;gap:8px;padding:0 16px 12px;border-bottom:1px solid ${LINE}}
        .sc-chips button{height:34px;padding:0 14px;border-radius:999px;border:1px solid ${LINE};background:#fff;font-size:13px;font-weight:600;color:#6B7266;cursor:pointer}
        .sc-chips button.on{background:${GREEN};border-color:${GREEN};color:#fff}
        .sc-chips button small{font-weight:500;opacity:.75;margin-left:4px}
        .sc-sec{padding:18px 16px 8px}
        .sc-sub{margin:0 0 14px;font-size:13px;color:${MUTED}}
        .sc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 10px}
        .sc-card .th{position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background:#E9E4D6;border:1px solid ${LINE}}
        .sc-card .th img{width:100%;height:100%;object-fit:cover;display:block}
        .sc-card .so{position:absolute;inset:0;background:rgba(0,0,0,.4);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
        .sc-card .nm{margin-top:8px;font-size:14px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .sc-card .pr{margin-top:4px;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
        .sc-card .pr em{font-style:normal;color:${GREEN};margin-right:4px}
        .sc-empty{padding:48px 0;text-align:center;font-size:13px;color:${MUTED};line-height:1.7}
        .sc-nav{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:480px;z-index:20;display:grid;grid-template-columns:repeat(3,1fr);background:${CREAM};border-top:1px solid ${LINE};padding:8px 0 calc(8px + env(safe-area-inset-bottom))}
        .sc-nav a{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:#777}
        .sc-nav a.on{color:${GREEN}}
      `}</style>

      <div className="sc-hd">
        <div className="sc-hd__row">
          <a href={linkBase || "/"} className="sc-logo" aria-label="산지픽 홈"><img src="/sanji/logo-wide.png" alt="산지픽 SANJI PICK" /></a>
          <div className="sc-hd__icons">
            <a href="/cart" aria-label="장바구니">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.9a2 2 0 002-1.6L22 7H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/></svg>
            </a>
          </div>
        </div>
        <div className="sc-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾는 산지 상품이 있나요?" autoFocus={!initialQuery} enterKeyHint="search" />
          {q && (
            <button onClick={() => setQ("")} aria-label="지우기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          )}
        </div>
        <div className="sc-chips">
          {([["all", "전체"], ["produce", "농산물"], ["seafood", "해산물"]] as [Filter, string][]).map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{label}<small>{counts[k]}</small></button>
          ))}
        </div>
      </div>

      <div className="sc-sec">
        <p className="sc-sub">{q ? `'${q}' 검색 결과 ${list.length}개` : `산지 직송 상품 ${list.length}개`}</p>
        {list.length ? (
          <div className="sc-grid">
            {list.map((p) => (
              <a key={p.id} className="sc-card" href={`${linkBase}/p/${p.id}`}>
                <div className="th"><Img src={p.main_image} alt={p.name} />{(p.stock === 0 || p.status === "soldout") && <span className="so">품절</span>}</div>
                <div className="nm">{p.name}</div>
                <div className="pr">{pct(p) > 0 && <em>{pct(p)}%</em>}{won(p.price)}</div>
              </a>
            ))}
          </div>
        ) : (
          <div className="sc-empty">
            {filter === "seafood" && !q ? <>해산물은 지금 준비 중이에요<br />바다 산지와 손잡는 대로 올라옵니다</> : q ? <>'{q}'에 맞는 상품이 아직 없어요<br />다른 이름으로 찾아보세요</> : "판매 중인 상품이 없어요"}
          </div>
        )}
      </div>

      <nav className="sc-nav">
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
