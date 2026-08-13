import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";
import Header from "@/components/Header";
import ShopHeroBanner from "@/components/ShopHeroBanner";
import TrendByAI from "@/components/TrendByAI";
import HotelPromoBand from "@/components/HotelPromoBand";
import FallbackImg from "@/components/FallbackImg";
import Link from "next/link";

interface ShopProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  original_price: number | null;
  stock: number;
  status: string;
  main_image: string | null;
  shipping_type: string;
  shipping_cost: number;
}

interface UpcomingProduct {
  id: string;
  name: string;
  brand: string;
  main_image: string | null;
  open_label: string;
}

// 판매 중 상품 — Shop 등록 기준 (판매 시작 예약이 미래인 상품은 제외)
async function getSellingProducts(): Promise<ShopProduct[]> {
  try {
    const result = await shopPool.query(
      `SELECT id, name, brand, price, original_price, stock, status, main_image, shipping_type, shipping_cost
       FROM products_shop
       WHERE status = 'active' AND (sale_start_at IS NULL OR sale_start_at <= NOW())
       ORDER BY created_at DESC
       LIMIT 8`
    );
    return result.rows;
  } catch (e) {
    console.error("[home] 판매 상품 조회 실패:", e);
    return [];
  }
}

// 곧 오픈 — 판매 시작이 미래로 예약된 상품 (Products 페이지와 동일 기준)
async function getUpcomingProducts(): Promise<UpcomingProduct[]> {
  try {
    const result = await shopPool.query(
      `SELECT id, name, brand, main_image,
              to_char(sale_start_at AT TIME ZONE 'Asia/Seoul', 'FMMM. FMDD') AS open_label
       FROM products_shop
       WHERE status = 'active' AND sale_start_at > NOW()
       ORDER BY sale_start_at ASC
       LIMIT 4`
    );
    return result.rows;
  } catch (e) {
    console.error("[home] 오픈 예정 조회 실패:", e);
    return [];
  }
}

// 지금 호텔 공구가 열려 있는 인플루언서 (일정이 현재 시각을 포함) — 마감 임박 순
async function getActiveHotelInfluencers(): Promise<{ id: string; name: string; deadline: string }[]> {
  try {
    const r = await pool.query(
      `SELECT id, name,
              to_char(hotel_sale_deadline AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS"+09:00"') AS deadline
       FROM influencers
       WHERE hotel_sale_start <= NOW() AND hotel_sale_deadline >= NOW()
       ORDER BY hotel_sale_deadline ASC`
    );
    return r.rows;
  } catch {
    return [];
  }
}

// 오픈 예정(다가오는) 호텔 공구 — 시작이 미래인 인플루언서, 임박 순
async function getUpcomingHotelInfluencers(): Promise<{ id: string; name: string; start: string }[]> {
  try {
    const r = await pool.query(
      `SELECT id, name,
              to_char(hotel_sale_start AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS"+09:00"') AS start
       FROM influencers
       WHERE hotel_sale_start > NOW()
       ORDER BY hotel_sale_start ASC`
    );
    return r.rows;
  } catch {
    return [];
  }
}

export default async function Home() {
  const [selling, upcoming, hotelActive, hotelUpcoming] = await Promise.all([
    getSellingProducts(), getUpcomingProducts(), getActiveHotelInfluencers(), getUpcomingHotelInfluencers(),
  ]);

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />

      {/* 히어로 배너 슬라이더 */}
      <ShopHeroBanner />

      {/* 지금 판매 중 — Shop 상품 */}
      <section className="container-blend pt-10 pb-4">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-1.5" style={{ color: "var(--accent)" }}>
              NOW ON SALE
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              지금 판매 중
            </h2>
          </div>
          <Link href="/products" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            전체 보기 →
          </Link>
        </div>

        {selling.length === 0 ? (
          <div className="text-center py-20 text-sm rounded-2xl" style={{ color: "var(--text-muted)", background: "var(--surface-soft)" }}>
            판매 중인 상품이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {selling.map((p) => {
              const discount = p.original_price && p.original_price > p.price
                ? Math.round((1 - p.price / p.original_price) * 100)
                : null;
              const soldOut = p.stock === 0 || p.status === "soldout";
              return (
                <Link key={p.id} href={`/products/${p.id}`} className="group block">
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-3" style={{ background: "var(--surface-soft)" }}>
                    <FallbackImg src={p.main_image} alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    {discount != null && !soldOut && (
                      <span className="absolute top-2 left-2 text-white text-xs font-extrabold px-2 py-0.5 rounded-full" style={{ background: "var(--sale)" }}>
                        -{discount}%
                      </span>
                    )}
                    {soldOut && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
                        <span className="text-white text-sm font-bold">품절</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{p.brand}</p>
                  <p className="text-sm font-medium line-clamp-2 leading-snug mb-1.5" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                  <div className="flex items-center gap-1.5 tnum">
                    <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{p.price.toLocaleString()}원</span>
                    {p.original_price && p.original_price > p.price && (
                      <span className="text-xs line-through" style={{ color: "var(--text-muted)" }}>{p.original_price.toLocaleString()}원</span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: p.shipping_type === "free" ? "var(--accent)" : "var(--text-muted)" }}>
                    {p.shipping_type === "free" ? "무료배송" : `배송비 ${p.shipping_cost.toLocaleString()}원`}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 주문·배송 조회 안내 — 비회원도 휴대폰 번호로 바로 (푸터에만 있던 진입점을 본문에 조용히 노출) */}
      <section className="container-blend pt-6 pb-2">
        <Link
          href="/orders/lookup"
          className="group flex items-center gap-4 rounded-2xl bg-white px-5 sm:px-6 py-4 sm:py-5 transition-shadow hover:shadow-sm"
          style={{ border: "1px solid var(--line)" }}
        >
          <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
            style={{ background: "var(--accent-soft)" }}>
            📦
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              주문하신 상품이 궁금하세요?
            </span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              비회원도 휴대폰 번호만으로 주문·배송 조회가 가능해요
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ color: "var(--accent)" }}>
            주문 조회 →
          </span>
        </Link>
      </section>

      {/* 곧 오픈 — 판매 예약 상품 (있을 때만) */}
      {upcoming.length > 0 && (
        <section className="container-blend pt-8 pb-4">
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-1.5" style={{ color: "var(--accent)" }}>
            UPCOMING
          </p>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-5" style={{ color: "var(--text-primary)" }}>
            곧 오픈해요
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {upcoming.map((u) => (
              <Link key={u.id} href={`/products/${u.id}`} className="group block rounded-2xl overflow-hidden bg-white" style={{ border: "1px solid var(--line)" }}>
                <div className="relative w-full aspect-[4/3] overflow-hidden" style={{ background: "var(--surface-soft)" }}>
                  <FallbackImg src={u.main_image} alt={u.name} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 text-xs font-extrabold px-2.5 py-1 rounded-full text-white" style={{ background: "var(--accent)" }}>
                    {u.open_label} 오픈
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-[11px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>{u.brand}</p>
                  <p className="text-sm font-semibold line-clamp-2 leading-snug" style={{ color: "var(--text-primary)" }}>{u.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 진행 중 호텔 공구 밴드 */}
      <section className="container-blend pt-8 pb-4">
        <HotelPromoBand active={hotelActive} upcoming={hotelUpcoming} />
      </section>

      {/* BLEND PICK TREND BY AI */}
      <TrendByAI />
    </main>
  );
}
