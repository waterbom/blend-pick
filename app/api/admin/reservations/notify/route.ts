import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { HOTEL } from "@/lib/hotel";
import { sendAlimtalk, alimtalkConfigured } from "@/lib/alimtalk";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 발송 이력 컬럼 보장 (idempotent)
async function ensureColumn() {
  await shopPool.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS kakao_notified_at timestamptz`
  );
}

function nightsOf(ci: string, co: string) {
  const [ay, am, ad] = ci.split("-").map(Number);
  const [by, bm, bd] = co.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// 미발송 예약 건수 조회 (버튼 표시용)
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureColumn();
  const { rows } = await shopPool.query(
    `SELECT COUNT(*)::int AS pending
       FROM orders
      WHERE order_type = 'hotel' AND status = 'paid' AND kakao_notified_at IS NULL`
  );
  return NextResponse.json({ pending: rows[0].pending, configured: alimtalkConfigured() });
}

// 예약확인 알림톡 일괄발송 (미발송 & 예약확정 건만)
export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!alimtalkConfigured()) {
    return NextResponse.json(
      { ok: false, error: "알림톡 설정이 없습니다. SOLAPI 키·발신프로필·템플릿·발신번호를 환경변수에 등록해주세요." },
      { status: 400 }
    );
  }

  await ensureColumn();
  const { rows } = await shopPool.query(
    `SELECT o.id, o.order_number, o.buyer_name, o.buyer_phone, o.total_amount,
            to_char(o.stay_check_in, 'YYYY-MM-DD')  AS check_in,
            to_char(o.stay_check_out, 'YYYY-MM-DD') AS check_out,
            (SELECT oi.product_name FROM order_items oi WHERE oi.order_id = o.id LIMIT 1) AS product_name
       FROM orders o
      WHERE o.order_type = 'hotel' AND o.status = 'paid' AND o.kakao_notified_at IS NULL
      ORDER BY o.created_at`
  );

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const room = (r.product_name || "").split(" · ")[2] || "";
    const nights = r.check_in && r.check_out ? nightsOf(r.check_in, r.check_out) : 1;
    const variables: Record<string, string> = {
      "#{예약자}": r.buyer_name || "",
      "#{예약번호}": r.order_number,
      "#{호텔}": HOTEL.name,
      "#{객실}": room,
      "#{체크인}": r.check_in || "",
      "#{체크아웃}": r.check_out || "",
      "#{박수}": String(nights),
      "#{결제금액}": Number(r.total_amount).toLocaleString(),
    };

    const result = await sendAlimtalk(r.buyer_phone, variables);
    if (result.ok) {
      sent++;
      await shopPool.query(`UPDATE orders SET kakao_notified_at = NOW() WHERE id = $1`, [r.id]);
    } else {
      failed++;
      if (errors.length < 10) errors.push(`${r.order_number}: ${result.error}`);
    }
  }

  return NextResponse.json({ ok: true, total: rows.length, sent, failed, errors });
}
