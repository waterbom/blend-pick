import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import InquiryButton from "@/components/InquiryButton";

async function getUpcoming() {
  const TODAY = `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date`;
  try {
    const result = await pool.query(`
      WITH counts AS (
        SELECT product_id, COUNT(*)::int AS campaign_count
        FROM campaigns
        WHERE is_archived = false
          AND start_date > ${TODAY}
          AND start_date <= ${TODAY} + INTERVAL '7 days'
        GROUP BY product_id
      )
      SELECT DISTINCT ON (p.id)
        c.id, p.id AS product_id, p.name AS title,
        COALESCE(sp.main_image, p.product_image) AS main_image,
        c.start_date AS starts_at,
        CASE WHEN cnt.campaign_count = 1 THEN i.name ELSE NULL END AS influencer_name
      FROM campaigns c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN sales_pages sp ON sp.campaign_id = c.id
      LEFT JOIN influencers i ON i.id = c.influencer_id
      JOIN counts cnt ON cnt.product_id = p.id
      WHERE c.is_archived = false
        AND start_date > ${TODAY}
        AND start_date <= ${TODAY} + INTERVAL '7 days'
      ORDER BY p.id, c.start_date ASC
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
