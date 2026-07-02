import { notFound } from "next/navigation";
import pool from "@/lib/db";
import CampaignDetailClient from "@/components/CampaignDetailClient";
import RefundPolicy from "@/components/RefundPolicy";

interface ActiveInfluencer {
  id: string;
  name: string;
  platform: string | null;
  profile_image: string | null;
}

async function getActiveInfluencers(productId: string): Promise<ActiveInfluencer[]> {
  try {
    const result = await pool.query(
      `SELECT i.id, i.name, i.platform, i.profile_image
       FROM campaigns c
       JOIN influencers i ON i.id = c.influencer_id
       WHERE c.product_id = $1
         AND c.is_archived = false
         AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
         AND c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
       ORDER BY c.end_date ASC`,
      [productId]
    );
    return result.rows;
  } catch {
    return [];
  }
}

async function isUpcomingProduct(productId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM campaigns
       WHERE product_id = $1
         AND is_archived = false
         AND start_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
       LIMIT 1`,
      [productId]
    );
    return result.rowCount! > 0;
  } catch {
    return false;
  }
}

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
  description: string | null;
  key_benefits: string[] | null;
  set_options: { name: string; qty: number; price: number; notes?: string }[] | null;
  shipping_type: string | null;
  shipping_cost: number | null;
  dispatch_days: string | null;
}

async function getProduct(id: string): Promise<Product | null> {
  try {
    const result = await pool.query(
      `SELECT id, name, brand, category, consumer_price, groupbuy_price,
              product_image, description, key_benefits, set_options,
              shipping_type, shipping_cost, dispatch_days
       FROM products
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

// 진행 중인 공동구매 중 가장 먼저 마감되는 날짜 (카운트다운용)
async function getCampaignEndDate(productId: string): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT to_char(MIN(end_date), 'YYYY-MM-DD') AS end_date
       FROM campaigns
       WHERE product_id = $1
         AND is_archived = false
         AND start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
         AND end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date`,
      [productId]
    );
    return result.rows[0]?.end_date ?? null;
  } catch {
    return null;
  }
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, activeInfluencers, isUpcoming, endDate] = await Promise.all([
    getProduct(id),
    getActiveInfluencers(id),
    isUpcomingProduct(id),
    getCampaignEndDate(id),
  ]);

  if (!product) notFound();

  const hasDiscount =
    product.groupbuy_price > 0 &&
    product.groupbuy_price < product.consumer_price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.groupbuy_price / product.consumer_price) * 100)
    : 0;
  const displayPrice = hasDiscount ? product.groupbuy_price : product.consumer_price;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <CampaignDetailClient
        productId={product.id}
        brand={product.brand}
        name={product.name}
        image={product.product_image}
        displayPrice={displayPrice}
        originalPrice={product.consumer_price}
        hasDiscount={hasDiscount}
        discountRate={discountRate}
        shippingType={product.shipping_type}
        shippingCost={product.shipping_cost}
        dispatchDays={product.dispatch_days}
        description={product.description}
        keyBenefits={product.key_benefits}
        setOptions={product.set_options}
        influencers={activeInfluencers}
        endDate={endDate}
        isUpcoming={isUpcoming && activeInfluencers.length === 0}
      />

      <div className="max-w-md mx-auto px-4 pb-16">
        <RefundPolicy />
      </div>
    </main>
  );
}
