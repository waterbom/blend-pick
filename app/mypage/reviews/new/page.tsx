import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { currentSite } from "@/lib/site-server";
import { sanjiLinkBase } from "@/lib/sanji-link";
import Header from "@/components/Header";
import ReviewForm from "@/components/ReviewForm";

export const metadata = { title: "구매 후기 작성", robots: { index: false, follow: false } };

export default async function SanjiReviewPage({ searchParams }: { searchParams: Promise<{ product?: string; order?:string }> }) {
  const site=await currentSite();
  const base = site.key==="sanjipick"?await sanjiLinkBase():"";
  const mypageHref = `${base}/mypage`;
  const token = (await cookies()).get("shop_token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) redirect(`/login?redirect=${encodeURIComponent(base+"/mypage")}`);
  const { product,order } = await searchParams;
  if (!product || !/^[0-9a-f-]{36}$/i.test(product) || (order&&!/^[0-9a-f-]{36}$/i.test(order))) redirect(mypageHref);

  const { rows } = await shopPool.query(
    `SELECT o.id AS order_id, oi.product_name FROM orders o JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1 AND o.site = $3 AND o.status = 'delivered'
       AND oi.product_id = $2 AND ($4::uuid IS NULL OR o.id=$4)
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_id = o.id AND r.product_id = oi.product_id)
     LIMIT 1`,
    [user.id, product, site.key,order||null]
  );
  if (!rows[0]) redirect(mypageHref);

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link href={mypageHref} className="text-sm underline">주문 내역으로</Link>
        <h1 className="text-2xl font-bold mt-6 mb-2">구매 후기 작성</h1>
        <p className="text-base mb-6">{rows[0].product_name}</p>
        <ReviewForm orderId={rows[0].order_id} productId={product} loggedIn doneHref={mypageHref} />
      </div>
    </main>
  );
}
