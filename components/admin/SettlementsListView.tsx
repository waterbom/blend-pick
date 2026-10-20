import Link from "next/link";
import MetricChart from "@/components/admin/charts/MetricChart";
import { settlementPoints } from "@/lib/admin-chart-data";
import { settlementTotal } from "@/lib/settlement-period";
import { settlementList, SETTLEMENT_PERIODS, type SettlementListFilters, type SettlementListRow } from "@/lib/admin-settlement-list";

export default function SettlementsListView({ all, filters, now }: { all: SettlementListRow[] | null; filters: SettlementListFilters; now: string }) {
  const date = new Date(now), view = settlementList(all ?? [], filters, date);
  const unresolved = view.selected.filter(r => r.unresolved || r.net_amount == null).length;
  const fee = view.selected.reduce((n, r) => n + r.fee, 0);
  const estimated = view.selected.filter(r => r.fee_estimated).length;
  const href = (patch: Partial<SettlementListFilters>) => {
    const params = new URLSearchParams();
    Object.entries({ ...filters, period: view.period, check: view.check, page: undefined, ...patch }).forEach(([key, value]) => { if (value) params.set(key, value); });
    return "/admin/settlements" + (params.size ? `?${params}` : "");
  };
  return <div className="ops-workspace">
    <header className="ops-page-heading"><div><h1>매출·정산</h1><p>정산 예상액과 주문별 확인 사항을 함께 확인하세요.</p></div><div className="ops-heading-actions"><Link className="ops-button" href="/admin/profit">원가·수익</Link><Link className="ops-button" href="/admin/link-sales">상품별 실적</Link><Link className="ops-button" href="/admin/influencer-settlements">파트너 정산</Link></div></header>
    {all === null ? <div role="alert" className="ops-error">정산 내역을 불러오지 못했습니다. <Link className="ops-button" href={href({})}>다시 조회</Link></div> : <>
      <div className="ops-summary-grid">{SETTLEMENT_PERIODS.map(p => {
        const total = settlementTotal(all, p.key, date);
        return <Link key={p.key} href={href({period:p.key})} aria-current={view.period === p.key ? "page" : undefined}><span>{p.label} 정산 예상액</span><strong>{total == null ? "확인 필요" : <>{total.toLocaleString()}<small>원</small></>}</strong><small>{p.key ? "한국시간 정산일 기준" : "전체 정산 내역 기준"}</small></Link>;
      })}</div>
      <section className="ops-list-panel" aria-label="정산 목록">
        <div className="ops-filter-strip"><Link className="ops-filter-chip" aria-current={!view.check ? "page" : undefined} href={href({check:""})}>기간 내 전체 <b>{view.selected.length}</b></Link><Link className="ops-filter-chip ops-filter-warning" aria-current={view.check ? "page" : undefined} href={href({check:"unresolved"})}>환불 확인 필요 <b>{unresolved}</b></Link></div>
        <form className="ops-toolbar" action="/admin/settlements" method="get"><input type="hidden" name="period" value={view.period} /><input type="hidden" name="check" value={view.check} /><input key={filters.q ?? ""} className="ops-search" type="search" name="q" defaultValue={filters.q ?? ""} aria-label="정산 검색" placeholder="주문번호·구매자 검색" /><button className="ops-button ops-button-primary" type="submit">검색</button>{filters.q && <Link className="ops-text-button" href={href({q:""})}>검색 초기화</Link>}</form>
        <div className="ops-sales-summary"><strong>검색 결과 {view.filtered.length.toLocaleString()}건</strong><span>선택 기간 수수료 <b>{unresolved ? "확인 필요" : `${fee.toLocaleString()}원`}</b>{!unresolved && estimated > 0 && ` · 추정 수수료 ${estimated}건 포함`}</span><small>수수료·상단 합계는 검색 전 기간 전체 기준</small></div>
        {view.rows.length === 0 ? <p className="ops-empty">조건에 맞는 정산 내역이 없습니다</p> : <div className="ops-table-scroll"><table className="ops-table ops-settlements-table"><thead><tr>{["주문 · 정산일", "구매자", "환불 반영 금액", "수수료", "정산 예상액"].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{view.rows.map(r => <tr key={r.id}>
          <td><Link className="ops-product-title" href={`/admin/orders/${encodeURIComponent(r.order_id)}`}>{r.order_number || "주문 확인"}</Link><span className="ops-meta">{new Date(r.settled_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</span></td><td>{r.buyer_name || "—"}</td>
          <td className="ops-nowrap">{r.unresolved ? <span className="ops-warning">환불 확인 필요</span> : `${r.gross_amount.toLocaleString()}원`}</td><td className="ops-nowrap">{r.unresolved ? "—" : `−${r.fee.toLocaleString()}원`}{r.fee_estimated && <span className="ops-meta">추정 수수료</span>}</td>
          <td className="ops-nowrap">{r.net_amount == null ? <span className="ops-status ops-status-cancel_requested">환불 확인 필요</span> : <strong>{r.net_amount.toLocaleString()}원</strong>}</td>
        </tr>)}</tbody></table></div>}
        {view.pages > 1 && <nav className="ops-pagination" aria-label="정산 페이지">{view.page > 1 && <Link className="ops-button" href={href({page:String(view.page-1)})}>이전</Link>}<span>{view.page} / {view.pages} 페이지 · 최대 50건씩 표시</span>{view.page < view.pages && <Link className="ops-button" href={href({page:String(view.page+1)})}>다음</Link>}</nav>}
      </section>
      <p className="ops-meta">배송완료로 생성된 내역의 환불을 반영한 예상액입니다. PG 실제 입금액과 대조가 필요합니다. 환불 미확인 건이 포함된 기간 합계는 ‘확인 필요’로 표시합니다.</p>
      <details className="ops-list-panel ops-analysis-details"><summary>기간별 정산 추이 보기 <span>선택 기간 전체 · 검색 조건 제외</span></summary><MetricChart title="정산 예상액·수수료 추이" description="한국시간 정산일 기준 · 60일 초과 범위는 월별 · 환불 미확인 구간은 빈 값" points={settlementPoints(view.selected)} series={[{label:"정산 예상액",color:"#315e43"},{label:"수수료",color:"#b87a28"}]} unit="won" kind="bar" /></details>
    </>}
  </div>;
}
