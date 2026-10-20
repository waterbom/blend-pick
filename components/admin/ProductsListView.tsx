import Link from 'next/link';
import ProductDeleteButton from '@/components/admin/ProductDeleteButton';
import ProductCodeCopy from '@/components/admin/ProductCodeCopy';
import SecretLinkCopy from '@/components/admin/SecretLinkCopy';
import ProductSalesCell from '@/components/admin/ProductSalesCell';
import { sanjiSecretLinkUrl } from '@/lib/secret-link';
import { productStage, STAGE_LABEL, linkStage } from '@/lib/admin-workflow';
import { productListView, type ProductListItem, type ProductListFilters } from '@/lib/admin-product-list';
import type { ProductSales } from '@/lib/product-sales';
import { SITES, type SiteKey } from '@/lib/sites';

export default function ProductsListView({all, now, filters, sales, salesError, site}: {
  all: ProductListItem[]; now: number; filters: ProductListFilters;
  sales: Record<string,ProductSales> | null; salesError: string; site: SiteKey;
}) {
  const {stage:f, counts, products}=productListView(all,filters,now);
  const from=filters.from||'',to=filters.to||'';
  const totals=products.reduce((sum,p)=>{const data=sales?.[p.id];if(data){sum.sold+=data.sold;sum.paid+=data.paid;sum.excluded+=data.cancelled+data.returned;sum.review+=data.review>0?1:0;}return sum;},{sold:0,paid:0,excluded:0,review:0});
  function filterUrl(stage:string){const p=new URLSearchParams();for(const [key,value]of Object.entries(filters))if(value)p.set(key,value);p.set('f',stage);return '/admin/products?'+p;}
  const date=(value:string)=>new Date(value).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
  return <div className="ops-workspace">
    <header className="ops-page-heading"><div><h1>상품 관리</h1><p>{SITES[site].name} · 총 {counts.all}개 상품 · 판매 상태와 실적을 함께 확인합니다.</p></div><div className="ops-heading-actions"><Link className="ops-text-button" href="/admin/categories">카테고리</Link><Link className="ops-button" href="/admin/products/import">엑셀 업로드</Link><Link className="ops-button ops-button-primary" href="/admin/products/new">+ 상품 등록</Link></div></header>
    <section className="ops-list-panel" aria-label="상품 목록">
      <nav className="ops-filter-strip" aria-label="상품 판매 상태">
        {([{key:'selling',label:'판매 중'},{key:'ready',label:'판매 준비'},{key:'closed',label:'판매 종료'},{key:'all',label:'전체 상품'},{key:'warn',label:'재고 확인'}] as const).map(t=><Link key={t.key} href={filterUrl(t.key)} aria-current={f===t.key?'page':undefined} className={`ops-filter-chip ${t.key==='warn'&&counts.warn?'ops-filter-warning':''}`}>{t.label}<b>{counts[t.key]}</b></Link>)}
      </nav>
      <form action="/admin/products" className="ops-product-filters" key={JSON.stringify(filters)}>
        <input type="hidden" name="f" value={f}/>
        <div className="ops-toolbar"><input name="q" aria-label="상품 검색" className="ops-search" defaultValue={filters.q} placeholder="상품명 · 브랜드 · 코드 검색"/><select name="category" defaultValue={filters.category||''} aria-label="상품 분류"><option value="">분류 전체</option>{[...new Set(all.map(p=>p.category).filter(Boolean))].map(c=><option key={c} value={c!}>{c}</option>)}</select><select name="sale" defaultValue={filters.sale||''} aria-label="판매 방식"><option value="">판매방식 전체</option><option value="always">상시 판매</option><option value="groupbuy">공동구매</option></select>{site==='sanjipick'&&<select name="link" defaultValue={filters.link||''} aria-label="비전시 링크"><option value="">비전시 링크 전체</option>{['없음','예약','사용 중','만료'].map(v=><option key={v}>{v}</option>)}</select>}<button className="ops-button ops-button-primary">조회</button><Link href="/admin/products?f=all" className="ops-text-button">초기화</Link></div>
        <div className="ops-period-row"><span>판매량 집계 기간</span><label>결제일 시작 <input type="date" name="from" defaultValue={from}/></label><label>종료 <input type="date" name="to" defaultValue={to}/></label><small>한국시간 · 기간 변경 후 조회</small></div>
      </form>
      <div className="ops-sales-summary" aria-label="상품별 판매량"><strong>{products.length}개 상품 표시</strong>{salesError?<p role="alert" className="ops-warning">{salesError}</p>:<><span>판매 수량{totals.review?' (잠정)':''} <b>{totals.sold.toLocaleString()}개</b></span><span>결제 <b>{totals.paid.toLocaleString()}개</b></span><span>취소·반품 완료 <b>{totals.excluded.toLocaleString()}개</b></span></>}<small>{from||'전체 기간'} ~ {to||'현재'}</small></div>
      {!products.length?<p className="ops-empty">조건에 맞는 상품이 없습니다.</p>:<div className="ops-table-scroll"><table className="ops-table ops-products-table"><thead><tr><th>상품 · 코드</th><th>판매 가격</th><th>재고</th><th>판매 수량</th><th>판매 상태 · 일정</th><th>관리</th></tr></thead><tbody>{products.map(p=>{
        const stage=productStage(p,now),link=linkStage(p,now),warn=p.status==='active'&&Number(p.stock)===0;
        return <tr key={p.id}><td><div className="ops-product-name">{p.main_image?<img src={p.main_image} alt="" loading="lazy"/>:<span className="ops-product-placeholder" aria-hidden="true">□</span>}<div><Link href={`/admin/products/${p.id}`} className="ops-product-title">{p.name}</Link><span className="ops-meta">{[p.brand,p.category].filter(Boolean).join(' · ')||'분류 미지정'}</span>{p.product_code&&<ProductCodeCopy code={p.product_code}/>}</div></div></td>
          <td className="ops-nowrap"><strong>{Number(p.price).toLocaleString()}원</strong>{site==='sanjipick'&&p.link_code&&link!=='만료'&&<span className="ops-meta">비전시 {link} <SecretLinkCopy url={sanjiSecretLinkUrl(p.id,p.link_code)}/></span>}</td>
          <td><strong className={warn?'ops-warning':''}>{Number(p.stock).toLocaleString()}개</strong>{warn&&<span className="ops-warning ops-meta">품절 처리·재고 보완</span>}</td>
          <td><ProductSalesCell sales={sales?.[p.id]??null}/></td>
          <td><span className={`ops-status ops-status-${stage}`}>{STAGE_LABEL[stage]}</span><span className="ops-meta">{p.sale_type==='groupbuy'?'공동구매':'상시 판매'}</span>{(p.sale_start_at||p.sale_end_at)&&<span className="ops-meta">{p.sale_start_at?date(p.sale_start_at):'시작일 미지정'}<br/>~ {p.sale_end_at?date(p.sale_end_at):'종료일 미지정'}</span>}</td>
          <td><div className="ops-row-actions"><Link href={`/admin/products/${p.id}`}>수정</Link><a href={`/products/${p.id}`} target="_blank" rel="noopener noreferrer">상품 보기 ↗</a><ProductDeleteButton id={p.id}/></div></td>
        </tr>;
      })}</tbody></table></div>}
    </section>
    <details className="ops-details ops-sales-definition"><summary>판매량 집계 기준·잠정 수량 안내</summary><p>판매 수량 = 결제 수량 − 취소 완료 − 반품 완료. 현재 표시된 상품만 합산합니다. 미결제·테스트 결제·추가상품·설치비는 제외하며 주문 당시 선택 수량을 사용합니다.</p><p>진행 중인 취소·반품 수량은 완료 전까지 포함합니다. 반품은 해당 주문 상품의 완료 수량만 차감합니다. 환불 처리 중이거나 수량 기록이 불명확하면 ‘잠정’으로 표시하고, 환불 금액으로 수량을 추정하지 않습니다.</p></details>
  </div>;
}
