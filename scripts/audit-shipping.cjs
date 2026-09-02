// 배송비 미적용 감사 (읽기 전용) — 건별/조건부 배송비 규칙이 판매 화면에 미적용됐던 기간의 주문을 찾아
// "받았어야 할 배송비"와 "실제 받은 배송비" 차액을 정리한다.
// 실행: 서버(앱 디렉토리)에서  node scripts/audit-shipping.cjs [YYYY-MM-DD 시작일]
// 주의: 상품의 '현재' 배송비 설정을 기준으로 계산 — 주문 당시 설정이 달랐다면 그 건은 눈으로 확인 필요.

const fs = require("fs");
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { Pool } = require("pg");
const shop = new Pool({ connectionString: process.env.SHOP_DATABASE_URL, ssl: { rejectUnauthorized: false } });

// lib/shipping.ts 와 동일 규칙
function productShippingFee(r, qty, subtotal) {
  const cost = Number(r.shipping_cost) || 0;
  switch (r.shipping_type) {
    case "free": return 0;
    case "conditional_free": { const th = Number(r.free_shipping_threshold) || 0; return th > 0 && subtotal >= th ? 0 : cost; }
    case "per_unit": { const per = Number(r.per_unit_shipping_cost) || 0; return Math.max(0, qty - 1) * per; }
    default: return cost;
  }
}
function cartShippingFee(groups) {
  let flat = 0, perUnit = 0;
  for (const g of groups) {
    const fee = productShippingFee(g.rule, g.qty, g.subtotal);
    if (g.rule.shipping_type === "per_unit") perUnit += fee; else flat = Math.max(flat, fee);
  }
  return flat + perUnit;
}

(async () => {
  const since = process.argv[2] || "2026-01-01";
  const { rows } = await shop.query(
    `SELECT o.id, o.order_number, o.status, o.buyer_name, o.buyer_phone, o.influencer_name,
            o.total_amount, COALESCE(o.shipping_fee, 0) AS shipping_fee,
            to_char(o.created_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS at_kst,
            json_agg(json_build_object(
              'product_id', oi.product_id, 'name', oi.product_name, 'qty', oi.quantity, 'unit', oi.unit_price,
              'shipping_type', p.shipping_type, 'shipping_cost', p.shipping_cost,
              'threshold', p.free_shipping_threshold, 'per_unit', p.per_unit_shipping_cost
            )) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products_shop p ON p.id = oi.product_id
      WHERE o.order_type IN ('shop', 'campaign')
        AND o.status <> 'cancelled'
        AND o.created_at >= $1
      GROUP BY o.id
      ORDER BY o.created_at`,
    [since]
  );

  const under = [];
  let totalGap = 0;
  for (const o of rows) {
    // 상품별 묶음 (추가옵션 product_id null 은 배송비 계산에서 제외)
    const groups = new Map();
    for (const it of o.items) {
      if (!it.product_id || !it.shipping_type) continue;
      const g = groups.get(it.product_id) ?? {
        rule: { shipping_type: it.shipping_type, shipping_cost: it.shipping_cost, free_shipping_threshold: it.threshold, per_unit_shipping_cost: it.per_unit },
        qty: 0, subtotal: 0, name: it.name,
      };
      g.qty += Number(it.qty); g.subtotal += Number(it.unit) * Number(it.qty);
      groups.set(it.product_id, g);
    }
    const expected = cartShippingFee([...groups.values()]);
    const charged = Number(o.shipping_fee);
    if (expected > charged) {
      const gap = expected - charged;
      totalGap += gap;
      under.push({ ...o, expected, charged, gap, groups: [...groups.values()] });
    }
  }

  console.log(`=== 배송비 감사 (${since} 이후, 취소 제외 shop/campaign 주문 ${rows.length}건) ===`);
  console.log(`덜 받은 주문: ${under.length}건 / 차액 합계: ${totalGap.toLocaleString()}원\n`);
  for (const o of under) {
    const lines = o.groups.map((g) => `${g.name} ×${g.qty} [${g.rule.shipping_type}${g.rule.shipping_type === "per_unit" ? ` ${Number(g.rule.per_unit_shipping_cost).toLocaleString()}원/건` : ""}]`).join(" + ");
    console.log(`${o.order_number} | ${o.at_kst} | ${o.buyer_name} ${o.buyer_phone} | ${o.influencer_name ?? "-"} | ${o.status}`);
    console.log(`   ${lines}`);
    console.log(`   받은 배송비 ${o.charged.toLocaleString()}원 → 받았어야 ${o.expected.toLocaleString()}원 (차액 ${o.gap.toLocaleString()}원)`);
  }

  // 정산용 CSV — private-uploads/<uuid>.csv 로 저장하면 관리자 로그인 상태에서 다운로드 가능
  if (under.length > 0) {
    const path = require("path");
    const crypto = require("crypto");
    const dir = path.join(process.cwd(), "private-uploads");
    fs.mkdirSync(dir, { recursive: true });
    const name = `${crypto.randomUUID()}.csv`;
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["주문번호", "주문일시", "이름", "연락처", "인플루언서", "상태", "상품", "수량", "배송비유형", "받은배송비", "받았어야할배송비", "차액"];
    const lines = under.map((o) => {
      const main = o.groups[0];
      const qty = o.groups.reduce((s, g) => s + g.qty, 0);
      return [
        o.order_number, o.at_kst, o.buyer_name, o.buyer_phone, o.influencer_name ?? "", o.status,
        o.groups.map((g) => g.name).join(" + "), qty, main?.rule.shipping_type ?? "",
        o.charged, o.expected, o.gap,
      ].map(esc).join(",");
    });
    lines.push(["합계", "", "", "", "", "", "", "", "", "", "", totalGap].map(esc).join(","));
    fs.writeFileSync(path.join(dir, name), "﻿" + [header.map(esc).join(","), ...lines].join("\r\n"));
    console.log(`\n=== CSV 저장: /api/admin/private-files/${name} (관리자 로그인 후 shop.blendpunch.com 뒤에 붙여서 열기) ===`);
  }

  // 상품별 요약 — 어떤 상품에서 얼마나 새고 있었는지
  const byProduct = new Map();
  for (const o of under) for (const g of o.groups) {
    if (g.rule.shipping_type !== "per_unit" && g.rule.shipping_type !== "conditional_free") continue;
    const b = byProduct.get(g.name) ?? { n: 0 };
    b.n++; byProduct.set(g.name, b);
  }
  if (byProduct.size) {
    console.log("\n=== 상품별 영향 주문 수 ===");
    for (const [name, b] of byProduct) console.log(`${b.n}건 | ${name}`);
  }
  await shop.end();
})().catch((e) => { console.error(e); process.exit(1); });
