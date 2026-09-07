import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { sanjiLinkBase } from "@/lib/sanji-link";
import Header from "@/components/Header";
import ReviewForm from "@/components/ReviewForm";

export const metadata = { title: "구매 후기 작성", robots: { index: false, follow: false } };

export default async function SanjiReviewPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const base = await sanjiLinkBase();
  const mypageHref = `${base}/mypage`;
  const token = (await cookies()).get("shop_token")?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) redirect("/login?redirect=%2Fsanji%2Fmypage");
  const { product } = await searchParams;
  if (!product) redirect(mypageHref);

  const { rows } = await shopPool.query(
    `SELECT oi.product_name FROM orders o JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1 AND o.site = 'sanjipick' AND o.status = 'delivered'
       AND oi.product_id = $2
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_id = o.id AND r.product_id = oi.product_id)
     LIMIT 1`,
    [user.id, product]
  );
  if (!rows[0]) redirect(mypageHref);

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link href={mypageHref} className="text-sm underline">주문 내역으로</Link>
        <h1 className="text-2xl font-bold mt-6 mb-2">구매 후기 작성</h1>
        <p className="text-base mb-6">{rows[0].product_name}</p>
        <ReviewForm productId={product} loggedIn doneHref={mypageHref} />
      </div>
    </main>
  );
}
