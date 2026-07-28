import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

/**
 * 호텔 작업지시서 — "지난 발행 이후 달라진 것"만 계산해 내려준다.
 * 파일 전체를 주고받다 옛 취소 표시를 또 처리하는 사고를 막기 위한 diff 방식.
 * · 대체(재결제): 취소 주문 + 같은 연락처의 신규 결제(6시간 내)를 한 건으로 병합 —
 *   호텔이 "취소"만 보고 방을 빼는 사고의 주범이라 절대 취소 단독으로 내리지 않는다.
 * · GET  = 계산만 (발행 기록 없음, 미리보기용)
 * · POST = 발행 확정 기록 (다음 회차의 기준 시각이 됨)
 */

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

async function ensureTable() {
  await shopPool.query(`
    CREATE TABLE IF NOT EXISTS hotel_roster_issues (
      id SERIAL PRIMARY KEY,
      issued_at timestamptz NOT NULL DEFAULT NOW(),
      baseline_at timestamptz,
      new_count int NOT NULL DEFAULT 0,
      replaced_count int NOT NULL DEFAULT 0,
      changed_count int NOT NULL DEFAULT 0,
      cancelled_count int NOT NULL DEFAULT 0
    )`);
}

interface HotelOrderRow {
  order_number: string;
  buyer_name: string;
  buyer_phone: string;
  status: string;
  created_at: string;
  cancelled_at: string | null;
  stay_changed_at: string | null;
  check_in: string | null;
  check_out: string | null;
  cancelled_kst: string | null;
  product_name: string | null;
  option_label: string | null;
  memo: string | null;
}

const ACTIVE = new Set(["paid", "checked_in", "no_show"]);
const normPhone = (v: string | null) => String(v || "").replace(/[^0-9]/g, "").replace(/^82/, "0");

function publicRow(o: HotelOrderRow) {
  // 객실은 option_label("패밀리 트윈 · 7/25(토) ~ …") 앞부분, 패키지는 상품명에서 호텔명 제거
  const room = (o.option_label || "").split("·")[0].trim();
  const pkg = (o.product_name || "").replace(/^여수 UTOP 마리나 호텔 · /, "");
  const req = (o.memo || "").match(/요청: (.*)$/)?.[1] ?? "";
  const nights =
    o.check_in && o.check_out
      ? Math.round((Date.parse(o.check_out) - Date.parse(o.check_in)) / 86400000)
      : null;
  return {
    order_number: o.order_number,
    buyer_name: o.buyer_name,
    buyer_phone: normPhone(o.buyer_phone),
    room, pkg, request: req,
    check_in: o.check_in, check_out: o.check_out, nights,
    cancelled_kst: o.cancelled_kst,
  };
}

async function compute(baseline: string | null) {
  const r = await shopPool.query(
    `SELECT o.order_number, o.buyer_name, o.buyer_phone, o.status,
            o.created_at, o.cancelled_at, o.stay_changed_at,
            to_char(o.stay_check_in, 'YYYY-MM-DD')  AS check_in,
            to_char(o.stay_check_out, 'YYYY-MM-DD') AS check_out,
            to_char(o.cancelled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS cancelled_kst,
            (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 1) AS product_name,
            (SELECT option_label FROM order_items WHERE order_id = o.id LIMIT 1) AS option_label,
            o.addr_memo AS memo
       FROM orders o
      WHERE o.order_type = 'hotel'
      ORDER BY o.stay_check_in NULLS LAST, o.created_at`
  );
  const rows = r.rows as HotelOrderRow[];
  const base = baseline ? Date.parse(baseline) : null;
  const after = (ts: string | null) => ts != null && (base == null || Date.parse(ts) > base);

  // 예약대기(awaiting)는 아직 확정 전 — 호텔에 등록시키지 않는다
  const newOnes = rows.filter((o) => ACTIVE.has(o.status) && after(o.created_at));
  const cancelledOnes = rows.filter((o) => o.status === "cancelled" && after(o.cancelled_at));

  // 대체(재결제) 병합 — 같은 연락처의 취소↔신규가 6시간 안에 있으면 한 건으로
  const replaced: { old: ReturnType<typeof publicRow>; next: ReturnType<typeof publicRow> }[] = [];
  const usedNew = new Set<string>(), usedCancel = new Set<string>();
  for (const a of cancelledOnes) {
    const at = Date.parse(a.cancelled_at!);
    const b = newOnes.find(
      (n) => !usedNew.has(n.order_number) &&
        normPhone(n.buyer_phone) === normPhone(a.buyer_phone) &&
        Math.abs(Date.parse(n.created_at) - at) < 6 * 3600e3
    );
    if (b) {
      usedNew.add(b.order_number); usedCancel.add(a.order_number);
      replaced.push({ old: publicRow(a), next: publicRow(b) });
    }
  }

  const added = newOnes.filter((o) => !usedNew.has(o.order_number)).map(publicRow);
  const cancelled = cancelledOnes.filter((o) => !usedCancel.has(o.order_number)).map(publicRow);
  const changed = rows
    .filter((o) => ACTIVE.has(o.status) && after(o.stay_changed_at) && !after(o.created_at))
    .map(publicRow);
  // 참고용 전체 현황 — 현재 유효한 예약 전부 (지시서 대조용)
  const roster = rows.filter((o) => ACTIVE.has(o.status)).map(publicRow);

  return { added, replaced, changed, cancelled, roster };
}

export async function GET(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureTable();

  const since = new URL(req.url).searchParams.get("since");
  const last = await shopPool.query(
    `SELECT id, issued_at FROM hotel_roster_issues ORDER BY issued_at DESC LIMIT 1`
  );
  const baseline = since || last.rows[0]?.issued_at?.toISOString?.() || (last.rows[0]?.issued_at ?? null);

  const data = await compute(baseline ? String(baseline) : null);
  return NextResponse.json({
    ok: true,
    baseline: baseline ? String(baseline) : null,
    lastIssuedAt: last.rows[0]?.issued_at ?? null,
    issueNo: (last.rows[0]?.id ?? 0) + 1,
    now: new Date().toISOString(),
    ...data,
  });
}

export async function POST(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureTable();

  const body = await req.json().catch(() => ({}));
  const r = await shopPool.query(
    `INSERT INTO hotel_roster_issues (baseline_at, new_count, replaced_count, changed_count, cancelled_count)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, issued_at`,
    [
      body.baseline || null,
      Number(body.new_count) || 0,
      Number(body.replaced_count) || 0,
      Number(body.changed_count) || 0,
      Number(body.cancelled_count) || 0,
    ]
  );
  return NextResponse.json({ ok: true, issueNo: r.rows[0].id, issuedAt: r.rows[0].issued_at });
}
