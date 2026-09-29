import { productStage, STAGE_LABEL, linkStage } from "@/lib/admin-workflow";
import Link from "next/link";
import shopPool from "@/lib/db-shop";
import ProductDeleteButton from "@/components/admin/ProductDeleteButton";
import ProductCodeCopy from "@/components/admin/ProductCodeCopy";
import SecretLinkCopy from "@/components/admin/SecretLinkCopy";
import { sanjiSecretLinkUrl } from "@/lib/secret-link";
import { currentAdminSite, adminProductScopeSql } from "@/lib/admin-site";
import type { SiteKey } from "@/lib/sites";
import { emptySalesCounts, getProductSales, type ProductSales } from "@/lib/product-sales";
import { validDateRange } from "@/lib/order-finance";
import ProductSalesCell from "@/components/admin/ProductSalesCell";

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
  // 조회 시각도 함께 — 판매 단계·링크 상태 판정 기준 (렌더 중 Date.now() 호출을 피해 데이터 로딩 단계에서 한 번만)
  return { rows: result.rows, now: Date.now() };
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?:string; category?:string; sale?:string; link?:string; from?:string; to?:string }>;
}) {
  const site = await currentAdminSite();
  const { rows: all, now } = await getProducts(site.key);
  const filters = await searchParams;
  const f = filters.f ?? "selling";
  // 재고 확인 필요 = 판매중인데 재고 0 (이상 상태 경고)
  const warn = all.filter((p) => p.status === "active" && Number(p.stock) === 0);
  // 비전시 링크 = 상품은 평소처럼 전시되고, 전용 가격으로 파는 비공개 링크가 발급된 상품
  const linked = all.filter((p) => !!p.link_code && p.link_end_at && new Date(p.link_end_at).getTime() > now);
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
  const from = typeof filters.from === "string" ? filters.from : "";
  const to = typeof filters.to === "string" ? filters.to : "";
  let sales: Map<string, ProductSales> | null = null;
  let salesError = "";
  if ((filters.from !== undefined && typeof filters.from !== "string") ||
      (filters.to !== undefined && typeof filters.to !== "string") || !validDateRange(from || null, to || null)) {
    salesError = "판매 집계 기간을 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.";
  } else {
    try { sales = await getProductSales(site.key, from, to); }
    catch (error) { console.error("[admin/products] sales lookup failed", error); salesError = "판매량을 불러오지 못했습니다. 잠시 후 다시 조회해주세요."; }
  }
  const totals = products.reduce((sum, p) => {
    const data = sales?.get(p.id);
    if (data) { sum.paid += data.paid; sum.sold += data.sold; sum.excluded += data.cancelled + data.returned; sum.review += data.review > 0 ? 1 : 0; }
    return sum;
  }, { paid: 0, sold: 0, excluded: 0, review: 0 });

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

      {/* 검색·상세 필터 — 어드민 공통 규격 (각진 카드 · 회색 경계선 · 딥그린 버튼) */}
      <form className="mb-4 bg-white rounded-none border border-gray-100 p-4 flex flex-wrap items-center gap-2" action="/admin/products">
        <input type="hidden" name="f" value={f} />
        <input name="q" defaultValue={filters.q} placeholder="상품명 · 브랜드 · 코드 검색" aria-label="상품 검색"
          className="w-64 border border-gray-200 rounded-none px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C7D6C0]" />
        <select name="category" defaultValue={filters.category || ""} aria-label="상품 분류"
          className="border border-gray-200 rounded-none px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#C7D6C0]">
          <option value="">분류 전체</option>
          {[...new Set(all.map((p) => p.category).filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="sale" defaultValue={filters.sale || ""} aria-label="판매 방식"
          className="border border-gray-200 rounded-none px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#C7D6C0]">
          <option value="">판매방식 전체</option><option value="always">상시 판매</option><option value="groupbuy">공동구매</option>
        </select>
        {site.key === "sanjipick" && (
          <select name="link" defaultValue={filters.link || ""} aria-label="비전시 링크"
            className="border border-gray-200 rounded-none px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#C7D6C0]">
            <option value="">비전시 링크 전체</option>
            {["없음", "예약", "사용 중", "만료"].map((v) => <option key={v}>{v}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-xs text-gray-600">결제일 시작
          <input type="date" name="from" defaultValue={from} className="border border-gray-200 px-2 py-2 text-sm bg-white" />
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">종료
          <input type="date" name="to" defaultValue={to} className="border border-gray-200 px-2 py-2 text-sm bg-white" />
        </label>
        <button className="bg-[#2D5A27] hover:bg-[#244B1F] text-white text-sm font-bold px-4 py-2 rounded-none transition-colors">조회</button>
        <Link href="/admin/products?f=all" className="text-xs font-bold text-gray-500 hover:text-gray-800 px-2 py-2">전체 이력</Link>
        <span className="ml-auto ds-mono text-[11px] text-gray-400">{products.length}개 표시</span>
      </form>
      <section aria-label="상품별 판매량" className="mb-4 border border-gray-100 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#1A1D18]">상품별 판매량</h2>
          <span className="text-xs text-gray-500">현재 표시된 {products.length}개 상품 · {from || "전체"} ~ {to || "현재"} · 한국시간 결제일 기준</span>
        </div>
        {salesError ? <p role="alert" className="text-sm text-red-600">{salesError}</p> : (
          <dl className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[{ label: `판매 수량${totals.review ? " (잠정)" : ""}`, value: totals.sold }, { label: "결제 수량", value: totals.paid }, { label: "취소·반품 완료 수량", value: totals.excluded }].map(metric => (
              <div key={metric.label} className="bg-gray-50 p-3"><dt className="text-xs text-gray-500">{metric.label}</dt><dd className="mt-1 text-lg font-bold text-[#2D5A27] ds-mono">{metric.value.toLocaleString("ko-KR")}개</dd></div>
            ))}
          </dl>
        )}
        <p className="text-xs leading-5 text-gray-500">판매 수량 = 결제 수량 − 취소 완료 − 반품 완료. 미결제·테스트 결제·추가상품·설치비는 제외하며, 주문 당시 선택 수량으로 집계합니다. 취소·반품 진행 중인 수량은 완료 전까지 포함됩니다.</p>
        <p className="text-xs leading-5 text-gray-500">반품은 해당 주문 상품의 완료 수량만 차감합니다. 환불 처리 중이거나 수량 기록이 불명확하면 ‘잠정’으로 표시하며, 환불 금액으로 수량을 추정하지 않습니다.</p>
      </section>
      {/* 테이블 */}
      <div className="bg-white rounded-none border border-gray-100 overflow-x-auto">
        {products.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            조건에 맞는 상품이 없어요
          </div>
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">상품</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">코드</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">가격</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">재고</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">판매 수량</th>
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
                          <img src={p.main_image} alt={p.name} className="w-10 h-10 rounded-none object-contain bg-gray-100" />
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
                      {p.link_code && p.link_end_at && new Date(p.link_end_at).getTime() > now && (
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
                      <ProductSalesCell sales={sales ? sales.get(p.id) ?? { ...emptySalesCounts(), options: [] } : null} />
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
