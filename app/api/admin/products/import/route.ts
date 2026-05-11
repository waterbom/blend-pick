import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import * as XLSX from "xlsx";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// shop products_shop 컬럼 매핑
const COLUMN_MAP: Record<string, string> = {
  // 제품명
  "제품명": "name", "상품명": "name", "name": "name",
  // 브랜드
  "브랜드": "brand", "brand": "brand",
  // 설명
  "제품설명": "description", "상품설명": "description", "설명": "description", "description": "description",
  // 가격
  "판매가": "price", "가격": "price", "price": "price",
  "정가": "original_price", "소비자가": "original_price", "original_price": "original_price",
  // 재고
  "재고": "stock", "재고수량": "stock", "stock": "stock",
  // 카테고리
  "카테고리": "category", "category": "category",
  // 상태
  "상태": "status", "status": "status",
  // 배송
  "배송유형": "shipping_type", "배송타입": "shipping_type", "shipping_type": "shipping_type",
  "배송비": "shipping_cost", "shipping_cost": "shipping_cost",
  // 이미지
  "이미지URL": "main_image", "이미지": "main_image", "대표이미지": "main_image", "main_image": "main_image",
};

const NUMERIC_FIELDS = new Set(["price", "original_price", "stock", "shipping_cost"]);

function autoMap(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i].trim().toLowerCase().replace(/\s/g, "");
    let matched = "__skip__";
    for (const [alias, field] of Object.entries(COLUMN_MAP)) {
      if (alias.toLowerCase().replace(/\s/g, "") === key) {
        matched = field;
        break;
      }
    }
    mapping[i] = matched;
  }
  return mapping;
}

function convertValue(field: string, raw: string): string | number | null {
  const v = raw.trim();
  if (!v || ["none", "null", "-", "n/a"].includes(v.toLowerCase())) return null;
  if (NUMERIC_FIELDS.has(field)) {
    const n = parseFloat(v.replace(/,/g, ""));
    return isNaN(n) ? null : n;
  }
  return v || null;
}

// POST /api/admin/products/import — 파일 파싱 + 미리보기 데이터 반환
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];

  if (!rawRows.length) return NextResponse.json({ error: "파일이 비어있습니다" }, { status: 400 });

  const headers = rawRows[0].map(String);
  const rows = rawRows.slice(1).filter((r) => r.some((c) => String(c).trim()));
  const mapping = autoMap(headers);

  return NextResponse.json({
    headers,
    rows: rows.map((r) => r.map(String)),
    mapping,
    totalRows: rows.length,
    previewRows: rows.slice(0, 10).map((r) => r.map(String)),
  });
}

// PUT /api/admin/products/import — 확정 저장
export async function PUT(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { headers, rows, mapping } = await req.json() as {
    headers: string[];
    rows: string[][];
    mapping: Record<string, string>;
  };

  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const data: Record<string, string | number | null> = {};

    for (let i = 0; i < headers.length; i++) {
      const field = mapping[String(i)];
      if (!field || field === "__skip__") continue;
      const val = convertValue(field, String(row[i] ?? ""));
      if (val !== null) data[field] = val;
    }

    if (!data.name) { skipped++; continue; }

    try {
      await shopPool.query(`
        INSERT INTO products_shop
          (name, brand, description, price, original_price, stock, category,
           status, shipping_type, shipping_cost, main_image)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        data.name,
        data.brand ?? null,
        data.description ?? null,
        Number(data.price ?? 0),
        data.original_price ? Number(data.original_price) : null,
        Number(data.stock ?? 0),
        data.category ?? null,
        data.status ?? "draft",
        data.shipping_type ?? "paid",
        Number(data.shipping_cost ?? 3000),
        data.main_image ?? null,
      ]);
      saved++;
    } catch (e) {
      errors.push(`행 ${rowIdx + 2} (${data.name}): ${e}`);
    }
  }

  return NextResponse.json({ saved, skipped, errors });
}
