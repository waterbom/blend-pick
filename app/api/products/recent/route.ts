import { NextRequest, NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";

export async function POST(req: NextRequest) {
  const { ids } = await req.json();
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const limited = ids.slice(0, 10);

  const result = await shopPool.query(
    `SELECT id, name, brand, price, original_price, main_image, status, stock
     FROM products_shop
     WHERE id = ANY($1::uuid[])`,
    [limited]
  );

  // 요청한 순서(최근 본 순)대로 정렬
  const map = new Map(result.rows.map((r) => [r.id, r]));
  const ordered = limited.map((id: string) => map.get(id)).filter(Boolean);

  return NextResponse.json({ products: ordered });
}
