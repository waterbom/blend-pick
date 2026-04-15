import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    // 캠페인 날짜 기준으로 공구 목록 조회
    const pagesResult = await pool.query(`
      SELECT
        c.id,
        c.name AS title,
        c.start_date AS starts_at,
        c.end_date AS ends_at,
        CASE
          WHEN c.start_date <= CURRENT_DATE AND c.end_date >= CURRENT_DATE THEN 'active'
          WHEN c.start_date > CURRENT_DATE THEN 'upcoming'
          ELSE 'ended'
        END AS status,
        COALESCE(sp.main_image, p.product_image) AS main_image,
        COALESCE(NULLIF(sp.price, 0), NULLIF(c.unit_price, 0), NULLIF(p.groupbuy_price, 0), p.consumer_price, 0) AS price,
        COALESCE(sp.original_price, p.consumer_price) AS original_price,
        sp.stock_quantity,
        p.id AS product_id
      FROM campaigns c
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN sales_pages sp ON sp.campaign_id = c.id
      WHERE c.is_archived = false
        AND (
          (c.start_date <= CURRENT_DATE AND c.end_date >= CURRENT_DATE)
          OR (c.start_date > CURRENT_DATE AND c.start_date <= CURRENT_DATE + INTERVAL '7 days')
          OR (c.end_date < CURRENT_DATE AND c.end_date >= CURRENT_DATE - INTERVAL '7 days')
        )
      ORDER BY
        CASE
          WHEN c.start_date <= CURRENT_DATE AND c.end_date >= CURRENT_DATE THEN 0
          WHEN c.start_date > CURRENT_DATE THEN 1
          ELSE 2
        END,
        c.start_date ASC
    `);

    // 배너: 캠페인에 가장 많이 연결된 상품 TOP 3
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
