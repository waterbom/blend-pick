import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import RefundPolicy from "@/components/RefundPolicy";

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
  main_image: string | null;
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
            stock, status, shipping_type, shipping_cost, main_image
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
    `SELECT id, name, value, extra_price, stock, sort_order
     FROM product_options WHERE product_id = $1 ORDER BY sort_order ASC, name ASC`,
    [productId]
  );
  return result.rows as ProductOption[];
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, images, options, reviews] = await Promise.all([
    getProduct(id),
    getImages(id),
    getOptions(id),
    getReviews(id),
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
        reviews={reviews}
      />
      <div className="max-w-4xl mx-auto px-6">
        <RefundPolicy />
      </div>
    </main>
  );
}
