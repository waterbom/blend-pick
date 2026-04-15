import pool from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import Header from "@/components/Header";
import SalesBanner from "@/components/SalesBanner";
import BestItems from "@/components/BestItems";
import HotInfluencers from "@/components/HotInfluencers";
import BlendPickedBanner from "@/components/BlendPickedBanner";
import TrendByAI from "@/components/TrendByAI";
import InquiryButton from "@/components/InquiryButton";

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

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("shop_token")?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    return payload?.id || null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const [best, influencers, userId, banner] = await Promise.all([
    getBestProducts(),
    getInfluencers(),
    getUserId(),
    getBannerProducts(),
  ]);

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* 히어로 배너 슬라이더 */}
      <SalesBanner products={banner} />

      {/* BEST ITEMS 슬라이더 */}
      <BestItems products={best} />

      {/* HOT 인플루언서 */}
      <HotInfluencers influencers={influencers} />

      {/* BLEND PICKED YOU 홍보 배너 */}
      <BlendPickedBanner />

      {/* BLEND PICK TREND BY AI */}
      <TrendByAI />

      {/* 문의하기 플로팅 버튼 */}
      <InquiryButton userId={userId} />
    </main>
  );
}
