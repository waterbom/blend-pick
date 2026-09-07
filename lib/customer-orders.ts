import shopPool from "@/lib/db-shop";
import type { SiteKey } from "@/lib/sites";

export async function getOrders(userId: string, site: SiteKey) {
  try {
    const result = await shopPool.query(
      `SELECT
        o.id, o.order_number, o.total_amount, o.status, o.paid_at,
        o.tracking_company, o.tracking_number,
        o.recipient_name, o.buyer_name, o.addr_address, o.addr_detail,
        to_char(o.shipped_at   AT TIME ZONE 'Asia/Seoul', 'MM/DD') AS shipped_kst,
        to_char(o.delivered_at AT TIME ZONE 'Asia/Seoul', 'MM/DD') AS delivered_kst,
        (SELECT json_build_object('kind', r.kind, 'status', r.status,
                'created_kst', to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'MM/DD'))
           FROM order_returns r WHERE r.order_id = o.id
          ORDER BY r.created_at DESC LIMIT 1) AS latest_return,
        (SELECT e.note FROM order_return_events e
           JOIN order_returns r2 ON r2.id = e.return_id
          WHERE r2.order_id = o.id AND e.status = 'rejected'
          ORDER BY e.created_at DESC LIMIT 1) AS return_reject_note,
        json_agg(
          json_build_object(
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'option_label', oi.option_label,
            'unit_price', oi.unit_price,
            'quantity', oi.quantity,
            'reviewed', EXISTS (SELECT 1 FROM reviews rv WHERE rv.order_id = o.id AND rv.product_id = oi.product_id)
          ) ORDER BY (oi.product_id IS NULL), oi.id
        ) AS items
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1 AND o.site = $2 AND o.order_type <> 'hotel'
      GROUP BY o.id
      ORDER BY o.paid_at DESC
      LIMIT 20`,
      [userId, site]
    );
    return result.rows;
  } catch (error) {
    console.error("[mypage] 주문 조회 실패", error);
    return null;
  }
}

