import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import { getOrders } from "@/lib/customer-orders";
import { sanjiLinkBase } from "@/lib/sanji-link";
import { SITES } from "@/lib/sites";
import Header from "@/components/Header";
import CustomerOrders from "@/components/CustomerOrders";
import WithdrawButton from "@/components/WithdrawButton";

// 회원 계정은 공유하지만 구매 화면과 주문 데이터는 산지픽으로 한정한다.
export default async function SanjiMyPage() {
  const base = await sanjiLinkBase();
  // 공용 카카오 콜백이 shop 호스트로 돌아와도 산지픽 화면을 유지한다.
  const loginHref = `/login?redirect=${encodeURIComponent("/sanji/mypage")}`;
  const token = (await cookies()).get("shop_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) redirect(loginHref);

  const { rows } = await pool.query(
    "SELECT name, nickname FROM shop_users WHERE id = $1 AND is_active = true",
    [payload.id]
  );
  const user = rows[0];
  if (!user) redirect(loginHref);

  const orders = await getOrders(payload.id, "sanjipick");

  return (
    <main className="min-h-screen" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">산지픽 마이페이지</h1>
        <p className="text-base mb-8">{user.nickname || user.name || "고객"}님, 안녕하세요.</p>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 md:gap-10 items-start">
          <aside className="md:sticky md:top-24">
            <nav aria-label="산지픽 마이페이지 메뉴" className="ds-card flex flex-col text-sm">
              <a href="#orders" className="px-5 py-4 font-bold" style={{ color: "var(--accent)", background: "var(--surface-soft)" }}>주문·배송 조회</a>
              <a href="#help" className="px-5 py-4" style={{ borderTop: "1px solid var(--line)" }}>취소·교환·반품 안내</a>
              <Link href={`${base}/products`} className="px-5 py-4" style={{ borderTop: "1px solid var(--line)" }}>제철 상품 둘러보기</Link>
              <a href="/api/auth/logout" className="px-5 py-4" style={{ borderTop: "1px solid var(--line)", color: "var(--text-muted)" }}>로그아웃</a>
            </nav>
          </aside>
          <div className="min-w-0">
            <CustomerOrders orders={orders} sanjiBase={base} />
            <section id="help" className="ds-card p-5 sm:p-6 scroll-mt-24">
              <h2 className="text-lg font-bold mb-3">취소·교환·반품 안내</h2>
              <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                취소나 교환·반품은 해당 주문의 버튼에서 신청해주세요. 배송이나 상품에 궁금한 점이 있으면 주문번호와 함께 문의해주세요.
              </p>
              <a href={SITES.sanjipick.kakaoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center mt-5 min-h-11 px-5 text-sm font-semibold" style={{ border: "1px solid var(--accent)", color: "var(--accent)" }}>산지픽 고객센터</a>
            </section>
            <div className="mt-8 text-right"><WithdrawButton sharedAccount homeHref={base || "/"} /></div>
          </div>
        </div>
      </div>
    </main>
  );
}
