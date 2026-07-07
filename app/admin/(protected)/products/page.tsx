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

export default async function AdminProductsPage() {
  const products = await getProducts();

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">상품 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">총 {products.length}개 상품</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/categories"
            className="border border-gray-200 text-gray-600 text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            카테고리 관리
          </Link>
          <Link
            href="/admin/products/import"
            className="border border-gray-200 text-gray-600 text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            엑셀 일괄 업로드
          </Link>
          <Link
            href="/admin/products/new"
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            + 상품 등록
          </Link>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {products.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            등록된 상품이 없어요
          </div>
        ) : (
          <table className="w-full text-sm">
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
                          <img src={p.main_image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-lg">□</div>
                        )}
                        <div>
                          <a
                            href={`/products/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-gray-900 truncate max-w-xs block hover:text-orange-600 hover:underline"
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
                    <td className="px-4 py-3 text-gray-600">{p.stock}개</td>
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
                          className="text-xs text-orange-500 font-bold hover:text-orange-600"
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
    </div>
  );
}
