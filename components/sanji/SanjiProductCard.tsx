"use client";

import type { SanjiCard } from "@/lib/sanji-data";
import { storefrontSale } from "@/lib/storefront-sale";
import SanjiProductImage from "@/components/sanji/SanjiProductImage";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function SanjiProductCard({ product: p, href, now, banner = false, autoPlay = false }: { product: SanjiCard; href: string; now: number; banner?: boolean; autoPlay?: boolean }) {
  const sale = storefrontSale(p, now);
  const discount = p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0;
  return <a className={`sj-product-card${sale === "closed" ? " is-closed" : ""}`} href={href} data-banner-product={banner ? p.id : undefined}>
    <div className="sj-product-image">
      <SanjiProductImage mainImage={p.main_image} images={p.images} name={p.name} autoPlay={autoPlay} eager={banner} />
      {sale === "closed" ? <span className="sj-product-status">공구 마감</span> : sale === "upcoming" ? <span className="sj-product-status upcoming">오픈 예정</span> : banner && <span className="sj-product-tag">새로 열린 공구</span>}
    </div>
    {p.brand && <span className="sj-product-brand">{p.brand}</span>}
    <span className="sj-product-name">{p.name}</span>
    <div className="sj-product-price">{discount > 0 && <em>{discount}%</em>}<strong>{won(p.price)}</strong></div>
    {discount > 0 && <del className="sj-product-original">{won(p.original_price!)}</del>}
    <span className={`sj-product-state ${sale}`}>{sale === "closed" ? "공구가 종료되었어요" : sale === "upcoming" ? "곧 만나요" : "공동구매 진행 중"}</span>
  </a>;
}
