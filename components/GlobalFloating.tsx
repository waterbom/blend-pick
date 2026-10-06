import { cookies, headers } from "next/headers";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import InquiryButton from "@/components/InquiryButton";
import { currentSite } from "@/lib/site-server";
import { SITES } from "@/lib/sites";
import { isFloatingExcludedPath } from "@/lib/floating-visibility";

// 오픈 예정 — 우리 Shop에 등록된 상품 중 판매 시작(sale_start_at)이 미래로 예약된 것만.
// 없으면 빈 배열 → InquiryButton이 UPCOMING 버튼을 표시하지 않음(비활성).
async function getUpcoming() {
  try {
    const result = await shopPool.query(`
      SELECT id, id AS product_id, name AS title, price, main_image,
             sale_start_at AS starts_at, NULL AS influencer_name
      FROM products_shop
      WHERE status = 'active' AND is_visible = true AND sale_start_at > NOW() AND category <> ALL($1::text[])
      ORDER BY sale_start_at ASC
      LIMIT 10
    `, [SITES.sanjipick.categories]); // 블랜드픽 전용 플로팅이라 산지픽 오픈 예정은 제외
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
  // 산지픽은 화면 하단이 고정 구매바라 블랜드픽 플로팅 도구를 띄우지 않는다.
  if ((await currentSite()).key === "sanjipick") return null;
  const pathname = (await headers()).get("x-pathname") || "/";
  // 제외 경로에서도 클라이언트 껍데기는 유지해 공개 화면으로 이동하면 버튼을 다시 표시한다.
  // 실제 숨김은 InquiryButton의 usePathname 조건이 담당하고, 불필요한 DB·사용자 조회는 건너뛴다.
  if (isFloatingExcludedPath(pathname)) return <InquiryButton userId={null} initialPathname={pathname} />;
  const [upcoming, userId] = await Promise.all([getUpcoming(), getUserId()]);
  return <InquiryButton userId={userId} upcoming={upcoming} initialPathname={pathname} />;
}
