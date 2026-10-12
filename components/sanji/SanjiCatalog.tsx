"use client";

import { SANJI_COLLECTIONS, collectionPath } from "@/lib/catalog-seo";
import { useEffect, useMemo, useRef, useState } from "react";
import { fbqTrack } from "@/lib/analytics";
import type { SanjiCard } from "@/lib/sanji-data";
import { sanjiKind, type SanjiKind } from "@/lib/sanji-kind";
import SanjiProductCard from "@/components/sanji/SanjiProductCard";
import SanjiProductStyles from "@/components/sanji/SanjiProductStyles";
import SanjiBottomNav from "@/components/sanji/SanjiBottomNav";

type Filter = "all" | SanjiKind;
export default function SanjiCatalog({ products, linkBase, initialQuery = "", initialCategory = "all" }: { products: SanjiCard[]; linkBase: string; initialQuery?: string; initialCategory?: Filter }) {
  const [q, setQ] = useState(initialQuery);
  const filter = initialCategory;
  const lastSearch = useRef("");
  useEffect(() => {
    const query = q.trim();
    if (!query) { lastSearch.current = ""; return; }
    const timer = setTimeout(() => {
      if (lastSearch.current === query) return;
      // Never send the user's raw search text to analytics.
      if (fbqTrack("Search", { content_type: "product" })) lastSearch.current = query;
    }, 700);
    return () => clearTimeout(timer);
  }, [q]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const visible = useMemo(() => products.filter(p => !(p.sale_start_at && Date.parse(p.sale_start_at) > now)), [products, now]);
  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return visible.filter(p => filter === "all" || sanjiKind(p.category) === filter)
      .filter(p => !kw || p.name.toLowerCase().includes(kw) || (p.brand || "").toLowerCase().includes(kw));
  }, [visible, q, filter]);
  const counts = { all: visible.length, produce: visible.filter(p => sanjiKind(p.category) === "produce").length, seafood: visible.filter(p => sanjiKind(p.category) === "seafood").length };

  return <div className="sc">
    <SanjiProductStyles />
    <style>{`
      .sc{background:#fff;color:#202020;min-height:100svh;padding-bottom:85px;letter-spacing:-.025em}.sc *{box-sizing:border-box}.sc a{text-decoration:none;color:inherit}
      .sc-hd{position:sticky;top:58px;z-index:25;background:#fff;border-bottom:1px solid #ededed}
      .sc-chips{display:flex;padding:0 16px;gap:0}.sc-chips a{display:flex;align-items:center;justify-content:center;flex:1;padding:14px 8px 12px;border-bottom:2px solid transparent;font-size:14px;color:#777;font-weight:600}.sc-chips a.on{color:#C9430E;border-bottom-color:#C9430E;font-weight:700}.sc-chips small{font-size:10px;margin-left:5px;font-weight:400}
      .sc-sec{padding:24px 20px 10px}.sc-sec h1{font-size:22px;line-height:1.4;font-weight:700;letter-spacing:-.04em;margin:0 0 5px}.sc-desc{font-size:12px;line-height:1.7;color:#777;margin:0 0 19px}
      .sc-search{display:flex;align-items:center;gap:8px;background:#f3f3f5;border-radius:6px;padding:0 12px;height:43px;margin:0 0 19px}.sc-search input{flex:1;min-width:0;background:none;border:0;outline:0;font:inherit;font-size:13px;color:#222}.sc-search input::placeholder{color:#858585}.sc-search button{border:0;background:none;width:28px;height:32px;font-size:21px;color:#777;cursor:pointer}.sc-search:focus-within{box-shadow:0 0 0 2px #C9430E}
      .sc-sub{font-size:12px;color:#777;margin:0 0 17px}.sc-sub strong{color:#222;font-weight:600}.sc-empty{padding:45px 12px;text-align:center;line-height:1.7;color:#777;font-size:14px}.sc :focus-visible{outline:2px solid #C9430E;outline-offset:3px}
    `}</style>
    <div className="sc-hd"><nav className="sc-chips" aria-label="상품 분류">{([["all", "전체"], ["produce", "농산물"], ["seafood", "수산물"]] as [Filter, string][]).map(([key, label]) => <a key={key} className={filter === key ? "on" : ""} aria-current={filter === key ? "page" : undefined} href={linkBase + collectionPath(key === "all" ? undefined : key)}>{label}<small>{counts[key]}</small></a>)}</nav></div>
    <section className="sc-sec">
      <h1>{SANJI_COLLECTIONS[filter].title}</h1><p className="sc-desc">{SANJI_COLLECTIONS[filter].description}</p>
      <div className="sc-search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></svg><input value={q} onChange={e => setQ(e.target.value)} placeholder="먹거리 이름이나 산지로 검색해보세요" aria-label="산지픽 상품 검색" enterKeyHint="search" />{q && <button aria-label="지우기" onClick={() => setQ("")}>×</button>}</div>
      <p className="sc-sub">{q ? `'${q}' 검색 결과 ` : "전체 "}<strong>{list.length}</strong>개</p>
      {list.length ? <div className="sj-product-grid">{list.map(p => <SanjiProductCard key={p.id} product={p} href={`${linkBase}/p/${p.id}`} now={now} />)}</div> : <div className="sc-empty">{q ? "검색 결과가 없어요. 다른 이름으로 찾아보세요." : "새로운 산지 공구를 준비하고 있어요."}</div>}
    </section>
    <SanjiBottomNav base={linkBase} active="catalog" />
  </div>;
}
