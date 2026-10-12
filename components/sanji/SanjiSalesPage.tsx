"use client";

import { SANJI_IMAGE_ASPECT_RATIO, SANJI_LARGE_IMAGE_MAX_WIDTH } from "@/lib/sanji-image-layout";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { expectedShipLabel } from "@/lib/checkout-draft";
import { addGuestItems } from "@/lib/guest-cart";
import { submitCartItems } from "@/lib/buyer-flow";
import { commerceParams, trackCartAdded } from "@/lib/analytics";
import { useMetaEvent } from "@/lib/use-meta-event";
import { optionText } from "@/lib/buyer-flow";
import { LINK_PARAM } from "@/lib/secret-link";
import { productShippingFee, shippingLabel } from "@/lib/shipping";
import type { SanjiCard, SanjiOption, SanjiProduct, SanjiReview, SanjiStats } from "@/lib/sanji-data";
import SanjiIcon from "@/components/sanji/SanjiIcon";
import SanjiProductCard from "@/components/sanji/SanjiProductCard";
import SanjiProductStyles from "@/components/sanji/SanjiProductStyles";

// 모바일 장보기 화면: 사진 → 상품·가격·배송 → 구성 안내 → 설명/정보/후기.
// 구매는 블랜드픽 결제 흐름(/products/[id]/checkout, /cart/checkout)을 그대로 탄다.

const ORANGE = "#C9430E"; // 강조·할인율·주요 버튼 (흰 글자 대비 4.9:1)
const INK = "#191919";
const MUTED = "#6E6E6E";
const FAINT = "#8A8A8A";
const LINE = "#EDEDED";
const BAND = "#F4F4F4";
const SOFT = "#FFF6EF";
const TINT = "#FFF1EA";

export interface SanjiSalesProps {
  product: SanjiProduct;
  images: string[];
  options: SanjiOption[];
  recommendedOptionId?: string | null;
  reviews: { list: SanjiReview[]; total: number; average: number };
  stats: SanjiStats;
  others: SanjiCard[];
  influencerId: string | null;
  linkCode: string | null; // 비밀링크(?k=) — 서버가 상품 코드와 대조해 맞을 때만 넘어온다
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
  if (bad) return <div className={className} style={{ ...style, background: `linear-gradient(135deg,${BAND},${TINT})` }} aria-hidden />;
  return <img src={src!} alt={alt} className={className} style={style} loading="lazy" onError={() => setBad(true)} />;
}

function RecommendedBadge() {
  return <span className="sp-recommended-option">추천 구성</span>;
}

export default function SanjiSalesPage({ product, images, options, recommendedOptionId = null, reviews, stats, others, influencerId, linkCode, demo = false, kakaoUrl, linkBase }: SanjiSalesProps) {
  const router = useRouter();
  useMetaEvent("ViewContent", product.id, commerceParams([{ id: product.id, quantity: 1, price: product.price }]), !demo);
  // 판매가 — 서버에서 검증한 채널별 상품·옵션 가격을 표시
  const price = product.price;
  const unitOf = (extra: number | null | undefined) => extra ?? price;

  // ── 시간창·재고 ─────────────────────────────────────────────
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!product.sale_start_at && !product.sale_end_at && !linkCode) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [product.sale_start_at, product.sale_end_at, linkCode]);
  const startMs = product.sale_start_at ? new Date(product.sale_start_at).getTime() : null;
  const endMs = product.sale_end_at ? new Date(product.sale_end_at).getTime() : null;
  const saleState: "upcoming" | "open" | "ended" =
    startMs && startMs > nowMs ? "upcoming" : endMs && endMs <= nowMs ? "ended" : "open";
  const soldout = demo || product.status !== "active" || product.stock === 0;
  const discount =
    product.original_price && product.original_price > price
      ? Math.round((1 - price / product.original_price) * 100)
      : null;
  const priceGap = product.original_price && product.original_price > price ? product.original_price - price : 0;
  const endLeft = (() => {
    if (!endMs || saleState !== "open") return "";
    const left = endMs - nowMs;
    const d = Math.floor(left / 86400e3), h = Math.floor((left % 86400e3) / 3600e3), m = Math.floor((left % 3600e3) / 60e3), s = Math.floor((left % 60e3) / 1e3);
    return d > 0 ? `${d}일 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  // ── 슬라이드 ────────────────────────────────────────────────
  const sliderRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const onSlideScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    if (el.clientWidth) setSlide(Math.max(0, Math.min((images.length || 1) - 1, Math.round(el.scrollLeft / el.clientWidth))));
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
    const top = el.getBoundingClientRect().top + window.scrollY - 116; // 고정 헤더 + 탭 높이
    window.scrollTo({ top, behavior: "smooth" });
  };
  useEffect(() => {
    // 스크롤 위치에 따라 활성 탭 동기화
    const onScroll = () => {
      const y = window.scrollY + 124;
      let i = 0;
      TABS.forEach((t, idx) => {
        const el = t.ref.current;
        if (el && el.getBoundingClientRect().top + window.scrollY <= y) i = idx;
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
  const lightboxRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = lightboxRef.current;
    if (!lightbox || !dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [lightbox]);
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
  const recommendedOption = demo ? null : recommendedOptionId;
  const itemsTotal = hasOptions
    ? lines.reduce((s, l) => s + unitOf(optById(l.optionId)?.extra_price) * l.qty, 0)
    : price * qty;
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

  const [cartBusy,setCartBusy] = useState(false);
  async function addToCart(){
    if(!canBuy||cartBusy||linkCode)return;
    setCartBusy(true);
    try{
      const selections=hasOptions?lines.map(l=>({option_id:l.optionId,quantity:l.qty})):[{option_id:null,quantity:qty}];
      const payloads=selections.map(i=>({product_id:product.id,...i}));
      const result=await submitCartItems(payloads,body=>fetch('/api/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
      trackCartAdded(payloads.slice(0,result.completed),product,options);
      if(result.unauthorized){addGuestItems('sanjipick',payloads.slice(result.completed).map(i=>{const o=options.find(o=>o.id===i.option_id);return {...product,...i,option_name:o?.name||null,option_value:o?.value||null,extra_price:o?.extra_price??null};}));trackCartAdded(payloads.slice(result.completed),product,options);}
      else if(result.error){if(result.completed)setLines(prev=>prev.slice(result.completed));flash(result.error);return;}
      window.dispatchEvent(new Event('cart-change'));setSheet(null);flash('장바구니에 담았습니다. 상단 장바구니에서 확인해주세요.');
    }catch{flash('장바구니 저장에 실패했습니다. 바로 구매를 이용해주세요.');}
    finally{setCartBusy(false);}
  }

  function checkout() {
    if (!canBuy || (linkCode && (!product.link_end_at || Date.now() >= new Date(product.link_end_at).getTime()))) return;
    setGoing(true);
    if (!hasOptions) {
      const p = new URLSearchParams({ quantity: String(qty) });
      if (influencerId) p.set("inf", influencerId);
      if (linkCode) p.set(LINK_PARAM, linkCode); // 결제 화면·승인 검증이 같은 코드로 링크가를 다시 계산
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
        price,
        ...base,
        option_id: o.id,
        option_name: o.name,
        option_value: o.value,
        extra_price: unitOf(o.extra_price), // 서버에서 확인한 비전시 옵션 단가 (결제 화면 표시용 — 승인 전 서버가 DB로 재계산)
        quantity: l.qty,
        link_code: linkCode,
      };
    });
    sessionStorage.setItem("cartCheckoutData", JSON.stringify({ fromCart:false, items, totalAmount: itemsTotal, shippingCost: shipping, influencerId, linkCode }));
    router.push("/cart/checkout");
  }

  // 미등록 예시 상품은 구매·선물 선택 창부터 닫는다.
  const ctaLabel =
    saleState === "ended" || product.status === "ended" ? "공구 마감"
    : soldout ? "재고 마감"
    : saleState === "upcoming" ? "오픈 예정"
    : "구매하기";

  const socialPill =
    stats.rebuyers >= 3 ? `석 달 새 ${stats.rebuyers.toLocaleString()}명이 다시 주문했어요`
    : stats.buyers >= 10 ? `${stats.buyers.toLocaleString()}명이 받아보셨어요`
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

  if (linkCode && (!product.link_end_at || nowMs >= new Date(product.link_end_at).getTime())) return <main className="min-h-screen grid place-items-center"><h1>잘못된 요청입니다</h1></main>;
  return (
    <div className="sp">
      <SanjiProductStyles />
      <style>{`
        .sp{position:relative;width:100%;max-width:480px;margin:0 auto;background:#fff;min-height:100svh;font-family:inherit;color:${INK};letter-spacing:-.02em;padding-bottom:90px}
        .sp *{box-sizing:border-box}
        .sp button{font-family:inherit;cursor:pointer}
        .sp :focus-visible{outline:2px solid ${ORANGE};outline-offset:2px}
        .sp-slider{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;align-items:stretch;width:100%;aspect-ratio:${SANJI_IMAGE_ASPECT_RATIO};background:${BAND}}
        .sp-slider::-webkit-scrollbar{display:none}
        .sp-slide{position:relative;flex:0 0 100%;scroll-snap-align:start;width:100%;min-width:0;min-height:0;overflow:hidden;border:0;padding:0;background:none;cursor:zoom-in}
        .sp-slide>img,.sp-slide>div{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;object-position:center}
        .sp-slide:focus-visible{outline:2px solid ${ORANGE};outline-offset:-4px}
        .sp-count{position:absolute;right:14px;bottom:14px;z-index:2;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:500;padding:3px 10px;border-radius:999px;font-variant-numeric:tabular-nums;pointer-events:none}
        .sp-slider-wrap{position:relative;width:100%;max-width:${SANJI_LARGE_IMAGE_MAX_WIDTH};margin:0 auto}
        .sp-pill{display:flex;align-items:center;gap:5px;margin-top:12px;color:${ORANGE};font-size:12px;font-weight:600;line-height:1.5}
        .sp-deal{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:38px;padding:8px 16px;background:${SOFT};color:${ORANGE};font-size:12px;font-weight:600}
        .sp-deal b{font-weight:700}
        .sp-deal .t{font-variant-numeric:tabular-nums;font-weight:700;font-size:13px;white-space:nowrap}
        .sp-deal.soon{background:#edf2f5;color:#4c6472}
        .sp-deal.closed{background:#8e3037;color:#fff}
        .sp-closed-cover{position:absolute;inset:0;background:#27141b80;pointer-events:none;display:grid;place-items:center;color:#fff;font-size:21px;font-weight:700}
        .sp-head{padding:18px 16px 0}
        .sp-brandline{position:relative;min-height:28px;padding-right:44px;font-size:12px;color:${MUTED};font-weight:500;margin-bottom:7px;display:flex;align-items:center;gap:6px}
        .sp-brandline i{height:10px;border-left:1px solid #ddd}
        .sp-share{position:absolute;right:-6px;top:-8px;width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;background:#fff;color:${INK}}
        .sp-title{font-size:20px;font-weight:600;line-height:1.45;margin:0;word-break:keep-all;letter-spacing:-.03em}
        .sp-rating{display:flex;align-items:center;gap:6px;font-size:12px;color:${MUTED};margin-top:9px}
        .sp-rating button{display:flex;align-items:center;gap:6px;border:0;padding:0;background:none;color:inherit;font:inherit}
        .sp-rating .review-link{text-decoration:underline;text-underline-offset:3px}
        .sp-rating b{color:${INK}}
        .sp-deal-chip{display:flex;align-items:center;gap:7px;margin-top:20px}
        .sp-deal-chip>span{font-size:11px;font-weight:600;color:${ORANGE}}
        .sp-deal-chip .was{font-size:13px;color:${FAINT};text-decoration:line-through;font-variant-numeric:tabular-nums}
        .sp-price{display:flex;align-items:baseline;gap:8px;margin-top:4px;font-variant-numeric:tabular-nums}
        .sp-price .rate{color:${ORANGE};font-size:28px;font-weight:700;letter-spacing:-.03em}
        .sp-price .now{font-size:28px;font-weight:700;letter-spacing:-.03em}
        .sp-save{margin-top:5px;font-size:12px;font-weight:600;color:${ORANGE}}
        .sp-option-guide{padding:20px 16px;font-size:13px;line-height:1.6;color:#555}
        .sp-option-guide h2{margin:0;font-size:17px;font-weight:700;color:${INK}}
        .sp-option-guide>p{margin:6px 0 14px;font-size:12px;color:${MUTED}}
        .sp-option-row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid ${LINE};padding:12px 0;align-items:flex-start}
        .sp-option-row:last-child{padding-bottom:0}
        .sp-option-row>strong{flex-shrink:0;font-size:14px;color:${INK};white-space:nowrap}
        .sp-option-name{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;min-width:0;overflow-wrap:anywhere}
        .sp-recommended-option{display:inline-flex;max-width:100%;padding:2px 5px;border-radius:3px;background:${SOFT};color:${ORANGE};font-size:11px;line-height:1.4;font-weight:700;letter-spacing:-.02em}
        .sp-linkpill{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:5px 10px;border-radius:999px;background:${TINT};color:${ORANGE};font-size:12px;font-weight:700}
        .sp-infobox{display:grid;grid-template-columns:52px minmax(0,1fr);row-gap:10px;margin:18px 0 0;padding:18px 0 20px;border-top:1px solid ${LINE};font-size:13px;line-height:1.6}
        .sp-infobox .k{color:${MUTED}}
        .sp-band{height:8px;background:${BAND}}
        .sp-tabs{position:sticky;top:58px;z-index:25;display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border-bottom:1px solid ${LINE}}
        .sp-tabs button{height:48px;border:0;background:none;font-size:14px;font-weight:600;color:${FAINT};position:relative}
        .sp-tabs button.on{color:${ORANGE}}
        .sp-tabs button.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:${ORANGE}}
        .sp-sec{padding:22px 16px;scroll-margin-top:116px}
        .sp-sec h3{font-size:17px;font-weight:700;margin:0 0 14px;letter-spacing:-.03em}
        .sp-desc{position:relative;overflow:hidden;transition:max-height .3s}
        .sp-desc.clamp{max-height:720px}
        .sp-desc.clamp::after{content:"";position:absolute;left:0;right:0;bottom:0;height:120px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff)}
        .sp-desc img{display:block;max-width:100%;height:auto;margin:0 auto}
        .sp-desc .html{font-size:14px;line-height:1.7;color:#333}
        .sp-desc .html img{margin:8px auto}
        .sp-more{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:50px;margin-top:12px;border:1px solid #DADADA;border-radius:6px;background:#fff;font-size:14px;font-weight:600;color:${INK}}
        .sp-more:hover{border-color:${INK}}
        .sp-empty{padding:32px 16px;text-align:center;color:${MUTED};font-size:13px;line-height:1.7;background:#fafafa;border-radius:4px}
        .sp-info{width:100%;border-collapse:collapse;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};font-size:13px}
        .sp-info th{width:82px;text-align:left;font-weight:500;color:${MUTED};padding:12px 10px;background:#fafafa;border-bottom:1px solid ${LINE};vertical-align:top}
        .sp-info td{padding:12px 10px;border-bottom:1px solid ${LINE};color:${INK};line-height:1.6;overflow-wrap:anywhere}
        .sp-info tr:last-child>*{border-bottom:0}
        .sp-rvsum{display:flex;align-items:center;gap:12px;padding:16px 0;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};margin-bottom:4px}
        .sp-rvsum .big{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}
        .sp-rvsum .sub{font-size:12px;color:${MUTED}}
        .sp-rv{padding:16px 0;border-bottom:1px solid ${LINE}}
        .sp-rv .who{display:flex;align-items:center;gap:8px}
        .sp-rv .av{width:32px;height:32px;border-radius:50%;background:${TINT};color:${ORANGE};font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
        .sp-rv .nm{font-size:13px;font-weight:600}
        .sp-rv .dt{font-size:12px;color:${FAINT};margin-left:auto}
        .sp-rv .opt{font-size:12px;color:${MUTED};margin-top:8px}
        .sp-rv .tx{font-size:14px;line-height:1.6;color:${INK};margin-top:6px;white-space:pre-line;word-break:break-word}
        .sp-rv .ph{display:flex;gap:6px;margin-top:10px}
        .sp-rv .ph img{width:76px;height:auto;aspect-ratio:${SANJI_IMAGE_ASPECT_RATIO};padding:4px;object-fit:contain;object-position:center;border-radius:8px;background:${BAND};cursor:zoom-in}
        .sp-kakao{display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:6px;background:#FEE500;color:#191600;font-size:14px;font-weight:700;text-decoration:none}
        .sp-bottom{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:480px;z-index:40;background:#fff;border-top:1px solid ${LINE};box-shadow:0 -2px 12px rgba(0,0,0,.03)}
        .sp-home{flex:0 0 40px;display:flex;align-items:center;justify-content:center;color:${INK};text-decoration:none}
        .sp-btns{display:flex;gap:8px;padding:10px 16px calc(10px + env(safe-area-inset-bottom))}
        .sp-gift{flex:0 0 88px;height:48px;border-radius:6px;border:1px solid #ddd;background:#fff;font-size:15px;font-weight:700;color:${INK}}
        .sp-buy{flex:1;height:48px;border-radius:6px;border:0;background:${ORANGE};color:#fff;font-size:16px;font-weight:700;transition:background .15s}
        .sp-buy:hover:not(:disabled){background:#A8370B}
        .sp-buy:disabled,.sp-gift:disabled{background:#E3E3E3;color:#767676;border-color:#E3E3E3;cursor:not-allowed}
        .sp-bottom[data-sale="closed"] .sp-buy:disabled{background:#8e3037;color:#fff}
        .sp-dim{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.5)}
        .sp-sheet{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:480px;z-index:81;background:#fff;border-radius:14px 14px 0 0;padding:12px 18px calc(14px + env(safe-area-inset-bottom));max-height:82svh;overflow:auto;animation:sp-up .22s ease-out}
        .sp-sheet .grip{width:40px;height:4px;border-radius:2px;background:#DADADA;margin:0 auto 14px}
        .sp-sheet-close{position:absolute;right:14px;top:12px;display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:50%;background:${BAND};color:${INK};font-size:22px}
        .sp-sheet h4{font-size:18px;font-weight:700;margin:14px 0 5px;padding-right:38px}
        .sp-sheet-product{margin:0 0 18px;padding-bottom:14px;border-bottom:1px solid ${LINE};color:${MUTED};font-size:12px;line-height:1.5}
        .sp-opt{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:12px;margin-bottom:8px;border:1px solid #ddd;border-radius:6px;background:#fff;font-size:14px;line-height:1.5;text-align:left;color:${INK}}
        .sp-opt.on{border-color:${ORANGE};background:${TINT};box-shadow:inset 0 0 0 1px ${ORANGE}}
        .sp-opt.dead{color:#B5B5B5;text-decoration:line-through}
        .sp-opt .p{flex-shrink:0;font-weight:700;font-variant-numeric:tabular-nums}
        .sp-line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;margin-bottom:8px;background:#f7f7f7;border-radius:6px;font-size:13px}
        .sp-step{display:inline-flex;flex-shrink:0;align-items:center;border:1px solid #DADADA;border-radius:4px;background:#fff;overflow:hidden}
        .sp-step button{width:36px;height:36px;border:0;background:none;font-size:18px;color:${INK}}
        .sp-step span{width:36px;text-align:center;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
        .sp-total{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:16px 0 12px;border-top:1px solid ${LINE};margin-top:8px;font-size:12px;line-height:1.6;color:${MUTED}}
        .sp-total b{flex-shrink:0;font-size:22px;color:${INK};font-variant-numeric:tabular-nums}
        .sp-cart{width:100%;height:48px;margin-bottom:8px;border:1px solid #ddd;border-radius:6px;background:#fff;color:${INK};font-size:15px;font-weight:700}
        .sp-cart:disabled{border-color:#E3E3E3;color:${FAINT};cursor:not-allowed}
        .sp-note{font-size:13px;color:${MUTED};margin:0 0 10px;line-height:1.5}
        .sp-toast{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:90;background:rgba(25,25,25,.9);color:#fff;font-size:13px;padding:10px 16px;border-radius:999px;white-space:nowrap}
        .sp-lb{position:fixed;inset:0;z-index:90;width:calc(100% - 24px);max-width:960px;height:calc(100svh - 24px);max-height:none;margin:auto;padding:0;border:0;border-radius:12px;background:#fff;color:${INK};overflow:hidden}
        .sp-lb[open]{display:flex;flex-direction:column}
        .sp-lb::backdrop{background:rgba(0,0,0,.85)}
        .sp-lb__head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;padding:8px 12px;border-bottom:1px solid ${LINE};font-size:14px}
        .sp-lb__head button{min-width:44px;min-height:44px;border:1px solid ${LINE};border-radius:10px;background:#fff;color:${INK}}
        .sp-lb__body{min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px}
        .sp-lb img{display:block;width:100%;height:auto;max-width:100%;margin:auto}
        @keyframes sp-up{from{transform:translate(-50%,40px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
        @container sanji-mobile (max-width:370px){.sp-opt{padding:12px;font-size:13px}.sp-sheet{padding:12px 14px 20px}.sp-price .rate,.sp-price .now{font-size:26px}}
        @media(prefers-reduced-motion:reduce){.sp-sheet{animation:none}.sp-desc{transition:none}}
      `}</style>

      {/* 상단 슬라이드 */}
      <div className="sp-slider-wrap">
        <div className="sp-slider" ref={sliderRef} onScroll={onSlideScroll}>
          {slides.map((src, i) => (
            <button type="button" key={`${i}-${src}`} className="sp-slide" data-active={i === slide} aria-hidden={i !== slide}
              tabIndex={i === slide ? 0 : -1} disabled={!src} onClick={() => setLightbox(src)} aria-label={`${product.name} 사진 ${i + 1} 크게 보기`}>
              <Img src={src} alt={`${product.name} ${i + 1}`} />
            </button>
          ))}
        </div>
        {images.length > 1 && <span className="sp-count" aria-hidden>{slide + 1} / {images.length}</span>}
        {(soldout || saleState === "ended") && (
          <div className="sp-closed-cover">
            {saleState === "ended" || product.status === "ended" ? "공구 마감" : "재고가 마감되었습니다"}
          </div>
        )}
      </div>

      {/* 공구 마감 바 — 마감 시각이 있으면 카운트다운, 없으면 남은 수량 */}
      {saleState === "open" && !soldout && (
        <div className="sp-deal">
          {endLeft ? <><span>공구 마감까지</span><span className="t">{endLeft}</span></>
            : <><span>공동구매 진행 중</span><span className="t">{product.stock > 0 ? `${product.stock.toLocaleString()}개 남음` : "수확분 소진 시 마감"}</span></>}
        </div>
      )}
      {saleState === "upcoming" && !soldout && (
        <div className="sp-deal soon"><span>오픈 예정</span><span className="t">{product.sale_start_at ? fmtDate(product.sale_start_at) + " 오픈" : ""}</span></div>
      )}
      {(saleState === "ended" || soldout) && <div className="sp-deal closed"><span>{ctaLabel}</span><span>다음 공구에서 만나요</span></div>}

      {/* 제목·가격 */}
      <div className="sp-head">
        <div className="sp-brandline"><button type="button" className="sp-share" onClick={share} aria-label="상품 공유"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M6 12H4v9h16v-9h-2"/></svg></button>
          <span>{product.brand || "산지픽"}</span><i aria-hidden="true"/><span>산지 직송</span>
        </div>
        <h1 className="sp-title">{product.name}</h1>
        {!demo && <div className="sp-rating">
          {reviews.total ? (
            <button type="button" onClick={() => goTab(2)} aria-label={`상품후기 ${reviews.total.toLocaleString()}개 보기`}><Stars n={reviews.average}/><b>{reviews.average.toFixed(1)}</b><span className="review-link">후기 {reviews.total.toLocaleString()}개</span><SanjiIcon name="chevron" size={12}/></button>
          ) : product.trust && product.trust.count > 0 ? (
            <><Stars n={product.trust.rating}/><span><b>{product.trust.rating.toFixed(2)}</b> · {product.trust.source} 리뷰 {product.trust.count.toLocaleString()}건</span></>
          ) : (
            <span>첫 후기를 기다리고 있어요</span>
          )}
        </div>}
        <div className="sp-deal-chip"><span>산지픽 공구가</span>{priceGap > 0 && <del className="was">{won(product.original_price!)}</del>}</div>
        <div className="sp-price">
          {discount && <span className="rate">{discount}%</span>}
          <span className="now">{won(price)}</span>
        </div>
        {priceGap > 0 && <div className="sp-save">정가보다 {won(priceGap)} 저렴해요</div>}
        {socialPill && <div className="sp-pill"><SanjiIcon name="user" size={14}/>{socialPill}</div>}
        {linkCode && (
          <div className="sp-linkpill">전용 링크 가격이 적용됐어요</div>
        )}
        <div className="sp-infobox">
          <span className="k">배송</span><span>{shippingLabel(product)} · 산지 직송</span>
          <span className="k">출고</span><span>{expectedShipLabel(product.expected_ship_date)}</span>
          {product.origin && <><span className="k">원산지</span><span>{product.origin}</span></>}
        </div>
      </div>

      <div className="sp-band" />

      {options.length > 0 && <>
        <section className="sp-option-guide" aria-labelledby="sp-options-title">
          <h2 id="sp-options-title">구성 한눈에 보기</h2>
          <p>옵션별 구성·등급과 가격을 확인해주세요.<br/>상품명과 사진에 여러 구성이 포함될 수 있어요. 실제 구성은 선택한 옵션 기준입니다.</p>
          {options.filter(o => o.is_active && o.stock !== 0).map(o => <div key={o.id} className="sp-option-row">
            <span className="sp-option-name"><span>{optionText(o.name, o.value)}</span>{recommendedOption === o.id && <RecommendedBadge />}</span><strong>{won(unitOf(o.extra_price))}</strong>
          </div>)}
        </section>
        <div className="sp-band" />
      </>}

      {/* 탭 */}
      <div className="sp-tabs">
        {TABS.map((t, i) => (
          <button key={t.label} className={tab === i ? "on" : ""} aria-current={tab === i ? "location" : undefined} onClick={() => goTab(i)}>{t.label}</button>
        ))}
      </div>

      {/* 상품설명 */}
      <div className="sp-sec" ref={descRef}>
        {product.description || images.length > 1 ? (
          <>
            <div className={`sp-desc${descOpen ? "" : " clamp"}`}>
              {product.description && <div className="html product-desc" dangerouslySetInnerHTML={{ __html: product.description }} />}
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
          <div className="sp-empty">상품 상세 설명을 준비하고 있어요.<br />궁금한 점은 카카오톡으로 문의해주세요.</div>
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
            {!demo && product.trust ? <>{product.trust.source}에서 <b style={{ color: INK }}>★ {product.trust.rating.toFixed(2)} · 리뷰 {product.trust.count.toLocaleString()}건</b>을 받은 상품이에요.<br /></> : null}
            산지픽 첫 후기를 기다리고 있어요. 구매 후 마이페이지에서 남길 수 있습니다.
          </div>
        )}
      </div>

      {others.length > 0 && <>
        <div className="sp-band" />
        <section className="sp-sec">
          <h3>이런 상품도 산지에서 왔어요</h3>
          <div className="sj-product-grid">{others.map(p => <SanjiProductCard key={p.id} product={p} href={`${linkBase}/p/${p.id}`} now={nowMs}/>)}</div>
        </section>
      </>}

      <div className="sp-sec" style={{ paddingTop: 0 }}>
        <a className="sp-kakao" href={kakaoUrl} target="_blank" rel="noreferrer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#191600" aria-hidden><path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7L5.6 21l4.3-2.6c.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>
          카카오톡으로 문의하기
        </a>
      </div>

      {/* 하단 고정 구매바 */}
      <div className="sp-bottom" data-sale={saleState === "ended" || soldout ? "closed" : saleState}>
        <div className="sp-btns">
          <a className="sp-home" href={linkBase || "/"} aria-label="산지픽 홈"><SanjiIcon name="home" size={24}/></a>
          <button className="sp-gift" disabled={saleState !== "open" || soldout} onClick={() => setSheet("gift")}>선물하기</button>
          <button className="sp-buy" disabled={saleState !== "open" || soldout} onClick={() => setSheet("buy")}>{ctaLabel}</button>
        </div>
      </div>

      {/* 구매 시트 */}
      {sheet && (
        <>
          <div className="sp-dim" onClick={() => setSheet(null)} />
          <div className="sp-sheet" role="dialog" aria-modal aria-label="상품 옵션 선택">
            <button className="sp-sheet-close" type="button" onClick={()=>setSheet(null)} aria-label="옵션 선택 닫기">×</button>
            <div className="grip" />
            <h4>{sheet === "gift" ? "선물하기" : "구매하기"}</h4>
            <p className="sp-sheet-product">{product.name}</p>
            {sheet === "gift" && <p className="sp-note">결제 단계에서 받는 분 이름·주소를 입력하면 그 주소로 바로 보내드려요.</p>}
            {hasOptions ? (
              <>
                {options.map((o) => {
                  const on = lines.some((l) => l.optionId === o.id);
                  const dead = optDead(o);
                  return (
                    <button key={o.id} className={`sp-opt${on ? " on" : ""}${dead ? " dead" : ""}`} disabled={dead} onClick={() => toggleLine(o.id)}>
                      <span className="sp-option-name"><span>{o.value}{dead ? (o.is_active ? " · 품절" : " · 판매중지") : ""}</span>{!dead && recommendedOption === o.id && <RecommendedBadge />}</span>
                      <span className="p">{won(unitOf(o.extra_price))}</span>
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
              <span>예상 {totalCount}개 · 지역 추가비·설치비 별도{shipping > 0 ? ` · 배송비 ${won(shipping)}` : " · 무료배송"}</span>
              <b>{won(itemsTotal + shipping)}</b>
            </div>
            {!linkCode && <button type="button" className="sp-cart" disabled={!canBuy||cartBusy} onClick={addToCart}>{cartBusy?'담는 중…':'장바구니에 담기'}</button>}
            <button className="sp-buy" style={{ width: "100%" }} disabled={!canBuy || going} onClick={checkout}>
              {demo ? "재고 마감" : going ? "이동 중..." : sheet === "gift" ? "선물 결제하기" : "바로 구매하기"}
            </button>
          </div>
        </>
      )}

      {toast && <div className="sp-toast">{toast}</div>}
      {lightbox && (
        <dialog ref={lightboxRef} className="sp-lb" aria-label="사진 크게 보기" onClose={() => setLightbox(null)}
          onClick={(event) => { if (event.target === event.currentTarget) setLightbox(null); }}>
          <div className="sp-lb__head"><span>사진 크게 보기</span><button type="button" autoFocus onClick={() => setLightbox(null)}>닫기</button></div>
          <div className="sp-lb__body"><img src={lightbox} alt="확대 사진" /></div>
        </dialog>
      )}
    </div>
  );
}
