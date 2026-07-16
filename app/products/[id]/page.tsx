import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";
import Header from "@/components/Header";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import RefundPolicy from "@/components/RefundPolicy";

// 인플루언서 전용 링크(?inf=) 검증 — 존재하는 인플루언서만 귀속 (호텔 공구와 동일 패턴)
async function getInfluencer(inf?: string): Promise<{ id: string; name: string } | null> {
  if (!inf) return null;
  try {
    const r = await pool.query("SELECT id, name FROM influencers WHERE id = $1", [inf]);
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string | null;
  price: number;
  original_price: number | null;
  stock: number;
  status: string;
  shipping_type: string;
  shipping_cost: number;
  free_shipping_threshold: number | null;
  main_image: string | null;
  addon_multi: boolean;
}

interface ProductAddon {
  id: string;
  name: string;
  extra_price: number;
}

interface ProductImage {
  id: string;
  url: string;
  sort_order: number;
}

interface ProductOption {
  id: string;
  name: string;
  value: string;
  extra_price: number;
  stock: number;
  sort_order: number;
  is_active: boolean;
}

interface Review {
  id: string;
  buyer_name: string;
  rating: number;
  content: string;
  images: string[] | null;
  created_at: string;
}

async function getProduct(id: string) {
  const result = await shopPool.query(
    `SELECT id, name, brand, category, description, price, original_price,
            stock, status, shipping_type, shipping_cost, free_shipping_threshold, main_image, addon_multi
     FROM products_shop WHERE id = $1`,
    [id]
  );
  return result.rows[0] as Product | undefined;
}

async function getImages(productId: string) {
  const result = await shopPool.query(
    `SELECT id, url, sort_order FROM product_images
     WHERE product_id = $1 ORDER BY sort_order ASC`,
    [productId]
  );
  return result.rows as ProductImage[];
}

async function getOptions(productId: string) {
  const result = await shopPool.query(
    `SELECT id, name, value, extra_price, stock, sort_order, is_active
     FROM product_options WHERE product_id = $1 ORDER BY sort_order ASC, name ASC`,
    [productId]
  );
  return result.rows as ProductOption[];
}

async function getAddons(productId: string) {
  const result = await shopPool.query(
    `SELECT id, name, extra_price
     FROM product_addons WHERE product_id = $1 AND is_active = true ORDER BY sort_order ASC`,
    [productId]
  );
  return result.rows as ProductAddon[];
}

async function getReviews(productId: string) {
  const result = await shopPool.query(
    `SELECT id, buyer_name, rating, content, images, created_at
     FROM reviews WHERE product_id = $1 AND is_hidden = false
     ORDER BY created_at DESC LIMIT 20`,
    [productId]
  );
  return result.rows as Review[];
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inf?: string }>;
}) {
  const { id } = await params;
  const { inf } = await searchParams;
  const [product, images, options, addons, reviews, influencer] = await Promise.all([
    getProduct(id),
    getImages(id),
    getOptions(id),
    getAddons(id),
    getReviews(id),
    getInfluencer(inf),
  ]);

  if (!product) notFound();

  // main_image를 images 맨 앞에 합쳐서 전달
  const allImages = [
    ...(product.main_image ? [{ id: "main", url: product.main_image, sort_order: -1 }] : []),
    ...images,
  ];

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <ProductDetail
        product={product}
        images={allImages}
        options={options}
        addons={addons}
        addonMulti={product.addon_multi}
        reviews={reviews}
        influencerId={influencer?.id}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <RefundPolicy />
      </div>
    </main>
  );
}
