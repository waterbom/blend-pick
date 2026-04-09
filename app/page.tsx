import pool from "@/lib/db";
import Header from "@/components/Header";
import HeroBanner from "@/components/HeroBanner";
import BestItems from "@/components/BestItems";
import HotInfluencers from "@/components/HotInfluencers";
import BlendPickedBanner from "@/components/BlendPickedBanner";
import TrendByAI from "@/components/TrendByAI";

interface Product {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
}

interface Influencer {
  id: string;
  name: string;
  platform: string;
  handle: string;
  followers: number;
  categories: string[] | null;
  profile_image: string | null;
}

async function getInfluencers(): Promise<Influencer[]> {
  try {
    const result = await pool.query(
      `SELECT id, name, platform, handle, followers, categories, profile_image
       FROM influencers
       WHERE status = 'active' AND is_archived = false
       ORDER BY (categories IS NOT NULL AND categories::text != '[]') DESC, followers DESC`
    );
    return result.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function getBestProducts(): Promise<Product[]> {
  try {
    const result = await pool.query(
      `SELECT id, name, brand, description, consumer_price, groupbuy_price, product_image
       FROM products
       WHERE status = 'active' AND visibility_status = 'active'
         AND product_image IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 10`
    );
    return result.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export default async function Home() {
  const [best, influencers] = await Promise.all([getBestProducts(), getInfluencers()]);
  const heroProducts = best.slice(0, 4);

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* 히어로 배너 슬라이더 */}
      <HeroBanner products={heroProducts} />

      {/* BEST ITEMS 슬라이더 */}
      <BestItems products={best} />

      {/* HOT 인플루언서 */}
      <HotInfluencers influencers={influencers} />

      {/* BLEND PICKED YOU 홍보 배너 */}
      <BlendPickedBanner />

      {/* BLEND PICK TREND BY AI */}
      <TrendByAI />
    </main>
  );
}
