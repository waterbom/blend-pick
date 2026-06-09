import { NextResponse } from "next/server";
import pool from "@/lib/db";

const TODAY = `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date`;

export async function GET() {
  try {
    const pagesResult = await pool.query(`
      WITH counts AS (
        SELECT product_id,
          SUM(CASE WHEN start_date <= ${TODAY} AND end_date >= ${TODAY} THEN 1 ELSE 0 END)::int AS active_count,
          SUM(CASE WHEN start_date > ${TODAY} THEN 1 ELSE 0 END)::int AS upcoming_count,
          SUM(CASE WHEN end_date < ${TODAY} AND end_date >= ${TODAY} - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS ended_count
        FROM campaigns
        WHERE is_archived = false
        GROUP BY product_id
      )
      SELECT
        c.id,
        p.name AS title,
        i.name AS influencer_name,
        c.start_date AS starts_at,
        c.end_date AS ends_at,
        CASE
          WHEN c.start_date <= ${TODAY} AND c.end_date >= ${TODAY} THEN 'active'
          WHEN c.start_date > ${TODAY} THEN 'upcoming'
          ELSE 'ended'
        END AS status,
        CASE
          WHEN c.start_date <= ${TODAY} AND c.end_date >= ${TODAY} THEN 0
          WHEN c.start_date > ${TODAY} THEN 1
          ELSE 2
        END AS status_order,
        COALESCE(sp.main_image, p.product_image) AS main_image,
        COALESCE(NULLIF(sp.price, 0), NULLIF(c.unit_price, 0), NULLIF(p.groupbuy_price, 0), p.consumer_price, 0) AS price,
        COALESCE(sp.original_price, p.consumer_price) AS original_price,
        sp.stock_quantity,
        p.id AS product_id
      FROM campaigns c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN influencers i ON i.id = c.influencer_id
      LEFT JOIN sales_pages sp ON sp.campaign_id = c.id
      WHERE c.is_archived = false
        AND (
          (c.start_date <= ${TODAY} AND c.end_date >= ${TODAY})
          OR (c.start_date > ${TODAY})
          OR (c.end_date < ${TODAY} AND c.end_date >= ${TODAY} - INTERVAL '30 days')
        )
      ORDER BY status_order, c.start_date ASC
    `);

    const bannerResult = await pool.query(`
      SELECT p.id, p.name, p.product_image, COUNT(c.id)::int AS campaign_count
      FROM products p
      JOIN campaigns c ON c.product_id = p.id
      WHERE p.product_image IS NOT NULL
      GROUP BY p.id, p.name, p.product_image
      ORDER BY campaign_count DESC
      LIMIT 3
    `);

    return NextResponse.json({
      pages: pagesResult.rows,
      banner: bannerResult.rows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ pages: [], banner: [] });
  }
}
