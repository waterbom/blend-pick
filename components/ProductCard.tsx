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
      <div className="aspect-square bg-gray-50 overflow-hidden mb-3">
        <FallbackImg
          src={product.product_image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* 정보 */}
      <p className="text-xs text-gray-400 mb-0.5">{product.brand}</p>
      <p className="text-sm text-gray-900 leading-snug line-clamp-2 mb-1.5">{product.name}</p>

      {hasDiscount ? (
        <div>
          <span className="text-red-500 font-bold text-sm mr-1">{discountRate}%</span>
          <span className="font-bold text-sm">{product.groupbuy_price.toLocaleString()}원</span>
          <p className="text-xs text-gray-300 line-through">{product.consumer_price.toLocaleString()}원</p>
        </div>
      ) : (
        <p className="font-bold text-sm">{product.consumer_price.toLocaleString()}원</p>
      )}
    </Link>
  );
}
