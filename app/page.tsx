import pool from "@/lib/db";
import Header from "@/components/Header";
import SalesBanner from "@/components/SalesBanner";
import HomeDealSection from "@/components/HomeDealSection";
import CollabSection from "@/components/CollabSection";
import TrendByAI from "@/components/TrendByAI";

export interface CampaignPage {
  id: string;
  product_id: string;
  title: string;
  price: number;
  original_price: number | null;
  main_image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  stock_quantity: number | null;
  campaign_count: number;
  influencer_name: string | null;
}

const TODAY = `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date`;

async function getCampaignsByCondition(
  dateWhere: string
): Promise<CampaignPage[]> {
  try {
    const result = await pool.query(`
      WITH counts AS (
        SELECT product_id, COUNT(*)::int AS campaign_count
        FROM campaigns
        WHERE is_archived = false AND ${dateWhere}
        GROUP BY product_id
      )
      SELECT DISTINCT ON (p.id)
        c.id,
        p.name AS title,
        c.start_date AS starts_at,
        c.end_date AS ends_at,
        COALESCE(sp.main_image, p.product_image) AS main_image,
        COALESCE(NULLIF(sp.price, 0), NULLIF(c.unit_price, 0), NULLIF(p.groupbuy_price, 0), p.consumer_price, 0) AS price,
        COALESCE(sp.original_price, p.consumer_price) AS original_price,
        sp.stock_quantity,
        p.id AS product_id,
        cnt.campaign_count,
        CASE WHEN cnt.campaign_count = 1 THEN i.name ELSE NULL END AS influencer_name
      FROM campaigns c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN sales_pages sp ON sp.campaign_id = c.id
      LEFT JOIN influencers i ON i.id = c.influencer_id
      JOIN counts cnt ON cnt.product_id = p.id
      WHERE c.is_archived = false AND ${dateWhere}
      ORDER BY p.id, c.start_date ASC
    `);
    return result.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function getActiveCampaigns() {
  return getCampaignsByCondition(
    `start_date <= ${TODAY} AND end_date >= ${TODAY}`
  );
}

async function getUpcomingCampaigns() {
  return getCampaignsByCondition(
    `start_date > ${TODAY} AND start_date <= ${TODAY} + INTERVAL '30 days'`
  );
}

async function getEndedCampaigns() {
  return getCampaignsByCondition(
    `end_date < ${TODAY} AND end_date >= ${TODAY} - INTERVAL '7 days'`
  );
}

async function getBannerProducts() {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.product_image, COUNT(c.id)::int AS campaign_count
       FROM products p
       JOIN campaigns c ON c.product_id = p.id
       WHERE p.product_image IS NOT NULL
       GROUP BY p.id, p.name, p.product_image
       ORDER BY campaign_count DESC
       LIMIT 3`
    );
    return result.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function getCollabProducts() {
  try {
    const result = await pool.query(`
      SELECT id, name, brand, product_image
      FROM products
      WHERE is_archived = false
        AND product_image IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM campaigns c
          WHERE c.product_id = products.id AND c.is_archived = false
        )
      ORDER BY RANDOM()
      LIMIT 20
    `);
    const countResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM products
      WHERE is_archived = false
        AND NOT EXISTS (
          SELECT 1 FROM campaigns c
          WHERE c.product_id = products.id AND c.is_archived = false
        )
    `);
    return { products: result.rows, totalCount: countResult.rows[0].total };
  } catch (e) {
    console.error(e);
    return { products: [], totalCount: 0 };
  }
}

export default async function Home() {
  const [active, upcoming, ended, banner, collab] =
    await Promise.all([
      getActiveCampaigns(),
      getUpcomingCampaigns(),
      getEndedCampaigns(),
      getBannerProducts(),
      getCollabProducts(),
    ]);

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />

      {/* 히어로 배너 슬라이더 */}
      <SalesBanner products={banner} />

      {/* HOT DEAL 섹션 */}
      <HomeDealSection active={active} upcoming={upcoming} ended={ended} />



      {/* 협업 가능 제품 섹션 */}
      <CollabSection products={collab.products} totalCount={collab.totalCount} />

      {/* BLEND PICK TREND BY AI */}
      <TrendByAI />

    </main>
  );
}
