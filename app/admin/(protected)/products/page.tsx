import Link from "next/link";
import shopPool from "@/lib/db-shop";
import ProductDeleteButton from "@/components/admin/ProductDeleteButton";
import ProductCodeCopy from "@/components/admin/ProductCodeCopy";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:  { label: "판매중",  color: "bg-green-100 text-green-700" },
  draft:   { label: "준비중",  color: "bg-gray-100 text-gray-500" },
  soldout: { label: "품절",    color: "bg-red-100 text-red-500" },
};

async function getProducts() {
  const result = await shopPool.query(`
    SELECT id, name, brand, price, stock, status, main_image, product_code, created_at
    FROM products_shop
    ORDER BY created_at DESC
  `);
  return result.rows;
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const all = await getProducts();
  const { f = "" } = await searchParams;
  // 재고 확인 필요 = 판매중인데 재고 0 (이상 상태 경고)
  const warn = all.filter((p) => p.status === "active" && Number(p.stock) === 0);
  const counts = {
    all: all.length,
    active: all.filter((p) => p.status === "active").length,
    soldout: all.filter((p) => p.status === "soldout").length,
    warn: warn.length,
  };
  const products =
    f === "active" ? all.filter((p) => p.status === "active")
    : f === "soldout" ? all.filter((p) => p.status === "soldout")
    : f === "warn" ? warn
    : all;
  const TABS = [
    { key: "", label: `전체 ${counts.all}` },
    { key: "active", label: `판매중 ${counts.active}` },
    { key: "soldout", label: `품절 ${counts.soldout}` },
    { key: "warn", label: `재고 확인 필요 ${counts.warn}`, warn: true },
  ];

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1A1D18]">상품 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">총 {counts.all}개 상품</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/categories"
            className="border border-gray-200 text-gray-600 text-sm font-bold px-4 py-2 rounded-none hover:bg-gray-50 transition-colors"
          >
            카테고리 관리
          </Link>
          <Link
            href="/admin/products/import"
            className="border border-gray-200 text-gray-600 text-sm font-bold px-4 py-2 rounded-none hover:bg-gray-50 transition-colors"
          >
            엑셀 일괄 업로드
          </Link>
          <Link
            href="/admin/products/new"
            className="bg-[#2D5A27] hover:bg-[#244B1F] text-white text-sm font-bold px-4 py-2 rounded-none transition-colors"
          >
            + 상품 등록
          </Link>
        </div>
      </div>

      {/* 탭 필터 */}
      <div className="flex mb-4">
        {TABS.map((t, i) => {
          const active = f === t.key;
          return (
            <Link key={t.key} href={t.key ? `/admin/products?f=${t.key}` : "/admin/products"}
              className="px-4 py-2 text-xs font-semibold transition-colors"
              style={{
                border: "1px solid",
                marginLeft: i > 0 ? "-1px" : 0,
                background: active ? "#1A1D18" : "#fff",
                color: active ? "#fff" : t.warn ? "#A6412F" : "#5C6156",
                borderColor: active ? "#1A1D18" : "#D6D6CF",
              }}>
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-none border border-gray-100 overflow-x-auto">
        {products.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            등록된 상품이 없어요
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">상품</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">코드</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">가격</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">재고</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">상태</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">등록일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => {
                const s = STATUS_LABEL[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-500" };
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.main_image ? (
                          <img src={p.main_image} alt={p.name} className="w-10 h-10 rounded-none object-cover bg-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-none bg-gray-100 flex items-center justify-center text-gray-300 text-lg">□</div>
                        )}
                        <div>
                          <a
                            href={`/products/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-gray-900 truncate max-w-xs block hover:text-[#244B1F] hover:underline"
                            title="공개 상품 페이지 열기"
                          >
                            {p.name}
                          </a>
                          {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.product_code
                        ? <ProductCodeCopy code={p.product_code} />
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {Number(p.price).toLocaleString()}원
                    </td>
                    <td className="px-4 py-3">
                      {p.status === "active" && Number(p.stock) === 0
                        ? <span className="ds-mono font-semibold" style={{ color: "#A6412F" }}>0개 ⚠</span>
                        : <span className="text-gray-600 ds-mono">{p.stock}개</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.color}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(p.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="text-xs text-[#2D5A27] font-bold hover:text-[#244B1F]"
                        >
                          수정
                        </Link>
                        <ProductDeleteButton id={p.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 이상 상태 경고 — 판매중인데 재고 0 */}
      {warn.length > 0 && (
        <div className="mt-4 px-5 py-3.5 text-xs bg-white" style={{ borderLeft: "3px solid #A6412F", border: "1px solid #E2E2DC", borderLeftWidth: "3px", borderLeftColor: "#A6412F", color: "#5C6156" }}>
          <b style={{ color: "#A6412F" }}>재고 확인 필요</b> — {warn.map((p) => p.product_code || p.name.slice(0, 14)).join(", ")} 상품이 판매중 상태이지만 재고가 0입니다. 품절 처리하거나 재고를 입력해 주세요.
        </div>
      )}
    </div>
  );
}
