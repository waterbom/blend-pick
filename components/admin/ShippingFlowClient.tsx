"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import OrdersClient, { type Order } from './OrdersClient';
import ShipmentsClient from './ShipmentsClient';
import { orderQueue } from '@/lib/admin-workflow';
import { shippingExceptions } from '@/lib/shipping-flow';
import { useSiteKey } from '@/components/SiteContext';
import { SITES } from '@/lib/sites';

const stages = [
  { key: 'ready', title: '발주 대기', note: '자동 검증 → 선택 후 발주 확정' },
  { key: 'preparing', title: '배송준비', note: '공급사 전달 → 송장 등록' },
  { key: 'shipped', title: '배송중', note: '자동 추적 → 배송완료 반영' },
  { key: 'delivered', title: '배송완료', note: '완료 주문 확인' },
] as const;

// 어드민 공통 규격 — 각진 카드(border-gray-100), 모노 캡션, 딥그린(#2D5A27) 강조, 섹션 제목은 카드 상단 바
const card = "bg-white rounded-none border border-gray-100";
const btnGhost = "border border-gray-200 bg-white text-gray-600 text-xs font-bold px-3 py-1.5 rounded-none hover:bg-gray-50 transition-colors";

function SectionTitle({ n, title, sub }: { n?: string; title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      {n && <span className="ds-mono text-[11px] font-semibold" style={{ color: "#8F948A", letterSpacing: "0.2em" }}>{n}</span>}
      <h2 className="text-sm font-bold" style={{ color: "#1A1D18" }}>{title}</h2>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

export default function ShippingFlowClient({initialTab, initialRequestId}: {initialTab?: 'preparing' | 'exchange_requested' | 'return_requested'; initialRequestId?: string}) {
  const site = useSiteKey();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [updated, setUpdated] = useState('');
  const active = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const refresh = useCallback((): Promise<void> => {
    if (active.current) return active.current;
    const task = (async () => {
      try {
        const response = await fetch('/api/admin/orders', {cache: 'no-store'});
        const rows = await response.json();
        if (!response.ok || !Array.isArray(rows)) throw Error('배송 현황을 불러오지 못했습니다. 다시 조회해주세요.');
        if (!mounted.current) return;
        setOrders(rows.filter((o: Order) => (o.site || 'blendpick') === site));
        setUpdated(new Date().toLocaleTimeString('ko-KR', {timeZone:'Asia/Seoul'}));
        setError(''); setLoaded(true);
      } catch(e) { if(mounted.current) setError(e instanceof Error ? e.message : '배송 현황 조회 실패'); }
    })().finally(() => { active.current = null; });
    active.current = task;
    return task;
  }, [site]);
  const afterChange = useCallback(async () => {
    if (active.current) await active.current;
    await refresh();
  }, [refresh]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const tick = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => { mounted.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [refresh]);
  useEffect(() => {
    if (loaded && initialTab && initialTab !== 'preparing') document.getElementById(`flow-${initialTab}`)?.scrollIntoView({block:'start'});
  }, [loaded, initialTab]);
  const exceptions = orders.map(order => ({order, issues:shippingExceptions(order)})).filter(row => row.issues.length);
  const stageCount = (key: typeof stages[number]['key']) =>
    orders.filter(o => key === 'ready' ? orderQueue(o) === 'ready' : o.status === key).length;

  return <div className="space-y-6">
    {/* 헤더 — 상품·판매 관리와 같은 제목 줄 + 단계 KPI 격자 */}
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1A1D18" }}>{SITES[site].name} {site === "sanjipick" ? "농가 출고·배송" : "배송 관리"}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            화면을 보는 동안 1분마다 현황 갱신 · 마지막 조회 <span className="ds-mono">{updated || '대기 중'}</span> (한국시간) · 배송 추적은 매일 07:30 · 19:30 자동 실행
          </p>
        </div>
        <button className={btnGhost} onClick={() => void refresh()}>현황 새로고침</button>
      </div>
      <nav aria-label="배송 단계 바로가기" className="grid grid-cols-2 xl:grid-cols-4 gap-px" style={{ background: "#E2E2DC", border: "1px solid #E2E2DC" }}>
        {stages.map((stage, i) => (
          <a key={stage.key} href={`#flow-${stage.key}`} className="bg-white p-5 hover:bg-[#F6F8F4] transition-colors">
            <p className="ds-mono text-[10px] mb-2.5" style={{ letterSpacing: "0.2em", color: "#8F948A" }}>{i + 1}. {stage.title}</p>
            <p className="text-2xl font-extrabold tnum" style={{ color: "#1A1D18" }}>
              {loaded ? stageCount(stage.key) : '—'}<span className="text-sm font-medium ml-0.5" style={{ color: "#8F948A" }}>건</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "#8F948A" }}>{stage.note}</p>
          </a>
        ))}
      </nav>
    </div>

    {error && (
      <p role="alert" className="px-4 py-3 text-xs font-semibold" style={{ background: "#FDF2F2", border: "1px solid #F0C9C9", color: "#B91C1C" }}>
        {error} {loaded && '마지막으로 조회된 현황입니다.'}
      </p>
    )}

    {loaded && <>
      {/* 자동 점검 — 재고 경고 박스와 같은 좌측 컬러 바 스타일 */}
      <section aria-label="자동 점검 결과" className="bg-white px-5 py-4 text-xs"
        style={{ border: "1px solid #E2E2DC", borderLeft: `3px solid ${exceptions.length ? "#A6412F" : "#2D5A27"}`, color: "#5C6156" }}>
        <b style={{ color: exceptions.length ? "#A6412F" : "#2D5A27" }}>먼저 확인 · {exceptions.length}건</b>
        {exceptions.length ? (
          <div className="mt-2 space-y-1.5">
            {exceptions.map(({order, issues}) => (
              <div key={order.id} className="flex flex-wrap items-center gap-3">
                <Link className="ds-mono font-bold text-[#2D5A27] hover:text-[#244B1F]" href={`/admin/orders/${order.id}`}>{order.order_number}</Link>
                <span>{issues.join(' · ')}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="ml-2">현재 주문 정보·송장·출고 예정일 점검에서 확인할 항목이 없습니다.</span>
        )}
      </section>

      <section id="flow-ready" className="scroll-mt-6">
        <SectionTitle n="01" title="발주 대기" sub="자동 검증 통과 주문 · 선택 후 발주 확정" />
        <OrdersClient sharedOrders={orders} onChanged={afterChange}/>
      </section>

      {stages.filter(stage => stage.key !== 'ready').map((stage, idx) => (
        <section key={stage.key} id={`flow-${stage.key}`} className="scroll-mt-6">
          <SectionTitle n={`0${idx + 2}`} title={stage.title}
            sub={stage.key === 'preparing' ? (site === 'sanjipick' ? '출고 농가·예정일 확인 → 발주 엑셀 전달 → 회신 송장 등록' : '발주 확정 이력에서 엑셀을 받아 공급사에 전달 → 회신받은 송장을 등록하면 상태가 갱신됩니다') : stage.note} />
          <ShipmentsClient initialTab={stage.key} sharedOrders={orders} onChanged={afterChange}/>
        </section>
      ))}

      <section className="space-y-5">
        <SectionTitle title="고객 요청 · 취소 / 교환 / 반품" />
        {(['cancel_requested','exchange_requested','return_requested'] as const).map(status => (
          <div key={status} id={`flow-${status}`} className="scroll-mt-6">
            <p className="text-xs font-bold text-gray-500 mb-2">{status==='cancel_requested'?'취소 요청':status==='exchange_requested'?'교환 신청':'반품 신청'}</p>
            <ShipmentsClient initialTab={status} sharedOrders={orders} onChanged={afterChange} initialRequestId={initialTab===status?initialRequestId:undefined}/>
          </div>
        ))}
      </section>

      <details className={`${card} px-5 py-3 text-xs`}>
        <summary className="cursor-pointer select-none font-bold text-gray-600 hover:text-gray-900">처리 완료 이력 · 취소 / 교환 / 반품</summary>
        {(['cancelled','exchange_completed','return_completed'] as const).map(status => (
          <section key={status} className="mt-4">
            <p className="text-xs font-bold text-gray-500 mb-2">{status==='cancelled'?'취소완료':status==='exchange_completed'?'교환완료':'반품완료'}</p>
            <ShipmentsClient initialTab={status} sharedOrders={orders} onChanged={afterChange}/>
          </section>
        ))}
      </details>
    </>}
  </div>;
}
