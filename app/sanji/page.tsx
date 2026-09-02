import Link from "next/link";
import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import FallbackImg from "@/components/FallbackImg";
import { SITES, SANJI as C } from "@/lib/sites";

const S = SITES.sanjipick;
const SERIF = "'Noto Serif KR', serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

interface Product {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  original_price: number | null;
  stock: number;
  main_image: string | null;
}

// 산지픽 노출 상품 — 상품 관리에서 카테고리를 '산지픽'으로 지정한 판매 중 상품
async function getSanjiProducts(): Promise<Product[]> {
  if (S.categories.length === 0) return [];
  try {
    const r = await shopPool.query(
      `SELECT id, name, brand, price, original_price, stock, main_image
         FROM products_shop
        WHERE status = 'active'
          AND (sale_start_at IS NULL OR sale_start_at <= NOW())
          AND category = ANY($1::text[])
        ORDER BY created_at DESC
        LIMIT 12`,
      [S.categories]
    );
    return r.rows as Product[];
  } catch (e) {
    console.error("[sanji] 상품 조회 실패:", e);
    return [];
  }
}

function Cap({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] lg:text-[11px] mb-2.5" style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".3em", color: C.field }}>
      {children}
    </div>
  );
}

export default async function SanjiHome() {
  const products = await getSanjiProducts();

  return (
    <main>
      <Header />

      {/* ── 히어로 — 흙·밭·햇살 톤, 사진은 첫 공구 확정되면 배경으로 ── */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${C.paper} 0%, ${C.cream} 100%)` }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-20 lg:py-28 text-center">
          <Cap>SANJI PICK · 산지 직송 공동구매</Cap>
          <h1 className="m-0 text-[34px] lg:text-[58px] leading-[1.18]" style={{ fontFamily: SERIF, fontWeight: 700, color: C.soil }}>
            산지에서 바로,
            <br />
            <span style={{ color: C.field }}>제철 그대로</span>
          </h1>
          <p className="mt-5 mb-0 text-[14px] lg:text-[16px]" style={{ color: C.muted }}>
            농가에서 수확한 그날, 중간 유통 없이 집 앞까지 — 산지픽이 고르고 인플루언서가 직접 먹어본 것만 올려요.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="#fresh" className="inline-block text-[13px] font-bold px-7 py-3.5" style={{ background: C.field, color: "#fff" }}>
              지금 산지 직송 보기 ↓
            </a>
            <a href={S.kakaoUrl} target="_blank" rel="noopener noreferrer"
              className="inline-block text-[13px] font-bold px-7 py-3.5" style={{ border: `1px solid ${C.hairline}`, color: C.soil700, background: "#fff" }}>
              💬 오픈 알림 받기
            </a>
          </div>
        </div>
        {/* 햇살 포인트 */}
        <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-60" style={{ background: `radial-gradient(circle, ${C.sunSoft} 0%, transparent 70%)` }} />
      </section>

      {/* ── 지금 산지 직송 ── */}
      <section id="fresh" className="max-w-6xl mx-auto px-5 sm:px-6 py-14 lg:py-20">
        <div className="flex items-end justify-between gap-6 pb-5 mb-8" style={{ borderBottom: `1px solid ${C.hairline}` }}>
          <div>
            <Cap>FRESH FROM FARM</Cap>
            <h2 className="m-0 text-2xl lg:text-[28px]" style={{ fontFamily: SERIF, fontWeight: 600, color: C.soil }}>지금 산지 직송</h2>
          </div>
          <span className="hidden sm:block text-[11px]" style={{ fontFamily: MONO, letterSpacing: ".2em", color: C.muted }}>
            {String(products.length).padStart(2, "0")} ITEMS
          </span>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2.5 py-16 text-center"
            style={{ border: `1px solid ${C.hairline}`, background: `repeating-linear-gradient(45deg,#FFFFFF,#FFFFFF 12px,${C.cream} 12px,${C.cream} 24px)` }}>
            <span className="text-[10px]" style={{ fontFamily: MONO, letterSpacing: ".28em", color: C.field }}>COMING SOON</span>
            <span className="text-[18px] font-semibold" style={{ fontFamily: SERIF, color: C.soil }}>첫 산지 공구를 준비하고 있어요</span>
            <span className="text-[12.5px]" style={{ color: C.muted }}>카카오 채널에서 오픈 소식을 가장 먼저 받아보세요</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ marginTop: -1 }}>
            {products.map((p) => {
              const soldOut = p.stock <= 0;
              const discount = p.original_price && p.original_price > p.price
                ? Math.round((1 - p.price / p.original_price) * 100) : null;
              return (
                <Link key={p.id} href={`/products/${p.id}`} className="group block bg-white"
                  style={{ outline: `1px solid ${C.hairline}`, outlineOffset: -0.5 }}>
                  <div className="relative aspect-square overflow-hidden" style={{ background: C.cream }}>
                    <FallbackImg src={p.main_image} alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5"
                      style={{ fontFamily: MONO, letterSpacing: ".12em", background: C.sun, color: C.soil }}>
                      산지 직송
                    </span>
                    {soldOut && (
                      <div className="absolute inset-0 flex items-center justify-center text-[12px] font-bold"
                        style={{ background: "rgba(62,42,30,.55)", color: "#fff" }}>품절</div>
                    )}
                  </div>
                  <div className="px-4 py-4">
                    {p.brand && <div className="text-[10.5px] mb-1" style={{ fontFamily: MONO, letterSpacing: ".14em", color: C.muted }}>{p.brand}</div>}
                    <div className="text-[13px] lg:text-[14px] font-semibold leading-snug line-clamp-2" style={{ color: C.soil }}>{p.name}</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      {discount != null && <span className="text-[12px] font-bold" style={{ color: C.field }}>{discount}%</span>}
                      <span className="text-[15px] font-bold" style={{ color: C.soil }}>{Number(p.price).toLocaleString()}원</span>
                      {p.original_price && p.original_price > p.price && (
                        <s className="text-[11.5px]" style={{ color: "#B4AC9E" }}>{Number(p.original_price).toLocaleString()}원</s>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 산지픽이 다른 이유 ── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-16 lg:pb-24">
        <div className="text-center mb-8">
          <Cap>WHY SANJI PICK</Cap>
          <h2 className="m-0 text-2xl lg:text-[28px]" style={{ fontFamily: SERIF, fontWeight: 600, color: C.soil }}>산지픽이 다른 이유</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[1px]" style={{ background: C.hairline, border: `1px solid ${C.hairline}` }}>
          {[
            ["FARM DIRECT", "농가 직거래", "중간 유통 없이 산지에서 바로 — 그만큼 가격은 낮게, 신선함은 높게."],
            ["IN SEASON", "제철에만 판매", "가장 맛있는 시기에만 열고, 시기가 지나면 미련 없이 닫아요."],
            ["TASTED FIRST", "직접 먹어본 것만", "산지픽 팀과 인플루언서가 먼저 먹어보고 통과한 농산물만 올라와요."],
          ].map(([cap, t, d]) => (
            <div key={cap} className="px-6 py-7 text-left" style={{ background: "#fff" }}>
              <div className="text-[9.5px] mb-2" style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".26em", color: C.field }}>{cap}</div>
              <div className="text-[15px] font-bold mb-1.5" style={{ color: C.soil }}>{t}</div>
              <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: C.muted }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 전역 푸터(사업자 정보)는 루트 레이아웃이 그린다 — 산지픽도 같은 운영사라 공용 */}
    </main>
  );
}
