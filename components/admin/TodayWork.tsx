import type { WorkGroup } from "@/lib/operations";

export default function TodayWork({ siteName, groups, updatedAt }: { siteName: string; groups: WorkGroup[]; updatedAt: string }) {
  const count = groups.reduce((sum, group) => sum + group.total, 0);
  return <div className="today-work">
    <style>{`
      .today-work{max-width:1100px;margin:auto;color:#1A291C;font-family:inherit}
      .today-work *{box-sizing:border-box}.today-work a{color:inherit;text-decoration:none}.today-work a:focus-visible,.today-work summary:focus-visible{outline:3px solid #2F5D34;outline-offset:5px}
      .today-work header{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:24px;flex-wrap:wrap}
      .today-work h1{font-size:30px;font-weight:800;margin:6px 0 10px;letter-spacing:-.04em}
      .today-work p{font-size:14px;line-height:1.7;color:#586451;margin:0}
      .today-work .brand{font-size:13px;color:#2F5D34;font-weight:700;letter-spacing:.05em}
      .today-work .refresh{font-size:14px;border:1px solid #CDD5C8;background:white;padding:10px 16px;border-radius:8px}
      .today-work .brief{background:#244B30;color:white;padding:20px 24px;border-radius:12px;margin-bottom:20px}.today-work .brief strong{font-size:18px}.today-work .brief p{color:#E0EADF;margin-top:7px}
      .today-work .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:26px}
      .today-work .metric{background:white;border:1px solid #DEE3D8;padding:18px;border-radius:12px}.today-work .metric:hover{border-color:#2F5D34}
      .today-work .metric strong{display:block;font-size:32px;margin:10px 0 4px;font-variant-numeric:tabular-nums}
      .today-work details{background:white;border:1px solid #DEE3D8;border-radius:12px;margin-bottom:16px;padding:0 22px;scroll-margin-top:20px}
      .today-work summary{padding:20px 0;cursor:pointer;font-weight:700;font-size:17px}.today-work .explain{padding-bottom:14px}
      .today-work .steps{display:flex;gap:22px;flex-wrap:wrap;margin:0 0 18px;padding:14px 14px 14px 34px;list-style:decimal;background:#F4F6F0;border-radius:8px;font-size:13px;line-height:1.6}.today-work .steps li{padding-right:8px}
      .today-work .row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px;border-top:1px solid #E5EADF;padding:20px 0;font-size:14px}
      .today-work .item-title{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:9px}.today-work .item-title strong{overflow-wrap:anywhere}.today-work .priority{display:inline-block;font-size:11px;font-weight:700;padding:4px 8px;border-radius:5px;background:#EDF1E8;color:#526047}.today-work .priority.first{background:#FFF0DE;color:#905000}
      .today-work .row .reason{font-weight:700;color:#263B29}.today-work .row .elapsed{font-size:12px;color:#69745F;margin:4px 0 9px}.today-work .row .next{font-size:13px;color:#45543E}.today-work .next b{color:#244B30;margin-right:7px}
      .today-work .action{display:block;flex-shrink:0;color:#2F5D34;border:1px solid #B9CBB2;padding:11px 14px;border-radius:8px;font-size:13px;font-weight:700;text-align:center}.today-work .action:hover{background:#F0F5EB}
      .today-work .resolved{border-top:1px solid #E5EADF;padding:14px 0 20px;font-size:12px}.today-work .resolved b{color:#45543E}.today-work .zero{padding:12px 0 22px;font-size:14px;color:#69745F}.today-work .footnote{font-size:12px;padding-bottom:20px}
      @media(max-width:700px){.today-work .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.today-work h1{font-size:25px}.today-work .metric{padding:14px 12px}.today-work details{padding:0 16px}.today-work .row{grid-template-columns:1fr;gap:12px}.today-work .action{justify-self:start}.today-work .steps{display:block}.today-work .steps li+li{margin-top:6px}.today-work .brief{padding:18px}.today-work .brief strong{font-size:16px}}
    `}</style>
    <header><div><span className="brand">{siteName} 운영</span><h1>오늘 처리할 일</h1><p>{updatedAt} 기준 · 사유를 확인하고 해당 처리 화면으로 이동하세요.</p></div><a className="refresh" href="/admin/operations">목록 새로고침</a></header>
    <div className="brief"><strong>{count ? `확인할 항목 ${count}건 · 송장 누락과 품절부터 확인하세요` : '현재 기준에 해당하는 확인 항목이 없습니다'}</strong><p>‘먼저 확인’은 배송 조회가 막힌 주문과 재고 0개 상품입니다. 나머지는 각 항목의 정렬 순서대로 확인하세요.</p></div>
    <nav className="metrics" aria-label="업무별 바로가기">{groups.map(group => <a className="metric" href={`#work-${group.key}`} key={group.key}><p>{group.title}</p><strong>{group.total}<span style={{ fontSize: 15, fontWeight: 500 }}>건</span></strong><p>{group.total ? group.sortLabel : '확인할 항목 없음'}</p></a>)}</nav>
    {groups.map(group => <details key={group.key} id={`work-${group.key}`} open={group.total > 0}>
      <summary>{group.title} · {group.total}건</summary><p className="explain">{group.explanation}</p>
      {group.total > 0 && <ol className="steps" aria-label={`${group.title} 처리 순서`}>{group.steps.map(step => <li key={step}>{step}</li>)}</ol>}
      {group.items.map(item => <article className="row" key={item.id}>
        <div><div className="item-title"><span className={`priority ${item.priority}`}>{item.priority === 'first' ? '먼저 확인' : '오늘 확인'}</span><strong>{item.label}</strong></div>
          <p className="reason">{item.detail}</p><p className="elapsed">{item.elapsed}</p><p className="next"><b>다음 행동</b>{item.nextAction}</p></div>
        <a className="action" href={item.href} aria-label={`${item.label} ${item.actionLabel}`}>{item.actionLabel} →</a>
      </article>)}
      {!group.total && <div className="zero">확인할 항목이 없습니다.</div>}
      {group.total > group.items.length && <p className="zero">{group.sortLabel}으로 {group.total}건 중 {group.items.length}건을 표시합니다. 처리 후 새로고침하면 다음 항목을 확인할 수 있습니다.</p>}
      {group.total > 0 && <p className="resolved"><b>목록에서 빠지는 기준</b> · {group.resolvedWhen}</p>}
    </details>)}
    <p className="footnote">건수는 업무 항목의 합계이며 한 주문이 여러 항목에 표시될 수 있습니다. 미출고는 결제 후 경과 시간 기준으로, 약속된 출고일을 넘겼다는 의미는 아닙니다. 처리 화면에서 저장한 뒤 이 목록을 새로고침하세요.</p>
  </div>;
}
