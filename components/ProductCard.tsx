import Link from "next/link";
import FallbackImg from "@/components/FallbackImg";

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
}

export default function ProductCard({ product }: { product: Product }) {
  const hasDiscount = product.groupbuy_price > 0 && product.groupbuy_price < product.consumer_price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.groupbuy_price / product.consumer_price) * 100)
    : 0;

  return (
    <Link href={`/campaigns/${product.id}`} className="group block">
      {/* 이미지 */}
      <div
        className="aspect-square overflow-hidden mb-3 rounded-2xl"
        style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}
      >
        <FallbackImg
          src={product.product_image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
        />
      </div>

      {/* 정보 */}
      <p className="text-[11px] font-medium tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
        {product.brand}
      </p>
      <p
        className="text-sm leading-snug line-clamp-2 mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        {product.name}
      </p>

      {hasDiscount ? (
        <div className="flex items-baseline gap-1.5 tnum">
          <span className="font-extrabold text-[15px]" style={{ color: "var(--sale)" }}>
            {discountRate}%
          </span>
          <span className="font-extrabold text-[15px]" style={{ color: "var(--text-primary)" }}>
            {product.groupbuy_price.toLocaleString()}원
          </span>
          <span className="text-xs line-through" style={{ color: "var(--text-muted)" }}>
            {product.consumer_price.toLocaleString()}원
          </span>
        </div>
      ) : (
        <p className="font-extrabold text-[15px] tnum" style={{ color: "var(--text-primary)" }}>
          {product.consumer_price.toLocaleString()}원
        </p>
      )}
    </Link>
  );
}
