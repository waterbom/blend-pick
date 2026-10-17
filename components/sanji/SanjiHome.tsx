"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SanjiCard, SanjiHomeReview } from "@/lib/sanji-data";
import { storefrontSale } from "@/lib/storefront-sale";
import { sanjiKind } from "@/lib/sanji-kind";
import SanjiIcon, { type SanjiIconName } from "@/components/sanji/SanjiIcon";
import SanjiBottomNav from "@/components/sanji/SanjiBottomNav";
import SanjiProductCard from "@/components/sanji/SanjiProductCard";
import SanjiProductStyles from "@/components/sanji/SanjiProductStyles";
import SanjiProductImage from "@/components/sanji/SanjiProductImage";

const tabs = ["홈", "농산물", "수산물", "새 공구", "마감 임박"];
const maskName = (name: string) => (name || "고객").slice(0, 1) + "**";
const closingLabel = (end: string, now: number) => {
  const minutes = Math.max(0, Math.floor((Date.parse(end) - now) / 60000));
  const days = Math.floor(minutes / 1440);
  return days > 0 ? `${days}일 ${Math.floor(minutes % 1440 / 60)}시간 남음` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 남음`;
};

export default function SanjiHome({ products, reviews, linkBase, kakaoUrl }: {
  products: SanjiCard[]; reviews: SanjiHomeReview[]; linkBase: string; demo?: boolean; kakaoUrl: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const href = (p: SanjiCard) => `${linkBase}/p/${p.id}`;

  useEffect(() => {
    const refresh = () => { setNow(Date.now()); if (!document.hidden) router.refresh(); };
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(refresh, 60000);
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { clearInterval(tick); clearInterval(poll); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("scroll", onScroll); };
  }, [router]);

  const live = useMemo(() => products.filter(p => storefrontSale(p, now) === "open"), [products, now]);
  const newest = useMemo(() => [...live].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [live]);
  const closing = useMemo(() => live.filter(p => p.sale_end_at).sort((a, b) => Date.parse(a.sale_end_at!) - Date.parse(b.sale_end_at!)), [live]);
  const upcoming = useMemo(() => products.filter(p => storefrontSale(p, now) === "upcoming").sort((a, b) => Date.parse(a.sale_start_at!) - Date.parse(b.sale_start_at!)), [products, now]);
  const closed = useMemo(() => products.filter(p => storefrontSale(p, now) === "closed"), [products, now]);
  // Latest five public, open products with images. Never fill the live store with demo inventory.
  const banners = useMemo(() => newest.filter(p => p.main_image?.trim()).slice(0, 5), [newest]);
  const bannerIds = banners.map(p => p.id).join(",");
  useEffect(() => { track.current?.scrollTo({ left: 0, behavior: "instant" }); }, [bannerIds]);
  useEffect(() => {
    if (banners.length < 3 || tab !== 0) return;
    const timer = setInterval(() => {
      const el = track.current;
      if (!el || paused.current || document.hidden || el.contains(document.activeElement) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const width = (el.firstElementChild as HTMLElement | null)?.offsetWidth || 0;
      const last = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      el.scrollTo({ left: last ? 0 : el.scrollLeft + width + 12, behavior: last ? "auto" : "smooth" });
    }, 4500);
    return () => clearInterval(timer);
  }, [banners.length, tab]);

  const filtered = tab === 1 ? live.filter(p => sanjiKind(p.category) === "produce")
    : tab === 2 ? live.filter(p => sanjiKind(p.category) === "seafood") : tab === 4 ? closing : newest;
  const shortcuts: { label: string; icon: SanjiIconName; href: string; tone: string }[] = [
    { label: "농산물", icon: "leaf", href: `${linkBase}/products?category=produce`, tone: "farm" },
    { label: "수산물", icon: "fish", href: `${linkBase}/products?category=seafood`, tone: "sea" },
    { label: "전체 상품", icon: "grid", href: `${linkBase}/products`, tone: "all" },
    { label: "새 공구", icon: "spark", href: "#sanji-new", tone: "new" },
    { label: "산지 이야기", icon: "pin", href: `${linkBase}/about`, tone: "story" },
  ];
  const grid = (items: SanjiCard[]) => <div className="sj-product-grid">{items.map(p => <SanjiProductCard key={p.id} product={p} href={href(p)} now={now} autoPlay />)}</div>;

  return <div className="sh">
    <SanjiProductStyles />
    <style>{`
      .sh{color:#202020;background:#fff;min-height:100svh;padding-bottom:82px;letter-spacing:-.025em}
      .sh *{box-sizing:border-box}.sh a{color:inherit;text-decoration:none}.sh button{font:inherit;cursor:pointer}
      .sh-hd{position:sticky;top:58px;z-index:25;background:#fff;border-bottom:1px solid #ededed}
      .sh-tabs{display:flex;padding:0 12px;overflow:auto;scrollbar-width:none}.sh-tabs::-webkit-scrollbar{display:none}
      .sh-tabs button{flex:1 0 auto;border:0;border-bottom:2px solid transparent;padding:14px 10px 12px;background:none;white-space:nowrap;color:#777;font-size:14px;font-weight:600}
      .sh-tabs button.on{border-bottom-color:#C9430E;color:#C9430E;font-weight:700}
      .sh-feature{background:linear-gradient(to bottom,#fff0de 0,#fff0de 238px,#fff 238px)}
      .sh-feature-head{padding:24px 20px 20px;display:flex;justify-content:space-between;align-items:flex-end;gap:14px}
      .sh-eyebrow{display:inline-block;margin-bottom:8px;font-size:11px;font-weight:600;letter-spacing:.03em;color:#a74722}
      .sh-feature h1{margin:0;font-size:25px;line-height:1.35;font-weight:700;letter-spacing:-.05em;color:#342c23}
      .sh-feature-head>a{display:flex;align-items:center;gap:3px;font-size:12px;white-space:nowrap;color:#895837;padding-bottom:3px}
      .sh-ban__track{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:0 20px 4px;scroll-padding:0 20px}
      .sh-ban__track::-webkit-scrollbar{display:none}.sh-ban__track>.sj-product-card{flex:0 0 calc((100% - 12px)/2);scroll-snap-align:start}
      .sh-ban__track>.sj-product-card:only-child{flex-basis:100%;max-width:280px;margin-inline:auto}
      .sh-shortcuts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:0 20px;padding:28px 0 25px;border-bottom:1px solid #ededed}
      .sh-shortcuts a{display:flex;flex-direction:column;align-items:center;gap:9px;font-size:11px;white-space:nowrap}
      .sh-shortcuts span{width:49px;height:49px;border-radius:50%;display:grid;place-items:center;background:#f7f1e9;color:#966449}
      .sh-shortcuts .farm{background:#eff4e7;color:#5e7843}.sh-shortcuts .sea{background:#eaf2f5;color:#53808d}.sh-shortcuts .new{background:#fff0e4;color:#bc5f26}.sh-shortcuts .story{background:#f6ece9;color:#a36252}
      .sh-sec{padding:27px 20px 7px;scroll-margin-top:114px}
      .sh-sec__h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}.sh-sec__h h2{margin:0;font-size:20px;line-height:1.4;font-weight:700;letter-spacing:-.04em}.sh-sec__h>a{font-size:12px;color:#777;white-space:nowrap}
      .sh-sec__sub{font-size:12px;line-height:1.6;color:#777;margin:0 0 17px}
      .sh-close-list{display:grid;gap:17px}.sh-close{display:grid;grid-template-columns:104px minmax(0,1fr);gap:13px;align-items:start}.sh-close-image{position:relative;aspect-ratio:1;overflow:hidden;border-radius:6px;background:#f5f5f2}.sh-close-image img{width:100%;height:100%;object-fit:contain}.sh-close-time{display:flex;align-items:center;gap:4px;font-size:11px;color:#b44119;font-weight:600;margin:2px 0 6px}.sh-close-name{font-size:14px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.sh-close-price{display:block;margin-top:7px;font-size:18px;font-weight:700}
      .sh-story{display:flex;align-items:center;gap:14px;margin:29px 20px 1px;padding:19px 0;border-top:1px solid #eee5da;border-bottom:1px solid #eee5da}.sh-story-icon{flex-shrink:0;color:#8a6b46}.sh-story strong{font-size:15px;font-weight:700}.sh-story p{font-size:12px;line-height:1.6;color:#777;margin:4px 0 0}.sh-story>svg:last-child{margin-left:auto;color:#8c8173;flex-shrink:0}
      .sh-more{display:flex;justify-content:center;align-items:center;gap:6px;margin-top:22px;min-height:46px;border:1px solid #ddd;border-radius:5px;font-size:13px;font-weight:600}
      .sh-empty{padding:35px 8px;font-size:14px;line-height:1.7;color:#777;text-align:center}
      .sh-upcoming{display:grid;gap:13px}.sh-upcoming a{display:flex;align-items:center;gap:12px;border-bottom:1px solid #f0f0f0;padding-bottom:14px}.sh-upcoming time{display:block;font-size:12px;color:#C9430E;margin-bottom:4px}.sh-upcoming span{font-size:14px;line-height:1.5}.sh-upcoming svg{color:#9b785a;flex-shrink:0}
      .sh-reviews{display:grid;gap:16px}.sh-review{display:flex;gap:12px;padding-bottom:16px;border-bottom:1px solid #eee}.sh-review>img{width:72px;height:72px;object-fit:contain;flex-shrink:0;background:#f5f5f5;border-radius:5px}.sh-review>div{min-width:0}.sh-review small{font-size:11px;color:#777}.sh-review .stars{color:#ad552a;margin-right:7px}.sh-review p{margin:5px 0;font-size:13px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.sh-review .product{font-size:11px;color:#777}
      .sh-kakao{position:fixed;right:max(14px,calc((100vw - 480px)/2 + 14px));bottom:calc(87px + env(safe-area-inset-bottom));z-index:35;width:45px;height:45px;border-radius:50%;background:#FEE500;display:grid;place-items:center;box-shadow:0 2px 9px #00000018}.sh-top{position:fixed;right:max(14px,calc((100vw - 480px)/2 + 14px));bottom:calc(139px + env(safe-area-inset-bottom));z-index:35;width:45px;height:45px;border:1px solid #e9e9e9;border-radius:50%;background:#fff;display:grid;place-items:center}.sh-top svg{transform:rotate(-90deg)}
      .sh :focus-visible{outline:2px solid #C9430E;outline-offset:3px}
      @container sanji-mobile (max-width:350px){.sh-sec{padding-inline:16px}.sh-feature-head{padding-inline:16px}.sh-feature h1{font-size:22px}.sh-feature-head>a{font-size:11px}.sh-tabs button{padding-inline:8px;font-size:13px}.sh-shortcuts{margin-inline:16px;gap:3px}.sh-shortcuts span{width:43px;height:43px}.sh-shortcuts a{font-size:10px}}
    `}</style>

    <div className="sh-hd"><div className="sh-tabs" role="tablist" aria-label="공구 둘러보기">{tabs.map((label, index) => <button key={label} role="tab" aria-selected={tab === index} className={tab === index ? "on" : ""} onClick={() => setTab(index)}>{label}</button>)}</div></div>

    {tab === 0 ? <>
      {banners.length > 0 && <section className="sh-feature" aria-label="대표 산지 공구">
        <div className="sh-feature-head"><div><span className="sh-eyebrow">오늘도 맛있는 산지픽</span><h1>산지의 좋은 것만,<br />오늘의 식탁에.</h1></div><a href={`${linkBase}/products`}>모두 보기 <SanjiIcon name="chevron" size={12} /></a></div>
        <div className="sh-ban__track" ref={track} onTouchStart={() => { paused.current = true; }} onTouchEnd={() => { paused.current = false; }} onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
          {banners.map(p => <SanjiProductCard key={p.id} product={p} href={href(p)} now={now} banner autoPlay />)}
        </div>
      </section>}
      <nav className="sh-shortcuts" aria-label="상품 바로가기">{shortcuts.map(item => <a key={item.label} href={item.href}><span className={item.tone}><SanjiIcon name={item.icon} size={26} /></span>{item.label}</a>)}</nav>

      {closing.length > 0 && <section className="sh-sec" id="sanji-closing"><div className="sh-sec__h"><h2>곧 마감하는 공구</h2><a href={`${linkBase}/products`}>전체 보기 ›</a></div><p className="sh-sec__sub">공구가 끝나기 전에 살펴보세요</p><div className="sh-close-list">{closing.slice(0, 2).map(p => <a key={p.id} href={href(p)} className="sh-close"><div className="sh-close-image"><SanjiProductImage mainImage={p.main_image} images={p.images} name={p.name} autoPlay /></div><div><span className="sh-close-time"><SanjiIcon name="clock" size={13} />{closingLabel(p.sale_end_at!, now)}</span><span className="sh-close-name">{p.name}</span><strong className="sh-close-price">{p.price.toLocaleString("ko-KR")}원</strong></div></a>)}</div></section>}

      <section className="sh-sec" id="sanji-new"><div className="sh-sec__h"><h2>지금 열린 산지 공구</h2><a href={`${linkBase}/products`}>전체 보기 ›</a></div><p className="sh-sec__sub">새로 들어온 먹거리부터 차근차근 둘러보세요</p>{newest.length ? grid(newest.slice(0, 8)) : <div className="sh-empty">새로운 산지 공구를 준비하고 있어요.</div>}<a className="sh-more" href={`${linkBase}/products`}>공구 상품 더 보기 <SanjiIcon name="chevron" size={13} /></a></section>

      <a href={`${linkBase}/about`} className="sh-story"><span className="sh-story-icon"><SanjiIcon name="leaf" size={33} /></span><div><strong>먹거리마다, 산지의 이야기가 있어요</strong><p>어디서 왔는지 알고 고르는 즐거움</p></div><SanjiIcon name="chevron" size={15} /></a>

      {upcoming.length > 0 && <section className="sh-sec"><div className="sh-sec__h"><h2>다음 공구 미리보기</h2></div><p className="sh-sec__sub">오픈 일정을 확인해보세요</p><div className="sh-upcoming">{upcoming.map(p => <a key={p.id} href={href(p)}><SanjiIcon name="clock" size={26} /><div><time dateTime={p.sale_start_at!}>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(p.sale_start_at!))} 오픈</time><span>{p.name}</span></div></a>)}</div></section>}

      {reviews.length > 0 && <section className="sh-sec"><div className="sh-sec__h"><h2>먼저 받아본 분들의 이야기</h2></div><p className="sh-sec__sub">산지픽에 남겨주신 소중한 후기</p><div className="sh-reviews">{reviews.slice(0, 3).map(r => <a key={r.id} href={`${linkBase}/p/${r.product_id}`} className="sh-review">{r.image && <img src={r.image} alt="" loading="lazy" />}<div><small><span className="stars" aria-label={`${r.rating}점`}>{"★".repeat(Math.round(r.rating))}</span>{maskName(r.buyer_name)}</small><p>{r.content}</p><span className="product">{r.product_name}</span></div></a>)}</div></section>}

      {closed.length > 0 && <section className="sh-sec"><div className="sh-sec__h"><h2>마감된 공구</h2><a href={`${linkBase}/products`}>전체 보기 ›</a></div><p className="sh-sec__sub">지난 공구도 여기에서 확인할 수 있어요</p>{grid(closed)}</section>}
    </> : <section className="sh-sec"><div className="sh-sec__h"><h2>{tab === 1 ? "산지에서 온 농산물" : tab === 2 ? "바다에서 온 수산물" : tab === 4 ? "곧 마감하는 공구" : "새로 열린 공구"}</h2><a href={`${linkBase}/products`}>전체 보기 ›</a></div><p className="sh-sec__sub">원하는 먹거리를 골라보세요</p>{filtered.length ? grid(filtered) : <div className="sh-empty">지금은 해당 공구를 준비하고 있어요.</div>}</section>}

    <a className="sh-kakao" href={kakaoUrl} target="_blank" rel="noreferrer" aria-label="카카오톡 문의"><svg width="23" height="23" viewBox="0 0 24 24" fill="#191600" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7L5.6 21l4.3-2.6c.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8S17.5 3 12 3z" /></svg></a>
    {showTop && <button className="sh-top" aria-label="맨 위로" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><SanjiIcon name="chevron" size={19} /></button>}
    <SanjiBottomNav base={linkBase} active="home" />
  </div>;
}
