import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import Link from "next/link";
import FallbackImg from "@/components/FallbackImg";
import HotelPromoBand from "@/components/HotelPromoBand";

export const metadata = { title: "Products · BLEND PICK" };

// 딥 포레스트 팔레트 (호텔 예약 페이지와 동일 토큰)
const C = {
  green900: "#1C2418",
  green800: "#244B1F",
  green700: "#2D5A27",
  sage: "#7A8B6F",
  sageLight: "#9FBF93",
  mintOnDark: "#C7D6C0",
  surfaceSoft: "#F6F4EE",
  hairline: "#E4E1D6",
  muted: "#6B7263",
  muted2: "#4A5442",
  muted3: "#8B927F",
  soldText: "#5C6553",
  strike: "#B4B0A2",
} as const;

const SERIF = "'Noto Serif KR', serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const KAKAO_CHANNEL_URL = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "http://pf.kakao.com/_VyING/chat";
const UPCOMING_SLOTS = 4; // 오픈 예정 자리 — 예정 상품 공개 시 실데이터로 교체

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  original_price: number | null;
  stock: number;
  status: string;
  main_image: string | null;
  shipping_type: string;
  shipping_cost: number;
}

async function getProducts(category?: string) {
  const params: string[] = [];
  let where = `WHERE status = 'active'`;
  if (category) {
    params.push(category);
    where += ` AND category = $1`;
  }
  const result = await shopPool.query(
    `SELECT id, name, brand, category, price, original_price, stock, status, main_image, shipping_type, shipping_cost
     FROM products_shop ${where} ORDER BY created_at DESC`,
    params
  );
  return result.rows as Product[];
}

async function getCategories() {
  const result = await shopPool.query(
    `SELECT DISTINCT category FROM products_shop WHERE status = 'active' ORDER BY category`
  );
  return result.rows.map((r) => r.category as string);
}

// 카테고리 세그먼트 (직각, 보더 겹침)
function CategoryTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      className="px-4 lg:px-[22px] py-2 lg:py-2.5 text-[12.5px] lg:text-[13px] -ml-px first:ml-0 transition-colors duration-150"
      style={{
        background: active ? C.green800 : "#fff",
        color: active ? "#fff" : C.muted2,
        fontWeight: active ? 600 : 400,
        border: `1px solid ${active ? C.green800 : C.hairline}`,
      }}>
      {label}
    </Link>
  );
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [products, categories] = await Promise.all([
    getProducts(category),
    getCategories(),
  ]);

  // 상품 4개 이상이면 컴팩트 4열, 적으면 대형 에디토리얼 2열 (핸드오프 권장)
  const compact = products.length >= 4;

  return (
    <main className="min-h-screen" style={{ background: "#FFFFFF", color: C.green900 }}>
      {/* 딥 포레스트 전용 폰트 */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <Header />

      {/* ── 타이틀 밴드 (다크 그린) ── */}
      <section style={{ background: C.green800, color: "#EAF0E6" }}>
        <div className="max-w-[1240px] mx-auto px-5 lg:px-12 pt-8 lg:pt-12 pb-7 lg:pb-10 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4">
          <div>
            <div className="text-[10px] lg:text-[11px] mb-3 lg:mb-3.5"
              style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".3em", color: C.sageLight }}>
              BLEND PICK SHOP
            </div>
            <h1 className="m-0 text-[27px] lg:text-[38px] leading-[1.25]" style={{ fontFamily: SERIF, fontWeight: 600, color: "#fff" }}>
              Products
            </h1>
          </div>
          <p className="m-0 text-[13px] lg:text-[14px] leading-relaxed lg:text-right" style={{ color: C.mintOnDark }}>
            지금 판매 중인 공구 상품과<br className="hidden lg:block" /> 곧 오픈할 공구를 한눈에.
          </p>
        </div>
      </section>

      {/* ── 필터 바 ── */}
      <div style={{ borderBottom: `1px solid ${C.hairline}` }}>
        <div className="max-w-[1240px] mx-auto px-5 lg:px-12 py-4 lg:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap">
            <CategoryTab href="/products" label="전체" active={!category} />
            {categories.map((cat) => (
              <CategoryTab key={cat} href={`/products?category=${encodeURIComponent(cat)}`} label={cat} active={category === cat} />
            ))}
          </div>
          <div className="text-[11px] lg:text-[12px]" style={{ fontFamily: MONO, fontWeight: 500, color: C.sage }}>
            판매 중 {products.length} · 오픈 예정 {UPCOMING_SLOTS}
          </div>
        </div>
      </div>

      <div className="max-w-[1240px] mx-auto px-5 lg:px-12">
        {/* ── 상품 그리드 ── */}
        {products.length === 0 ? (
          <div className="text-center py-28 text-sm" style={{ color: C.muted3 }}>
            등록된 상품이 없습니다.
          </div>
        ) : (
          <div
            className={`grid gap-[1px] mt-0 ${compact ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 lg:grid-cols-2"}`}
            style={{ background: C.hairline, border: `1px solid ${C.hairline}`, borderTop: "none" }}
          >
            {products.map((p) => {
              const discount = p.original_price && p.original_price > p.price
                ? Math.round((1 - p.price / p.original_price) * 100)
                : null;
              const soldOut = p.stock === 0 || p.status === "soldout";
              const imgH = compact ? "h-[180px] lg:h-[220px]" : "h-[240px] lg:h-[380px]";

              const cardInner = (
                <>
                  {/* 이미지 */}
                  <div className={`relative overflow-hidden ${imgH}`} style={{ background: C.surfaceSoft }}>
                    <div style={soldOut ? { filter: "grayscale(.55)", opacity: 0.75, height: "100%" } : { height: "100%" }}>
                      <FallbackImg src={p.main_image} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    {soldOut && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(28,36,24,.28)" }}>
                        <span className="px-5 lg:px-[26px] py-2 lg:py-2.5 text-[12px] lg:text-[13px] font-bold"
                          style={{ background: C.green900, color: "#FDFCF9", letterSpacing: ".24em" }}>
                          품 절
                        </span>
                      </div>
                    )}
                    {discount != null && (
                      <span className="absolute top-0 left-0 px-3 lg:px-3.5 py-1.5 lg:py-2 text-[12px] lg:text-[13px]"
                        style={{ fontFamily: MONO, fontWeight: 600, background: soldOut ? C.muted3 : C.green800, color: "#fff" }}>
                        -{discount}%
                      </span>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className={`flex flex-col gap-1.5 lg:gap-2 flex-1 ${compact ? "p-3.5 lg:p-4" : "p-5 lg:py-6 lg:px-7"}`}>
                    <div className="text-[10px] lg:text-[11px]" style={{ letterSpacing: ".14em", color: C.sage }}>{p.brand}</div>
                    <div className={`${compact ? "text-[13px]" : "text-[14.5px] lg:text-[16px]"} font-semibold leading-[1.5] line-clamp-2`}
                      style={{ color: soldOut ? C.soldText : C.green900 }}>
                      {p.name}
                    </div>
                    <div className="flex items-baseline gap-2 lg:gap-2.5 mt-0.5 tnum">
                      <span className={`${compact ? "text-[16px]" : "text-[19px] lg:text-[22px]"} font-bold`}
                        style={{ color: soldOut ? C.muted3 : C.green900 }}>
                        {p.price.toLocaleString()}원
                      </span>
                      {p.original_price && p.original_price > p.price && (
                        <span className="text-[12px] lg:text-[13.5px] line-through" style={{ color: C.strike }}>
                          {p.original_price.toLocaleString()}원
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] lg:text-[12px]"
                      style={p.shipping_type === "free" ? { color: C.green700, fontWeight: 600 } : { color: C.muted3 }}>
                      {p.shipping_type === "free" ? "무료배송" : `배송비 ${p.shipping_cost.toLocaleString()}원`}
                    </div>
                    <div className={compact ? "mt-auto pt-2.5" : "mt-auto pt-3 lg:pt-4"}>
                      {soldOut ? (
                        <span className={`inline-block font-semibold ${compact ? "px-4 py-2 text-[12px]" : "px-6 lg:px-7 py-2.5 lg:py-3 text-[13px]"}`}
                          style={{ border: `1px solid ${C.green800}`, color: C.green800 }}>
                          재입고 알림 받기
                        </span>
                      ) : (
                        <span className={`inline-block font-bold text-white ${compact ? "px-4 py-2 text-[12px]" : "px-6 lg:px-7 py-2.5 lg:py-3 text-[13px]"}`}
                          style={{ background: C.green800 }}>
                          구매하기 →
                        </span>
                      )}
                    </div>
                  </div>
                </>
              );

              // 품절 상품은 재입고 알림(카카오)으로, 판매 중은 상세로 — 카드 전체가 링크
              return soldOut ? (
                <a key={p.id} href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col bg-white transition-colors duration-150 hover:bg-[#FDFCF9]">
                  {cardInner}
                </a>
              ) : (
                <Link key={p.id} href={`/products/${p.id}`}
                  className="flex flex-col bg-white transition-colors duration-150 hover:bg-[#FDFCF9]">
                  {cardInner}
                </Link>
              );
            })}
          </div>
        )}

        {/* ── 곧 오픈하는 공구 (UPCOMING) ── */}
        <div className="mt-10 lg:mt-12">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-baseline gap-2 mb-4 lg:mb-5">
            <div>
              <div className="text-[10px] lg:text-[11px] mb-2 lg:mb-2.5"
                style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".28em", color: C.sage }}>
                UPCOMING — {UPCOMING_SLOTS}
              </div>
              <h2 className="m-0 text-[19px] lg:text-[24px]" style={{ fontFamily: SERIF, fontWeight: 600 }}>
                곧 오픈하는 공구
              </h2>
            </div>
            <div className="text-[12px] lg:text-[13px]" style={{ color: C.muted }}>
              오픈 알림은{" "}
              <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
                style={{ color: C.green700, textDecoration: "underline", textUnderlineOffset: 2 }}>
                카카오톡 채널
              </a>
              에서 받아보세요
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-[1px]" style={{ background: C.hairline, border: `1px solid ${C.hairline}` }}>
            {Array.from({ length: UPCOMING_SLOTS }, (_, i) => (
              <div key={i} className="bg-white p-4 lg:p-5 flex flex-col gap-3">
                <div className="h-[110px] lg:h-[140px] flex items-center justify-center"
                  style={{ background: `repeating-linear-gradient(45deg,${C.surfaceSoft},${C.surfaceSoft} 10px,#EDEAE0 10px,#EDEAE0 20px)` }}>
                  <span className="text-[10px]" style={{ fontFamily: MONO, color: C.sage, letterSpacing: ".14em" }}>
                    COMING SOON
                  </span>
                </div>
                <div>
                  <div className="text-[10px] lg:text-[11px] mb-1" style={{ letterSpacing: ".14em", color: C.sage }}>
                    오픈 예정 {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="text-[12.5px] lg:text-[13px] font-semibold" style={{ color: C.muted2 }}>공개 전 상품</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 진행 중 공구 밴드 ── */}
        <div className="mt-10 lg:mt-12 mb-12 lg:mb-14">
          <HotelPromoBand />
        </div>
      </div>
    </main>
  );
}
