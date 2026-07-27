import { NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";

// "도움돼요" 카운트 증가 — 클라이언트에서 localStorage로 중복 클릭을 막는다
export async function POST(req: Request) {
  const { id } = await req.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const r = await shopPool.query(
    `UPDATE reviews SET helpful_count = helpful_count + 1
      WHERE id = $1 AND is_hidden = false
      RETURNING helpful_count`,
    [id]
  );
  if (!r.rows[0]) return NextResponse.json({ error: "리뷰를 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json({ ok: true, helpful_count: r.rows[0].helpful_count });
}
