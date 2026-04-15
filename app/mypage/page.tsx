import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import Header from "@/components/Header";
import WithdrawButton from "@/components/WithdrawButton";

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  customer: { label: "일반 고객", color: "bg-gray-100 text-gray-600" },
  influencer: { label: "인플루언서", color: "bg-orange-100 text-orange-600" },
  vendor: { label: "벤더사", color: "bg-blue-100 text-blue-600" },
};

const ROLE_STATUS_LABEL: Record<string, string> = {
  pending: "심사 중",
  approved: "승인됨",
  rejected: "반려됨",
};

export default async function MyPage() {
  // 쿠키에서 토큰 읽기
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  if (!token) redirect("/login");

  const payload = await verifyToken(token);
  if (!payload) redirect("/login");

  // DB에서 유저 정보 가져오기
  const result = await pool.query(
    "SELECT id, name, nickname, profile_image, role, role_status FROM shop_users WHERE id = $1",
    [payload.id]
  );
  const user = result.rows[0];
  if (!user) redirect("/login");

  const roleInfo = ROLE_LABEL[user.role] ?? ROLE_LABEL.customer;

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* 프로필 */}
        <div className="flex items-center gap-5 mb-10">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 shrink-0">
            {user.profile_image ? (
              <img
                src={user.profile_image}
                alt={user.nickname}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">
                👤
              </div>
            )}
          </div>
          <div>
            <p className="text-xl font-black text-gray-900 mb-1">
              {user.nickname || user.name || "이름 없음"}
            </p>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${roleInfo.color}`}
              >
                {roleInfo.label}
              </span>
              {user.role_status && user.role !== "customer" && (
                <span className="text-xs text-gray-400">
                  {ROLE_STATUS_LABEL[user.role_status] ?? user.role_status}
                </span>
              )}
            </div>
          </div>
        </div>

        <hr className="border-gray-100 mb-10" />

        {/* 구독 상태 */}
        <section className="mb-10">
          <h2 className="text-sm font-black text-gray-900 mb-3">OS 구독</h2>
          <div className="border border-gray-100 p-5">
            <p className="text-sm text-gray-400">
              구독을 하지 않은 상태입니다.
            </p>
            <button className="mt-4 text-sm font-bold text-white bg-black px-5 py-2.5 hover:bg-gray-800 transition-colors">
              구독하기
            </button>
          </div>
        </section>

        {/* 장바구니 (추후) */}
        <section className="mb-10">
          <h2 className="text-sm font-black text-gray-900 mb-3">장바구니</h2>
          <div className="border border-gray-100 p-5">
            <p className="text-sm text-gray-400">담은 상품이 없습니다.</p>
          </div>
        </section>

        {/* 최근 본 제품 (추후) */}
        <section className="mb-10">
          <h2 className="text-sm font-black text-gray-900 mb-3">
            최근 본 제품
          </h2>
          <div className="border border-gray-100 p-5">
            <p className="text-sm text-gray-400">최근 본 제품이 없습니다.</p>
          </div>
        </section>

        {/* 최근 본 인플루언서 (추후) */}
        <section className="mb-10">
          <h2 className="text-sm font-black text-gray-900 mb-3">
            최근 본 인플루언서
          </h2>
          <div className="border border-gray-100 p-5">
            <p className="text-sm text-gray-400">
              최근 본 인플루언서가 없습니다.
            </p>
          </div>
        </section>

        {/* 로그아웃 */}
        <div className="text-center">
          <a
            href="/api/auth/logout"
            className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
          >
            로그아웃
          </a>
          <span className="text-gray-200 mx-3">|</span>
          <WithdrawButton />
        </div>
      </div>
    </main>
  );
}
