import { verifyAdminToken } from "@/lib/auth";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token)
        return new Response("Unauthorized", { status: 401 });
    const admin = await verifyAdminToken(token);
    if (!admin)
        return new Response("Unauthorized", { status: 401 });
    const wb = XLSX.utils.book_new();
    // 헤더 + 힌트 + 샘플 2행
    const data = [["상품명", "브랜드", "카테고리", "판매가", "공급가", "정가", "재고", "상태", "배송유형", "배송비", "이미지URL", "제품설명"]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "상품목록");
    const help = [["입력 안내"], ["상품명·카테고리·판매가·공급가는 필수입니다. 원가는 0원도 입력할 수 있습니다."], ["산지픽 관리자에서는 산지픽 카테고리로 등록됩니다."], ["상태: draft/active/soldout, 배송유형: paid/free"]];
    const ws = XLSX.utils.aoa_to_sheet(help);
    // 컬럼 너비 설정
    ws["!cols"] = [
        { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
        { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "입력안내");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new Response(buf, {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": "attachment; filename=blendpick_product_template.xlsx",
        },
    });
}
