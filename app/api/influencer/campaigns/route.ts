import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import { randomUUID } from "crypto";

// 인플루언서 본인 인증 (shop_token role=influencer + influencers 연결 확인)
async function getInfluencer() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const { rows } = await pool.query(
    `SELECT i.id, i.name FROM influencers i
     JOIN shop_users u ON u.id = i.user_id::text
     WHERE u.id = $1 AND u.role = 'influencer'`,
    [payload.id]
  );
  return rows[0] ?? null;
}

// 포크 가능한 공구 목록 — 현재 진행중인 공구가 있는 상품 중, 내가 아직 안 하는 것
export async function GET() {
  const inf = await getInfluencer();
  if (!inf) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (p.id)
            p.id AS product_id, p.name, p.brand, p.product_image,
            COALESCE(NULLIF(c.unit_price, 0), NULLIF(p.groupbuy_price, 0), p.consumer_price, 0) AS price,
            to_char(MAX(c.end_date) OVER (PARTITION BY p.id), 'YYYY-MM-DD') AS end_date
     FROM campaigns c
     JOIN products p ON p.id = c.product_id
     WHERE c.is_archived = false
       AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
       AND c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
       AND p.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM campaigns mine
         WHERE mine.product_id = p.id AND mine.influencer_id = $1 AND mine.is_archived = false
       )
     ORDER BY p.id, c.end_date DESC`,
    [inf.id]
  );
  return NextResponse.json(rows);
}

// 공구 포크 — 진행중 공구를 원본 삼아 내 이름의 캠페인 생성
export async function POST(req: Request) {
  const inf = await getInfluencer();
  if (!inf) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_id } = await req.json();
  if (!product_id) return NextResponse.json({ error: "product_id 필요" }, { status: 400 });

  // 원본: 해당 상품의 진행중 공구 중 가장 늦게 끝나는 것 (조건 복사용)
  const src = await pool.query(
    `SELECT c.company_id, to_char(c.end_date, 'YYYY-MM-DD') AS end_date,
            c.commission_rate, c.unit_price, c.supply_price, p.name AS product_name
     FROM campaigns c JOIN products p ON p.id = c.product_id
     WHERE c.product_id = $1 AND c.is_archived = false
       AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
       AND c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
     ORDER BY c.end_date DESC LIMIT 1`,
    [product_id]
  );
  if (!src.rows[0]) {
    return NextResponse.json({ error: "진행중인 공구가 아닙니다" }, { status: 404 });
  }

  // 중복 방지 — 같은 상품×인플루언서 비보관 캠페인은 1개만 (결제 귀속 검증이 이 전제를 사용)
  const dup = await pool.query(
    `SELECT 1 FROM campaigns WHERE product_id = $1 AND influencer_id = $2 AND is_archived = false`,
    [product_id, inf.id]
  );
  if (dup.rows[0]) {
    return NextResponse.json({ error: "이미 이 상품의 공구를 진행하고 있어요" }, { status: 409 });
  }

  const s = src.rows[0];
  const id = randomUUID();
  // 레거시 테이블 제약: id/name 필수, is_archived는 false로 명시해야 노출됨
  await pool.query(
    `INSERT INTO campaigns (
       id, company_id, name, product_id, influencer_id, status,
       start_date, end_date, commission_rate, unit_price, supply_price,
       is_archived, campaign_type, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, 'active',
       (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date, $6, $7, $8, $9,
       false, 'internal', NOW(), NOW())`,
    [
      id, s.company_id ?? null, `${s.product_name} - ${inf.name} 공구`,
      product_id, inf.id, s.end_date,
      s.commission_rate ?? null, s.unit_price ?? null, s.supply_price ?? null,
    ]
  );

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
