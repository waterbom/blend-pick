"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shopUnitPrice } from "@/lib/shop-price";
import { productShippingFee, shippingLabel } from "@/lib/shipping";
import type { SanjiCard, SanjiOption, SanjiProduct, SanjiReview, SanjiStats } from "@/lib/sanji-data";

// 산지픽 판매 페이지 — 랜딩 없이 곧바로 상품을 파는 모바일 화면.
// 위에서부터: 상품 슬라이드(재구매 알림) → 한정특가 잔여 바 → 제목·평점·가격 → 탭(설명/정보/후기)
// → 상품설명(더보기) → 상품정보 → 함께 본 상품 → 후기 카드 → 하단 고정 "특가 종료 후 N원 비싸져요" + 선물하기/구매하기.
// 구매는 블랜드픽 결제 흐름(/products/[id]/checkout, /cart/checkout)을 그대로 탄다.

const GREEN = "#2F5D34"; // 로고 그린
const CREAM = "#FBF8F1";
const INK = "#1E2A1F";
const MUTED = "#8A8A8A";
const LINE = "#E8E3D6";
const BAND = "#F3EDDF";

export interface SanjiSalesProps {
  product: SanjiProduct;
  images: string[];
  options: SanjiOption[];
  reviews: { list: SanjiReview[]; total: number; average: number };
  stats: SanjiStats;
  others: SanjiCard[];
  influencerId: string | null;
  demo?: boolean;
  kakaoUrl: string;
  linkBase: string; // 산지픽 도메인이면 "" · shop 도메인의 /sanji 경로로 보고 있으면 "/sanji"
}

const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const maskName = (n: string) => (n.length <= 1 ? n + "*" : n[0] + "*".repeat(Math.max(1, n.length - 2)) + (n.length > 2 ? n[n.length - 1] : ""));
const fmtDate = (s: string) => {
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span aria-label={`${n}점`} style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(n) ? "#FFB400" : "#E3E3E3"}>
          <path d="M12 2l3.1 6.6 7.2.8-5.3 4.9 1.4 7.1L12 18l-6.4 3.4 1.4-7.1L1.7 9.4l7.2-.8z" />
        </svg>
      ))}
    </span>
  );
}

// 이미지 — 깨지면 빈 자리 대신 연한 그라데이션
function Img({ src, alt, style, className }: { src: string | null; alt: string; style?: React.CSSProperties; className?: string }) {
  const [bad, setBad] = useState(!src);
  if (bad) return <div className={className} style={{ ...style, background: "linear-gradient(135deg,#F3E9D2,#DFE9D0)" }} aria-hidden />;
  return <img src={src!} alt={alt} className={className} style={style} loading="lazy" onError={() => setBad(true)} />;
}

export default function SanjiSalesPage({ product, images, options, reviews, stats, others, influencerId, demo = false, kakaoUrl, linkBase }: SanjiSalesProps) {
  const router = useRouter();

  // ── 시간창·재고 ─────────────────────────────────────────────
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!product.sale_start_at && !product.sale_end_at) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [product.sale_start_at, product.sale_end_at]);
  const startMs = product.sale_start_at ? new Date(product.sale_start_at).getTime() : null;
  const endMs = product.sale_end_at ? new Date(product.sale_end_at).getTime() : null;
  const saleState: "upcoming" | "open" | "ended" =
    startMs && startMs > nowMs ? "upcoming" : endMs && endMs < nowMs ? "ended" : "open";
  const soldout = product.status === "soldout" || product.stock === 0;
  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round((1 - product.price / product.original_price) * 100)
      : null;
  const priceGap = product.original_price && product.original_price > product.price ? product.original_price - product.price : 0;
  const endLeft = (() => {
    if (!endMs || saleState !== "open") return "";
    const left = endMs - nowMs;
    const d = Math.floor(left / 86400e3), h = Math.floor((left % 86400e3) / 3600e3), m = Math.floor((left % 3600e3) / 60e3), s = Math.floor((left % 60e3) / 1e3);
    return d > 0 ? `${d}일 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();
  const soldRatio = stats.sold + product.stock > 0 ? Math.min(0.96, Math.max(0.08, stats.sold / (stats.sold + product.stock))) : 0.08;

  // ── 슬라이드 ────────────────────────────────────────────────
  const sliderRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const onSlideScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };
  const slides = images.length ? images : [null];

  // ── 탭 ─────────────────────────────────────────────────────
  const [tab, setTab] = useState(0);
  const descRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const TABS = [
    { label: "상품설명", ref: descRef },
    { label: "상품정보", ref: infoRef },
    { label: `상품후기${reviews.total ? ` (${reviews.total.toLocaleString()})` : ""}`, ref: reviewRef },
  ];
  const goTab = (i: number) => {
    setTab(i);
    const el = TABS[i].ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 48;
    window.scrollTo({ top, behavior: "smooth" });
  };
  useEffect(() => {
    // 스크롤 위치에 따라 활성 탭 동기화
    const onScroll = () => {
      const y = window.scrollY + 60;
      let i = 0;
      TABS.forEach((t, idx) => {
        const el = t.ref.current;
        if (el && el.offsetTop <= y) i = idx;
      });
      setTab(i);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [descOpen, setDescOpen] = useState(false);
  const [shownReviews, setShownReviews] = useState(5);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1800);
  };

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text: `${product.name} — 산지픽 특가`, url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("링크를 복사했어요");
    } catch {
      flash("주소창의 링크를 복사해 주세요");
    }
  }

  // ── 구매 시트 ────────────────────────────────────────────────
  const [sheet, setSheet] = useState<null | "buy" | "gift">(null);
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState<{ optionId: string; qty: number }[]>([]);
  const hasOptions = options.length > 0;
  const optById = (id: string) => options.find((o) => o.id === id);
  const optDead = (o: SanjiOption) => !o.is_active || o.stock === 0;
  const itemsTotal = hasOptions
    ? lines.reduce((s, l) => s + shopUnitPrice(product.price, optById(l.optionId)?.extra_price, true) * l.qty, 0)
    : product.price * qty;
  const totalCount = hasOptions ? lines.reduce((s, l) => s + l.qty, 0) : qty;
  const shipping = productShippingFee(product, Math.max(1, totalCount), itemsTotal);
  const canBuy = !demo && saleState === "open" && !soldout && (hasOptions ? lines.length > 0 : true);
  const [going, setGoing] = useState(false);

  function toggleLine(id: string) {
    setLines((prev) => (prev.some((l) => l.optionId === id) ? prev.filter((l) => l.optionId !== id) : [...prev, { optionId: id, qty: 1 }]));
  }
  function setLineQty(id: string, q: number) {
    setLines((prev) => prev.map((l) => (l.optionId === id ? { ...l, qty: Math.max(1, q) } : l)));
  }

  function checkout() {
    if (!canBuy) return;
    setGoing(true);
    if (!hasOptions) {
      const p = new URLSearchParams({ quantity: String(qty) });
      if (influencerId) p.set("inf", influencerId);
      router.push(`/products/${product.id}/checkout?${p}`);
      return;
    }
    const base = {
      brand: product.brand,
      main_image: product.main_image,
      shipping_type: product.shipping_type,
      shipping_cost: product.shipping_cost,
      free_shipping_threshold: product.free_shipping_threshold,
      per_unit_shipping_cost: product.per_unit_shipping_cost ?? null,
      status: product.status,
      stock: product.stock,
      extra_price: null as number | null,
    };
    const items = lines.map((l) => {
      const o = optById(l.optionId)!;
      return {
        id: crypto.randomUUID(),
        product_id: product.id,
        name: product.name,
        price: product.price,
        ...base,
        option_id: o.id,
        option_name: o.name,
        option_value: o.value,
        extra_price: o.extra_price,
        quantity: l.qty,
      };
    });
    sessionStorage.setItem("cartCheckoutData", JSON.stringify({ items, totalAmount: itemsTotal, shippingCost: shipping, influencerId }));
    router.push("/cart/checkout");
  }

  // 예시 화면(demo)은 시트까지 열려 디자인을 볼 수 있고, 마지막 결제 버튼만 잠긴다
  const ctaLabel =
    saleState === "upcoming" ? "오픈 예정"
    : saleState === "ended" ? "특가 종료"
    : soldout ? "품절"
    : "구매하기";

  const socialPill =
    stats.rebuyers >= 3 ? `최근 3개월간 ${stats.rebuyers.toLocaleString()}명이 재구매했어요`
    : stats.buyers >= 10 ? `${stats.buyers.toLocaleString()}명이 구매했어요`
    : stats.sold >= 10 ? `누적 ${stats.sold.toLocaleString()}개 판매` : "";

  const infoRows: [string, string][] = [
    ["판매처", product.brand || "산지픽"],
    ...(product.origin ? [["원산지", product.origin] as [string, string]] : []),
    ["배송", shippingLabel(product)],
    ["출고", "산지에서 바로 발송"],
    ...(product.sale_end_at ? [["판매기간", `${fmtDate(product.sale_end_at)} 까지`] as [string, string]] : []),
    ["운영", "블랜드펀치 (BLEND PUNCH)"],
    ["문의", "카카오톡 채널 산지픽"],
  ];

  return (
    <div className="sp">
      <style>{`
        .sp{position:relative;max-width:480px;margin:0 auto;background:${CREAM};min-height:100svh;font-family:'Noto Sans KR',-apple-system,sans-serif;color:${INK};letter-spacing:-.01em;padding-bottom:132px}
        .sp *{box-sizing:border-box}
        .sp button{font-family:inherit;cursor:pointer}
        .sp-top{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;justify-content:space-between;align-items:center;padding:12px 14px}
        .sp-brand{display:inline-flex;align-items:center;gap:7px;background:rgba(251,248,241,.92);color:${GREEN};font-weight:900;font-size:13px;padding:4px 12px 4px 4px;border-radius:999px;backdrop-filter:blur(6px);text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.15)}
        .sp-brand img{width:26px;height:26px;border-radius:50%;display:block}
        .sp-icons{display:flex;gap:8px}
        .sp-icon{width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.45);border:0;color:#fff;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)}
        .sp-slider{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;aspect-ratio:1/1;background:#E9E4D6}
        .sp-slider::-webkit-scrollbar{display:none}
        .sp-slide{flex:0 0 100%;scroll-snap-align:start;width:100%;height:100%;object-fit:cover;display:block}
        .sp-slider-wrap{position:relative}
        .sp-count{position:absolute;right:14px;bottom:14px;background:rgba(0,0,0,.55);color:#fff;font-size:12px;font-weight:500;padding:4px 10px;border-radius:999px;font-variant-numeric:tabular-nums}
        .sp-pill{position:absolute;left:14px;bottom:14px;display:inline-flex;align-items:center;gap:6px;background:#fff;color:${INK};font-size:12px;font-weight:700;padding:7px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.18)}
        .sp-pill::before{content:"";width:8px;height:8px;border-radius:50%;background:${GREEN};box-shadow:0 0 0 3px rgba(255,90,31,.2)}
        .sp-deal{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#E7EFE3;color:${GREEN};font-size:13px;font-weight:700}
        .sp-deal b{font-weight:900}
        .sp-deal .t{font-variant-numeric:tabular-nums;font-weight:600;color:#4E6B50}
        .sp-dealbar{height:4px;background:#D3E1CD}
        .sp-dealbar i{display:block;height:100%;background:linear-gradient(90deg,${GREEN},#6FA36B)}
        .sp-head{padding:18px 16px 6px}
        .sp-brandline{font-size:12px;color:${MUTED};font-weight:500;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
        .sp-title{font-size:19px;font-weight:700;line-height:1.35;margin:0;word-break:keep-all}
        .sp-rating{display:flex;align-items:center;gap:6px;font-size:12px;color:#555;margin-top:8px}
        .sp-rating b{color:${INK}}
        .sp-price{display:flex;align-items:baseline;gap:8px;margin-top:12px;font-variant-numeric:tabular-nums}
        .sp-price .rate{color:${GREEN};font-size:22px;font-weight:900}
        .sp-price .now{font-size:24px;font-weight:900}
        .sp-price .was{font-size:14px;color:${MUTED};text-decoration:line-through}
        .sp-ship{display:flex;align-items:center;gap:8px;margin:12px 0 2px;padding:12px 0 16px;border-top:1px solid ${LINE};font-size:13px;color:#444}
        .sp-ship .k{color:${MUTED};min-width:44px}
        .sp-band{height:8px;background:${BAND}}
        .sp-tabs{position:sticky;top:0;z-index:6;display:grid;grid-template-columns:repeat(3,1fr);background:${CREAM};border-bottom:1px solid ${LINE}}
        .sp-tabs button{height:46px;border:0;background:none;font-size:14px;font-weight:600;color:${MUTED};position:relative}
        .sp-tabs button.on{color:${INK}}
        .sp-tabs button.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:${INK}}
        .sp-sec{padding:20px 16px}
        .sp-sec h3{font-size:15px;font-weight:700;margin:0 0 12px}
        .sp-desc{position:relative;overflow:hidden;transition:max-height .3s}
        .sp-desc.clamp{max-height:720px}
        .sp-desc.clamp::after{content:"";position:absolute;left:0;right:0;bottom:0;height:120px;background:linear-gradient(180deg,rgba(251,248,241,0),${CREAM})}
        .sp-desc img{display:block;max-width:100%;height:auto;margin:0 auto}
        .sp-desc .html{font-size:14px;line-height:1.7;color:#333}
        .sp-desc .html img{margin:8px auto}
        .sp-more{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:48px;margin-top:12px;border:1px solid #CFD8CC;border-radius:8px;background:#fff;font-size:14px;font-weight:600;color:${INK}}
        .sp-empty{padding:36px 0;text-align:center;color:${MUTED};font-size:13px;line-height:1.7}
        .sp-info{width:100%;border-collapse:collapse;font-size:13px}
        .sp-info th{width:84px;text-align:left;font-weight:500;color:${MUTED};padding:9px 0;border-bottom:1px solid ${LINE};vertical-align:top}
        .sp-info td{padding:9px 0;border-bottom:1px solid ${LINE};color:#333;line-height:1.5}
        .sp-row{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding:0 16px 4px;margin:0 -16px}
        .sp-row::-webkit-scrollbar{display:none}
        .sp-card{flex:0 0 132px;text-decoration:none;color:inherit}
        .sp-card .th{width:132px;height:132px;border-radius:10px;overflow:hidden;background:#f3f1ec;position:relative}
        .sp-card .th img{width:100%;height:100%;object-fit:cover;display:block}
        .sp-card .so{position:absolute;inset:0;background:rgba(0,0,0,.4);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
        .sp-card .nm{font-size:12px;line-height:1.4;margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#333}
        .sp-card .pr{margin-top:4px;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
        .sp-card .pr em{font-style:normal;color:${GREEN};margin-right:4px}
        .sp-rvsum{display:flex;align-items:center;gap:12px;padding:12px 14px;background:${BAND};border-radius:10px;margin-bottom:14px}
        .sp-rvsum .big{font-size:26px;font-weight:900;font-variant-numeric:tabular-nums}
        .sp-rvsum .sub{font-size:12px;color:${MUTED}}
        .sp-rv{padding:14px 0;border-bottom:1px solid ${LINE}}
        .sp-rv .who{display:flex;align-items:center;gap:8px}
        .sp-rv .av{width:30px;height:30px;border-radius:50%;background:#DCEBD6;color:${GREEN};font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
        .sp-rv .nm{font-size:13px;font-weight:600}
        .sp-rv .dt{font-size:11px;color:${MUTED};margin-left:auto}
        .sp-rv .opt{font-size:11px;color:${MUTED};margin-top:6px}
        .sp-rv .tx{font-size:13px;line-height:1.65;color:#333;margin-top:6px;white-space:pre-line;word-break:break-word}
        .sp-rv .ph{display:flex;gap:6px;margin-top:8px}
        .sp-rv .ph img{width:72px;height:72px;object-fit:cover;border-radius:6px;background:#eee}
        .sp-bottom{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:480px;z-index:20;background:${CREAM};box-shadow:0 -6px 24px rgba(0,0,0,.08)}
        .sp-urg{display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:#E7EFE3;font-size:12px;font-weight:700;color:${GREEN}}
        .sp-urg span:last-child{color:#4E6B50;font-weight:600;font-variant-numeric:tabular-nums}
        .sp-btns{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
        .sp-gift{flex:0 0 112px;height:52px;border-radius:10px;border:1.5px solid ${GREEN};background:#fff;font-size:15px;font-weight:700;color:${GREEN}}
        .sp-buy{flex:1;height:52px;border-radius:10px;border:0;background:${GREEN};color:#fff;font-size:16px;font-weight:800}
        .sp-buy:disabled,.sp-gift:disabled{background:#DDD;color:#999;border-color:#DDD;cursor:not-allowed}
        .sp-dim{position:fixed;inset:0;z-index:30;background:rgba(0,0,0,.45)}
        .sp-sheet{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:480px;z-index:31;background:${CREAM};border-radius:18px 18px 0 0;padding:10px 16px calc(12px + env(safe-area-inset-bottom));max-height:82svh;overflow:auto;animation:sp-up .22s ease-out}
        .sp-sheet .grip{width:40px;height:4px;border-radius:2px;background:#DDD;margin:0 auto 14px}
        .sp-sheet h4{font-size:15px;font-weight:700;margin:0 0 10px}
        .sp-opt{display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 14px;margin-bottom:8px;border:1.5px solid ${LINE};border-radius:10px;background:#fff;font-size:14px;text-align:left}
        .sp-opt.on{border-color:${GREEN};background:#F1F6EE}
        .sp-opt.dead{color:#B5B5B5;text-decoration:line-through}
        .sp-opt .p{font-weight:700;font-variant-numeric:tabular-nums}
        .sp-line{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:8px;background:${BAND};border-radius:10px;font-size:13px}
        .sp-step{display:inline-flex;align-items:center;border:1px solid #D9D9D9;border-radius:8px;background:#fff;overflow:hidden}
        .sp-step button{width:34px;height:34px;border:0;background:none;font-size:18px;color:#555}
        .sp-step span{width:36px;text-align:center;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
        .sp-total{display:flex;justify-content:space-between;align-items:baseline;padding:14px 0 10px;border-top:1px solid ${LINE};margin-top:6px;font-size:13px;color:#555}
        .sp-total b{font-size:20px;color:${INK};font-variant-numeric:tabular-nums}
        .sp-note{font-size:12px;color:${MUTED};margin:0 0 10px;line-height:1.5}
        .sp-toast{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:40;background:rgba(0,0,0,.8);color:#fff;font-size:13px;padding:10px 16px;border-radius:999px;white-space:nowrap}
        .sp-lb{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;padding:20px}
        .sp-lb img{max-width:100%;max-height:100%;object-fit:contain}
        @keyframes sp-up{from{transform:translate(-50%,40px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
      `}</style>

      {/* 상단 슬라이드 */}
      <div className="sp-slider-wrap">
        <div className="sp-top">
          <a className="sp-brand" href={linkBase || "/"}><img src="/sanji/logo.png" alt="" />산지픽</a>
          <div className="sp-icons">
            <button className="sp-icon" onClick={share} aria-label="공유">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
            </button>
            <a className="sp-icon" href="/cart" aria-label="장바구니">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.9a2 2 0 002-1.6L22 7H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/></svg>
            </a>
          </div>
        </div>
        <div className="sp-slider" ref={sliderRef} onScroll={onSlideScroll}>
          {slides.map((src, i) => (
            <Img key={i} src={src} alt={`${product.name} ${i + 1}`} className="sp-slide" />
          ))}
        </div>
        {slides.length > 1 && <span className="sp-count">{slide + 1}/{slides.length}</span>}
        {socialPill && <span className="sp-pill">{socialPill}</span>}
        {(soldout || saleState === "ended") && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 900, letterSpacing: ".02em" }}>
            {saleState === "ended" ? "특가 종료" : "품절"}
          </div>
        )}
      </div>

      {/* 한정특가 잔여 */}
      {saleState === "open" && !soldout && (
        <>
          <div className="sp-deal">
            <span>한정특가 · <b>{product.stock.toLocaleString()}개</b> 남음</span>
            {endLeft ? <span className="t">종료까지 {endLeft}</span> : <span className="t">수확분 소진 시 마감</span>}
          </div>
          <div className="sp-dealbar"><i style={{ width: `${Math.round(soldRatio * 100)}%` }} /></div>
        </>
      )}
      {saleState === "upcoming" && (
        <div className="sp-deal"><span>오픈 예정</span><span className="t">{product.sale_start_at ? fmtDate(product.sale_start_at) + " 오픈" : ""}</span></div>
      )}

      {/* 제목·가격 */}
      <div className="sp-head">
        <div className="sp-brandline">
          <span>{product.brand || "산지픽"} · 산지 직송</span>
        </div>
        <h1 className="sp-title">{product.name}</h1>
        <div className="sp-rating">
          <Stars n={reviews.total ? reviews.average : product.trust ? product.trust.rating : 5} />
          {reviews.total ? (
            <span><b>{reviews.average.toFixed(1)}</b> · 후기 {reviews.total.toLocaleString()}개</span>
          ) : product.trust ? (
            <span><b>{product.trust.rating.toFixed(2)}</b> · {product.trust.source} 리뷰 {product.trust.count.toLocaleString()}건</span>
          ) : (
            <span style={{ color: MUTED }}>첫 후기를 기다리고 있어요</span>
          )}
        </div>
        <div className="sp-price">
          {discount && <span className="rate">{discount}%</span>}
          <span className="now">{won(product.price)}</span>
          {product.original_price && product.original_price > product.price && <span className="was">{won(product.original_price)}</span>}
        </div>
        <div className="sp-ship">
          <span className="k">배송</span>
          <span>{shippingLabel(product)} · 산지 직송</span>
        </div>
      </div>

      <div className="sp-band" />

      {/* 탭 */}
      <div className="sp-tabs">
        {TABS.map((t, i) => (
          <button key={t.label} className={tab === i ? "on" : ""} onClick={() => goTab(i)}>{t.label}</button>
        ))}
      </div>

      {/* 상품설명 */}
      <div className="sp-sec" ref={descRef}>
        {product.description || images.length > 1 ? (
          <>
            <div className={`sp-desc${descOpen ? "" : " clamp"}`}>
              {product.description && <div className="html" dangerouslySetInnerHTML={{ __html: product.description }} />}
              {images.slice(1).map((src, i) => (
                <Img key={i} src={src} alt={`상세 ${i + 1}`} style={{ width: "100%", display: "block" }} />
              ))}
            </div>
            {!descOpen && (
              <button className="sp-more" onClick={() => setDescOpen(true)}>
                상품설명 더보기
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
            )}
          </>
        ) : (
          <div className="sp-empty">상세 이미지·설명을 준비 중이에요.<br />상품 관리에서 상세 이미지를 올리면 여기에 표시됩니다.</div>
        )}
      </div>

      <div className="sp-band" />

      {/* 상품정보 */}
      <div className="sp-sec" ref={infoRef}>
        <h3>상품정보</h3>
        <table className="sp-info">
          <tbody>
            {infoRows.map(([k, v]) => (
              <tr key={k}><th>{k}</th><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 함께 본 상품 */}
      {others.length > 0 && (
        <>
          <div className="sp-band" />
          <div className="sp-sec">
            <h3>다른 고객이 함께 본 상품</h3>
            <div className="sp-row">
              {others.map((p) => {
                const d = p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0;
                const so = p.status === "soldout" || p.stock === 0;
                return (
                  <a key={p.id} className="sp-card" href={`${linkBase}/p/${p.id}`}>
                    <div className="th">
                      <Img src={p.main_image} alt={p.name} />
                      {so && <span className="so">품절</span>}
                    </div>
                    <div className="nm">{p.name}</div>
                    <div className="pr">{d > 0 && <em>{d}%</em>}{won(p.price)}</div>
                  </a>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="sp-band" />

      {/* 후기 */}
      <div className="sp-sec" ref={reviewRef}>
        <h3>상품후기 {reviews.total > 0 && <span style={{ color: MUTED, fontWeight: 500 }}>({reviews.total.toLocaleString()})</span>}</h3>
        {reviews.total > 0 ? (
          <>
            <div className="sp-rvsum">
              <span className="big">{reviews.average.toFixed(1)}</span>
              <div>
                <Stars n={reviews.average} size={14} />
                <div className="sub">후기 {reviews.total.toLocaleString()}개 기준</div>
              </div>
            </div>
            {reviews.list.slice(0, shownReviews).map((r) => (
              <div className="sp-rv" key={r.id}>
                <div className="who">
                  <span className="av">{(r.buyer_name || "고")[0]}</span>
                  <div>
                    <div className="nm">{maskName(r.buyer_name || "고객")}</div>
                    <Stars n={r.rating} size={11} />
                  </div>
                  <span className="dt">{fmtDate(r.created_at)}</span>
                </div>
                {r.option_label && <div className="opt">옵션 · {r.option_label}</div>}
                <div className="tx">{r.content}</div>
                {r.images && r.images.length > 0 && (
                  <div className="ph">
                    {r.images.slice(0, 4).map((src, i) => (
                      <img key={i} src={src} alt="" onClick={() => setLightbox(src)} loading="lazy" />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {shownReviews < reviews.list.length && (
              <button className="sp-more" onClick={() => setShownReviews((n) => n + 5)}>후기 더보기</button>
            )}
          </>
        ) : (
          <div className="sp-empty">
            {product.trust ? <>{product.trust.source}에서 <b style={{ color: INK }}>★ {product.trust.rating.toFixed(2)} · 리뷰 {product.trust.count.toLocaleString()}건</b>을 받은 상품이에요.<br /></> : null}
            산지픽 첫 후기를 기다리고 있어요. 구매 후 마이페이지에서 남길 수 있습니다.
          </div>
        )}
      </div>

      <div className="sp-sec" style={{ paddingTop: 0 }}>
        <a href={kakaoUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 10, background: "#FEE500", color: "#191600", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#191600", display: "inline-block" }} />
          카카오톡으로 문의하기
        </a>
      </div>

      {/* 하단 고정 구매바 */}
      <div className="sp-bottom">
        {saleState === "open" && !soldout && !demo && (priceGap > 0 || product.stock > 0) && (
          <div className="sp-urg">
            <span>{priceGap > 0 ? `특가 종료 후 ${won(priceGap)} 비싸져요` : "산지 직송 특가 진행 중"}</span>
            <span>{endLeft ? `종료까지 ${endLeft}` : `종료까지 ${product.stock.toLocaleString()}개 남음`}</span>
          </div>
        )}
        {demo && <div className="sp-urg"><span>오픈 준비 중이에요 · 곧 구매하실 수 있어요</span></div>}
        <div className="sp-btns">
          <button className="sp-gift" disabled={saleState !== "open" || soldout} onClick={() => setSheet("gift")}>선물하기</button>
          <button className="sp-buy" disabled={saleState !== "open" || soldout} onClick={() => setSheet("buy")}>{ctaLabel}</button>
        </div>
      </div>

      {/* 구매 시트 */}
      {sheet && (
        <>
          <div className="sp-dim" onClick={() => setSheet(null)} />
          <div className="sp-sheet" role="dialog" aria-modal>
            <div className="grip" />
            <h4>{sheet === "gift" ? "선물하기" : "구매하기"}</h4>
            {sheet === "gift" && <p className="sp-note">결제 단계에서 받는 분 이름·주소를 입력하면 그 주소로 바로 보내드려요.</p>}
            {hasOptions ? (
              <>
                {options.map((o) => {
                  const on = lines.some((l) => l.optionId === o.id);
                  const dead = optDead(o);
                  return (
                    <button key={o.id} className={`sp-opt${on ? " on" : ""}${dead ? " dead" : ""}`} disabled={dead} onClick={() => toggleLine(o.id)}>
                      <span>{o.value}{dead ? (o.is_active ? " · 품절" : " · 판매중지") : ""}</span>
                      <span className="p">{won(shopUnitPrice(product.price, o.extra_price, true))}</span>
                    </button>
                  );
                })}
                {lines.map((l) => {
                  const o = optById(l.optionId);
                  if (!o) return null;
                  return (
                    <div className="sp-line" key={l.optionId}>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.value}</span>
                      <div className="sp-step">
                        <button onClick={() => setLineQty(l.optionId, l.qty - 1)} aria-label="수량 줄이기">−</button>
                        <span>{l.qty}</span>
                        <button onClick={() => setLineQty(l.optionId, l.qty + 1)} aria-label="수량 늘리기">+</button>
                      </div>
                    </div>
                  );
                })}
                {lines.length === 0 && <p className="sp-note">옵션을 선택해 주세요.</p>}
              </>
            ) : (
              <div className="sp-line">
                <span>{product.name}</span>
                <div className="sp-step">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="수량 줄이기">−</button>
                  <span>{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)} aria-label="수량 늘리기">+</button>
                </div>
              </div>
            )}
            <div className="sp-total">
              <span>총 {totalCount}개{shipping > 0 ? ` · 배송비 ${won(shipping)}` : " · 무료배송"}</span>
              <b>{won(itemsTotal + shipping)}</b>
            </div>
            <button className="sp-buy" style={{ width: "100%" }} disabled={!canBuy || going} onClick={checkout}>
              {demo ? "오픈 준비 중" : going ? "이동 중..." : sheet === "gift" ? "선물 결제하기" : "바로 구매하기"}
            </button>
          </div>
        </>
      )}

      {toast && <div className="sp-toast">{toast}</div>}
      {lightbox && (
        <div className="sp-lb" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="후기 사진" />
        </div>
      )}
    </div>
  );
}
