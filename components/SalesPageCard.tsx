import Link from "next/link";
import CountdownTimer from "@/components/CountdownTimer";

interface SalesPage {
  id: string;
  product_id: string;
  title: string;
  price: number;
  original_price: number | null;
  main_image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  stock_quantity: number | null;
}

export default function SalesPageCard({ page }: { page: SalesPage }) {
  const discount = page.original_price
    ? Math.round((1 - page.price / page.original_price) * 100)
    : null;

  const isSoldOut = page.stock_quantity !== null && page.stock_quantity <= 0;
  const now = new Date();
  const start = page.starts_at ? new Date(page.starts_at) : null;
  const end = page.ends_at ? new Date(page.ends_at) : null;
  const isActive = start && end && start <= now && end >= now;
  const timerTarget = isActive ? page.ends_at : page.starts_at;
  const timerLabel = isActive ? "⏰ 종료까지" : "🚀 핫딜 오픈까지";

  return (
    <Link href={`/products/${page.product_id}`} className="block group">
      {/* 이미지 */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden mb-3">
        {page.main_image ? (
          <img
            src={page.main_image}
            alt={page.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200 text-4xl">
            📦
          </div>
        )}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-sm font-bold tracking-widest">
              sold out
            </span>
          </div>
        )}
      </div>

      {/* 타이머 */}
      {timerTarget && (
        <div className="mb-2">
          <CountdownTimer target={timerTarget} label={timerLabel} />
        </div>
      )}

      {/* 제목 */}
      <p className="text-sm font-medium text-gray-900 leading-snug mb-1 line-clamp-2">
        {page.title}
      </p>

      {/* 가격 */}
      <div className="flex items-center gap-2 flex-wrap">
        {page.original_price && (
          <span className="text-xs text-gray-400 line-through">
            {page.original_price.toLocaleString()}원
          </span>
        )}
        {discount && (
          <span className="text-sm font-bold text-red-500">{discount}%</span>
        )}
        <span className="text-sm font-bold text-gray-900">
          {page.price.toLocaleString()}원
        </span>
      </div>
    </Link>
  );
}
