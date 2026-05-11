import { verifyAdminToken } from "@/lib/auth";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return new Response("Unauthorized", { status: 401 });
  const admin = await verifyAdminToken(token);
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const wb = XLSX.utils.book_new();

  // 헤더 + 힌트 + 샘플 2행
  const data = [
    // 헤더
    ["상품명", "브랜드", "카테고리", "판매가", "정가", "재고", "상태", "배송유형", "배송비", "이미지URL", "제품설명"],
    // 힌트
    ["필수", "필수", "예: 식품", "숫자", "숫자(없으면 빈칸)", "숫자", "draft/active/soldout", "paid/free", "숫자", "https://...", "상품 설명"],
    // 샘플 1
    ["데켓 쿡플레이트 세트", "데켓", "주방용품", 69000, 89000, 50, "active", "paid", 3000, "https://example.com/img.jpg", "인덕션 호환 올스텐 쿡플레이트"],
    // 샘플 2
    ["디어커스 수분크림", "디어커스", "스킨케어", 29000, 38000, 100, "active", "free", 0, "", "피부 장벽 강화 수분 크림"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 컬럼 너비 설정
  ws["!cols"] = [
    { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "상품목록");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=blendpick_product_template.xlsx",
    },
  });
}
