import shopPool from "@/lib/db-shop";
import Link from "next/link";

async function getStats() {
  const [products, orders, reviews, settlements] = await Promise.all([
    shopPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')  AS active,
        COUNT(*) FILTER (WHERE status = 'soldout') AS soldout,
        COUNT(*) FILTER (WHERE status = 'draft')   AS draft,
        COUNT(*)                                    AS total
      FROM products_shop
    `),
    shopPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'paid')      AS new_orders,
        COUNT(*) FILTER (WHERE status = 'preparing') AS preparing,
        COUNT(*) FILTER (WHERE status = 'shipped')   AS shipped,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*)                                     AS total
      FROM orders
    `),
    shopPool.query(`
      SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_reviews
      FROM reviews
    `),
    shopPool.query(`
      SELECT COALESCE(SUM(net_amount), 0) AS today
      FROM settlements
      WHERE settled_at::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
    `),
  ]);

  return {
    products: products.rows[0],
    orders: orders.rows[0],
    newReviews: Number(reviews.rows[0].new_reviews),
    todaySettlement: Number(settlements.rows[0].today),
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const cards = [
    {
      label: "판매 관리",
      href: "/admin/orders",
      value: `${Number(stats.orders.new_orders)}건`,
      sub: "신규 주문",
      detail: [
        { label: "배송준비", value: stats.orders.preparing },
        { label: "배송중",   value: stats.orders.shipped },
        { label: "배송완료", value: stats.orders.delivered },
      ],
    },
    {
      label: "정산 관리",
      href: "/admin/settlements",
      value: `${Number(stats.todaySettlement).toLocaleString()}원`,
      sub: "오늘 정산액",
      detail: [],
    },
    {
      label: "상품 관리",
      href: "/admin/products",
      value: `${Number(stats.products.active)}개`,
      sub: "판매중 상품",
      detail: [
        { label: "준비중", value: stats.products.draft },
        { label: "품절",   value: stats.products.soldout },
        { label: "전체",   value: stats.products.total },
      ],
    },
    {
      label: "리뷰 현황",
      href: "/admin/reviews",
      value: `${stats.newReviews}개`,
      sub: "최근 7일 새 리뷰",
      detail: [],
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">대시보드</h1>
      <p className="text-sm text-gray-400 mb-8">Blend Pick 어드민</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href}
            className="bg-white rounded-none border border-gray-100 p-6 hover:border-[#2D5A27] hover:shadow-sm transition-all">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{card.label}</p>
            <p className="text-3xl font-black text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-400 mt-1">{card.sub}</p>
            {card.detail.length > 0 && (
              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-50">
                {card.detail.map((d) => (
                  <div key={d.label}>
                    <p className="text-xs text-gray-400">{d.label}</p>
                    <p className="text-sm font-bold text-gray-700">{Number(d.value)}개</p>
                  </div>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
