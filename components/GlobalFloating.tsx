import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import InquiryButton from "@/components/InquiryButton";

// 오픈 예정 — 우리 Shop에 등록된 상품 중 판매 시작(sale_start_at)이 미래로 예약된 것만.
// 없으면 빈 배열 → InquiryButton이 UPCOMING 버튼을 표시하지 않음(비활성).
async function getUpcoming() {
  try {
    const result = await shopPool.query(`
      SELECT id, id AS product_id, name AS title, price, main_image,
             sale_start_at AS starts_at, NULL AS influencer_name
      FROM products_shop
      WHERE status = 'active' AND sale_start_at > NOW()
      ORDER BY sale_start_at ASC
      LIMIT 10
    `);
    return result.rows;
  } catch {
    return [];
  }
}

async function getUserId() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("shop_token")?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    return payload?.id ?? null;
  } catch {
    return null;
  }
}

export default async function GlobalFloating() {
  const [upcoming, userId] = await Promise.all([getUpcoming(), getUserId()]);
  return <InquiryButton userId={userId} upcoming={upcoming} />;
}
