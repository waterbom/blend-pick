import { NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";

// 호텔 명단 업데이트용 — 예약번호 목록의 현재 상태를 일괄 조회
// (연락처·투숙일은 DB 최신값, 취소시간·날짜변경 여부 포함)
// 일반 경로 공개 — 명단 파일(예약번호)을 가진 쪽만 의미 있는 조회 가능, 한 번에 1000건 제한
export async function POST(req: Request) {
  const { order_numbers } = await req.json();
  const nums = Array.isArray(order_numbers)
    ? order_numbers.map((v) => String(v).trim()).filter(Boolean)
    : [];
  if (nums.length > 1000) return NextResponse.json({ ok: false, error: "한 번에 1000건까지만 조회할 수 있어요." }, { status: 400 });
  if (!nums.length) return NextResponse.json({ ok: false, error: "예약번호가 없습니다." }, { status: 400 });

  const r = await shopPool.query(
    `SELECT o.order_number, o.status, o.buyer_phone, o.total_amount,
            to_char(o.stay_check_in, 'YYYY-MM-DD')  AS check_in,
            to_char(o.stay_check_out, 'YYYY-MM-DD') AS check_out,
            o.stay_changed_at IS NOT NULL AS stay_changed,
            to_char(o.cancelled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS cancelled_at_kst,
            (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 1) AS product_name
       FROM orders o
      WHERE o.order_type = 'hotel' AND o.order_number = ANY($1)`,
    [nums]
  );

  const map: Record<string, (typeof r.rows)[number]> = {};
  for (const row of r.rows) map[row.order_number] = row;
  return NextResponse.json({ ok: true, map });
}
