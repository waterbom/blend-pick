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
  return <div className="space-y-6">
    <header className="bg-white border p-5 space-y-3">
      <div className="flex flex-wrap justify-between gap-3"><h1 className="text-xl font-bold">{SITES[site].name} 배송 흐름</h1><button className="border px-3 py-2 text-sm" onClick={() => void refresh()}>현황 새로고침</button></div>
      <p className="text-sm text-gray-600">화면을 보는 동안 1분마다 현황 갱신 · 마지막 조회 {updated || '대기 중'} (한국시간)</p>
      <p className="text-sm text-gray-600">배송 추적은 매일 07:30·19:30 자동 실행 예정입니다. 발주 확정과 공급사 전달은 담당자가 진행합니다.</p>
      <nav aria-label="배송 단계 바로가기" className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stages.map((stage, i) => <a key={stage.key} href={`#flow-${stage.key}`} className="border p-4 hover:bg-green-50"><span className="text-sm">{i+1}. {stage.title}</span><strong className="block text-2xl text-[#2D5A27]">{loaded ? orders.filter(o => stage.key === 'ready' ? orderQueue(o) === 'ready' : o.status === stage.key).length : '—'}<span className="text-sm">건</span></strong><span className="text-xs text-gray-500">{stage.note}</span></a>)}
      </nav>
    </header>
    {error && <p role="alert" className="bg-red-50 text-red-700 p-4">{error} {loaded && '마지막으로 조회된 현황입니다.'}</p>}
    {loaded && <>
      <section className="border bg-amber-50 p-4 space-y-2" aria-label="자동 점검 결과"><h2 className="font-bold">먼저 확인 · {exceptions.length}건</h2>{exceptions.length ? exceptions.map(({order,issues}) => <div key={order.id} className="flex flex-wrap gap-3 text-sm"><Link className="underline" href={`/admin/orders/${order.id}`}>{order.order_number}</Link><span>{issues.join(' · ')}</span></div>) : <p className="text-sm">현재 주문 정보·송장·출고 예정일 점검에서 확인할 항목이 없습니다.</p>}</section>
      <section id="flow-ready" className="scroll-mt-6"><h2 className="text-lg font-bold mb-3">1. 발주 대기</h2><OrdersClient sharedOrders={orders} onChanged={afterChange}/></section>
      {stages.filter(stage => stage.key !== 'ready').map(stage => <section key={stage.key} id={`flow-${stage.key}`} className="scroll-mt-6"><h2 className="text-lg font-bold mb-3">{stage.key === 'preparing' ? '2' : stage.key === 'shipped' ? '3' : '4'}. {stage.title}</h2>{stage.key === 'preparing' && <p className="text-sm text-gray-600 mb-3">발주 확정 이력에서 엑셀을 받아 공급사에 전달하세요. 회신받은 송장을 등록하면 상태와 현황이 갱신됩니다.</p>}<ShipmentsClient initialTab={stage.key} sharedOrders={orders} onChanged={afterChange}/></section>)}
      <section className="space-y-5"><h2 className="text-lg font-bold">고객 요청 · 취소 / 교환 / 반품</h2>{(['cancel_requested','exchange_requested','return_requested'] as const).map(status => <div key={status} id={`flow-${status}`} className="scroll-mt-6"><h3 className="font-semibold mb-2">{status==='cancel_requested'?'취소 요청':status==='exchange_requested'?'교환 신청':'반품 신청'}</h3><ShipmentsClient initialTab={status} sharedOrders={orders} onChanged={afterChange} initialRequestId={initialTab===status?initialRequestId:undefined}/></div>)}</section>
      <details className="border p-4"><summary className="cursor-pointer">처리 완료 이력 · 취소 / 교환 / 반품</summary>{(['cancelled','exchange_completed','return_completed'] as const).map(status => <section key={status} className="mt-4"><h3 className="font-semibold mb-2">{status==='cancelled'?'취소완료':status==='exchange_completed'?'교환완료':'반품완료'}</h3><ShipmentsClient initialTab={status} sharedOrders={orders} onChanged={afterChange}/></section>)}</details>
    </>}
  </div>;
}
