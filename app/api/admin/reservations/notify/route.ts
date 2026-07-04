import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { HOTEL } from "@/lib/hotel";
import { sendSMS, smsConfigured } from "@/lib/sms";

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
  return NextResponse.json({ pending: rows[0].pending, configured: smsConfigured() });
}

// 예약확인 문자 일괄발송 (미발송 & 예약확정 건만)
export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!smsConfigured()) {
    return NextResponse.json(
      { ok: false, error: "문자 설정이 없습니다. SOLAPI API 키·발신번호를 환경변수에 등록해주세요." },
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
    const text =
      `[${HOTEL.name}] 예약 확인\n\n` +
      `${r.buyer_name || "고객"}님, 예약이 확정되었습니다.\n\n` +
      `▪ 예약번호: ${r.order_number}\n` +
      `▪ 객실: ${room}\n` +
      `▪ 투숙: ${r.check_in} ~ ${r.check_out} (${nights}박)\n` +
      `▪ 결제금액: ${Number(r.total_amount).toLocaleString()}원\n\n` +
      `체크인 시 예약자 성함으로 확인됩니다.`;

    const result = await sendSMS(r.buyer_phone, text, "예약 확인");
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
