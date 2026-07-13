import { notFound, redirect } from "next/navigation";
import pool from "@/lib/db";
import CampaignDetailClient from "@/components/CampaignDetailClient";
import RefundPolicy from "@/components/RefundPolicy";

/**
 * 인플루언서 전용 공구 링크 (/c/<campaignId>)
 *
 * 캠페인 한 행 = (상품 × 인플루언서) 쌍이므로, 이 페이지로 들어와 결제하면
 * 링크 주인 인플루언서에게만 매출이 귀속된다 (checkout에서 서버 재검증).
 * 인플루언서를 1명만 넘기면 CampaignDetailClient가 선택 UI 없이 고정 배너로 렌더된다.
 */

interface CampaignRow {
  id: string;
  product_id: string;
  influencer_id: string;
  end_date: string; // YYYY-MM-DD
  is_archived: boolean;
  started: boolean;
  ended: boolean;
  influencer_name: string;
  platform: string | null;
  profile_image: string | null;
}

async function getCampaign(campaignId: string): Promise<CampaignRow | null> {
  try {
    const result = await pool.query(
      `SELECT c.id, c.product_id, c.influencer_id,
              to_char(c.end_date, 'YYYY-MM-DD') AS end_date,
              c.is_archived,
              c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS started,
              c.end_date   <  (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date AS ended,
              i.name AS influencer_name, i.platform, i.profile_image
       FROM campaigns c
       JOIN influencers i ON i.id = c.influencer_id
       WHERE c.id = $1`,
      [campaignId]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

async function getProduct(id: string) {
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

export default async function InfluencerCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);

  if (!campaign) notFound();

  // 종료/보관된 공구 링크 → 일반 상품 공구 페이지로 (귀속 기간 종료)
  if (campaign.is_archived || campaign.ended) {
    redirect(`/campaigns/${campaign.product_id}`);
  }

  const product = await getProduct(campaign.product_id);
  if (!product) notFound();

  const hasDiscount =
    product.groupbuy_price > 0 && product.groupbuy_price < product.consumer_price;
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
        influencers={[
          {
            id: campaign.influencer_id,
            name: campaign.influencer_name,
            platform: campaign.platform,
            profile_image: campaign.profile_image,
          },
        ]}
        endDate={campaign.started ? campaign.end_date : null}
        isUpcoming={!campaign.started}
      />

      <div className="max-w-md mx-auto px-4 pb-16">
        <RefundPolicy />
      </div>
    </main>
  );
}
