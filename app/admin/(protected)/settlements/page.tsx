import shopPool from "@/lib/db-shop";
import Link from "next/link";

interface SettlementRow {
  id: string;
  payment_key: string;
  order_id: string;
  order_number: string | null;
  buyer_name: string | null;
  gross_amount: number;
  fee: number;
  net_amount: number;
  settled_at: string;
  created_at: string;
}

async function getSettlementStats() {
  const result = await shopPool.query(`
    SELECT
      COALESCE(SUM(net_amount) FILTER (
        WHERE settled_at::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
      ), 0) AS today,
      COALESCE(SUM(net_amount) FILTER (
        WHERE settled_at >= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')
      ), 0) AS this_week,
      COALESCE(SUM(net_amount) FILTER (
        WHERE settled_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')
      ), 0) AS this_month,
      COALESCE(SUM(net_amount), 0) AS total,
      COALESCE(SUM(fee), 0) AS total_fee
    FROM settlements
  `);
  return result.rows[0];
}

async function getSettlements(period?: string) {
  let where = "";
  if (period === "today") {
    where = `WHERE s.settled_at::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date`;
  } else if (period === "week") {
    where = `WHERE s.settled_at >= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')`;
  } else if (period === "month") {
    where = `WHERE s.settled_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')`;
  }

  const result = await shopPool.query(`
    SELECT s.id, s.payment_key, s.order_id, s.gross_amount, s.fee, s.net_amount, s.settled_at, s.created_at,
           o.order_number, o.buyer_name
    FROM settlements s
    LEFT JOIN orders o ON o.id = s.order_id
    ${where}
    ORDER BY s.settled_at DESC
    LIMIT 200
  `);
  return result.rows as SettlementRow[];
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const [stats, settlements] = await Promise.all([
    getSettlementStats(),
    getSettlements(period),
  ]);

  const dashboardCards = [
    { key: "today", label: "오늘", amount: Number(stats.today) },
    { key: "week", label: "이번 주", amount: Number(stats.this_week) },
    { key: "month", label: "이번 달", amount: Number(stats.this_month) },
    { key: "", label: "총 정산액", amount: Number(stats.total) },
  ];

  return (
    <div>
      {/* 대시보드 카드 */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-800">정산 관리</span>
        </div>
        <div className="flex items-center">
          {dashboardCards.map((card, i) => (
            <div key={card.key || "total"} className="flex items-center flex-1">
              <Link
                href={card.key ? `/admin/settlements?period=${card.key}` : "/admin/settlements"}
                className="flex-1 group"
              >
                <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                <div className="text-2xl font-bold text-gray-800 group-hover:text-orange-500 transition-colors">
                  {card.amount.toLocaleString()}<span className="text-sm font-medium text-gray-400 ml-0.5">원</span>
                </div>
              </Link>
              {i < dashboardCards.length - 1 && (
                <div className="mx-4 text-gray-200 text-lg">›</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-50 text-xs text-gray-400">
          총 수수료: <span className="font-medium text-gray-600">{Number(stats.total_fee).toLocaleString()}원</span>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-100 p-1">
        {[
          { key: "", label: "전체" },
          { key: "today", label: "오늘" },
          { key: "week", label: "이번 주" },
          { key: "month", label: "이번 달" },
        ].map((tab) => {
          const active = (period || "") === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key ? `/admin/settlements?period=${tab.key}` : "/admin/settlements"}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* 정산 목록 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">정산일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">주문번호</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">구매자</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">총액</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">수수료</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">정산액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {settlements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                  정산 내역이 없습니다
                </td>
              </tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(s.settled_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {s.order_number || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {s.buyer_name || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {Number(s.gross_amount).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right text-red-400">
                    -{Number(s.fee).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {Number(s.net_amount).toLocaleString()}원
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
