import { productStage, STAGE_LABEL, linkStage } from "@/lib/admin-workflow";
import Link from "next/link";
import shopPool from "@/lib/db-shop";
import ProductDeleteButton from "@/components/admin/ProductDeleteButton";
import ProductCodeCopy from "@/components/admin/ProductCodeCopy";
import SecretLinkCopy from "@/components/admin/SecretLinkCopy";
import { sanjiSecretLinkUrl } from "@/lib/secret-link";
import { currentAdminSite, adminProductScopeSql } from "@/lib/admin-site";
import type { SiteKey } from "@/lib/sites";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:  { label: "판매중",  color: "bg-green-100 text-green-700" },
  draft:   { label: "준비중",  color: "bg-gray-100 text-gray-500" },
  soldout: { label: "품절",    color: "bg-red-100 text-red-500" },
};

// 접속 도메인 범위의 상품만 — 산지픽 어드민은 산지픽 카테고리, Shop 어드민은 그 외
async function getProducts(site: SiteKey) {
  const c = adminProductScopeSql(site, "category", 1);
  const result = await shopPool.query(`
    SELECT id, name, brand, category, sale_type, sale_start_at, sale_end_at, price, stock, status, main_image, product_code, created_at, link_price, link_code, link_start_at, link_end_at
    FROM products_shop
    WHERE ${c.sql} AND archived_at IS NULL
    ORDER BY created_at DESC
  `, [c.param]);
  return result.rows;
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?:string; category?:string; sale?:string; link?:string }>;
}) {
  const site = await currentAdminSite();
  const all = await getProducts(site.key);
  const filters = await searchParams;
  const f = filters.f ?? "selling";
  const now = Date.now();
  // 재고 확인 필요 = 판매중인데 재고 0 (이상 상태 경고)
  const warn = all.filter((p) => p.status === "active" && Number(p.stock) === 0);
  // 비전시 링크 = 상품은 평소처럼 전시되고, 전용 가격으로 파는 비공개 링크가 발급된 상품
  const linked = all.filter((p) => !!p.link_code && p.link_end_at && new Date(p.link_end_at).getTime() > Date.now());
  const counts = {
    all: all.length,
    active: all.filter((p) => p.status === "active").length,
    soldout: all.filter((p) => p.status === "soldout").length,
    warn: warn.length,
    linked: linked.length,
  };
  const products = all.filter(p=> {
    if (f === "active" ? productStage(p,now)!=="selling" : f === "soldout" ? productStage(p,now)!=="closed" : f === "warn" ? !(p.status==="active"&&Number(p.stock)===0) : f === "linked" ? linkStage(p,now)==="없음" : ["ready","selling","closed"].includes(f) && productStage(p,now)!==f) return false;
    if(filters.category && p.category!==filters.category)return false;
    if(filters.sale && p.sale_type!==filters.sale)return false;
    if(filters.link && linkStage(p,now)!==filters.link)return false;
    return !filters.q || [p.name,p.brand,p.product_code].some(v=>String(v||'').toLowerCase().includes(filters.q!.toLowerCase()));
  });
  const TABS = (["ready","selling","closed"] as const).map(key=>({key,label:`${STAGE_LABEL[key]} ${all.filter(p=>productStage(p,now)===key).length}`,warn:false}));
  function tabUrl(key:string){const p=new URLSearchParams();for(const [k,v] of Object.entries(filters))if(v)p.set(k,v);p.set('f',key);return '/admin/products?'+p;}


  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1A1D18]">{site.key === "sanjipick" ? "산지픽 상품 관리" : "상품 관리"}</h1>
          <p className="text-sm text-gray-400 mt-0.5">총 {counts.all}개 상품{site.key === "sanjipick" ? " · 산지 직송 상품만 표시" : ""}</p>
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
            <Link key={t.key} href={tabUrl(t.key)}
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

      <form className="mb-4 rounded-xl border bg-white p-4 flex flex-wrap gap-3" action="/admin/products">
        <input type="hidden" name="f" value={f}/><input name="q" defaultValue={filters.q} placeholder="상품명·브랜드·코드 검색" aria-label="상품 검색" className="border rounded-lg px-3 py-2"/>
        <details className="text-sm"><summary className="cursor-pointer py-2">상세 필터</summary><div className="flex flex-wrap gap-2 py-2">
          <select name="category" defaultValue={filters.category||''} aria-label="상품 분류" className="border p-2"><option value="">분류 전체</option>{[...new Set(all.map(p=>p.category).filter(Boolean))].map(c=><option key={c} value={c}>{c}</option>)}</select>
          <select name="sale" defaultValue={filters.sale||''} aria-label="판매 방식" className="border p-2"><option value="">판매방식 전체</option><option value="always">상시 판매</option><option value="groupbuy">공동구매</option></select>
          {site.key==='sanjipick'&&<select name="link" defaultValue={filters.link||''} aria-label="비전시 링크" className="border p-2"><option value="">비전시 링크 전체</option>{['없음','예약','사용 중','만료'].map(v=><option key={v}>{v}</option>)}</select>}
        </div></details><button className="rounded-lg bg-stone-800 text-white px-4 py-2">조회</button><a className="text-sm underline p-2" href="/admin/products?f=all">전체 이력</a>
      </form>
      {/* 테이블 */}
      <div className="bg-white rounded-none border border-gray-100 overflow-x-auto">
        {products.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            조건에 맞는 상품이 없어요
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
                const stage = productStage(p,now);
                const s = {label:STAGE_LABEL[stage],color:stage==="selling"?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"};
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
                      {p.link_code && p.link_end_at && new Date(p.link_end_at).getTime() > Date.now() && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[#2D5A27]" title="비전시 링크로 들어왔을 때 적용되는 가격">
                          비전시 · 옵션별 설정
                          <SecretLinkCopy url={sanjiSecretLinkUrl(p.id, p.link_code)} />
                        </div>
                      )}
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
