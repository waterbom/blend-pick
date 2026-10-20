"use client";
import { apiErrorMessage, readApiJson } from '@/lib/api-error-message';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Order } from '@/components/admin/OrdersClient';
import ShipmentsClient, { type ShipmentTab } from '@/components/admin/ShipmentsClient';
import ReturnsPanel from '@/components/admin/ReturnsPanel';
import ShipmentTrackingPanel from '@/components/admin/ShipmentTrackingPanel';
import type { WorkGroup } from '@/lib/operations';
import { orderQueue } from '@/lib/admin-workflow';
import { shippingExceptions } from '@/lib/shipping-flow';
import { useSiteKey } from '@/components/SiteContext';
import { SITES } from '@/lib/sites';

export default function ShippingFlowClient({initialTab, initialRequestId, automationWork=[], automationUnavailable=false}: {initialTab?: 'preparing' | 'exchange_requested' | 'return_requested'; initialRequestId?: string; automationWork?: WorkGroup[]; automationUnavailable?: boolean}) {
  const site = useSiteKey();
  const [shipmentTab, setShipmentTab] = useState<ShipmentTab>('active');
  useEffect(() => {
    const sync = () => {
      const key = window.location.hash.replace('#flow-', '');
      if (['preparing','shipped','delivered'].includes(key)) setShipmentTab(key as ShipmentTab);
    };
    sync(); window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const router = useRouter();
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
        const rows = await readApiJson(response);
        if (!response.ok || !Array.isArray(rows)) throw Error(apiErrorMessage(rows, '배송 현황을 불러오지 못했습니다. 다시 조회해주세요.'));
        if (!mounted.current) return;
        setOrders(rows.filter((o: Order) => (o.site || 'blendpick') === site));
        setUpdated(new Date().toLocaleTimeString('ko-KR', {timeZone:'Asia/Seoul'}));
        setError(''); setLoaded(true);
      } catch(e) { if(mounted.current) setError(apiErrorMessage(e, '배송 현황 조회 실패')); }
    })().finally(() => { active.current = null; });
    active.current = task;
    return task;
  }, [site]);
  const afterChange = useCallback(async () => {
    if (active.current) await active.current;
    await refresh();
    router.refresh();
  }, [refresh,router]);
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
    else if (loaded && window.location.hash.startsWith('#flow-')) document.getElementById(window.location.hash.slice(1))?.scrollIntoView({block:'start'});
  }, [loaded, initialTab]);
  const exceptions = orders.map(order => ({order, issues:shippingExceptions(order)})).filter(row => row.issues.length);
  const ready = orders.filter(o=>orderQueue(o)==='ready').length;
  const check = orders.filter(o=>orderQueue(o)==='check').length;
  const cancellations = orders.filter(o=>o.status==='cancel_requested');
  const automaticIssues = automationWork.filter(group=>group.total>0);

  return <div className="ops-workspace">
    <header className="ops-page-heading"><div><h1>배송·반품 관리</h1><p>{SITES[site].name} · 1분마다 갱신 · 마지막 조회 {updated||'대기 중'} (한국시간)</p></div><button className="ops-button" onClick={()=>void refresh()}>현황 새로고침</button></header>
    {error&&<p role="alert" className="ops-error">{error} {loaded&&'마지막으로 조회된 현황입니다.'}</p>}
    <nav className="ops-flow-summary" aria-label="배송 현황">
      <Link id="flow-ready" href="/admin/orders"><span>발주 대기</span><b>{loaded?ready:'—'}<small>건</small></b><small>확인 필요 {loaded?check:'—'}건 · 주문관리 →</small></Link>
      <a href="#flow-preparing" onClick={()=>setShipmentTab('preparing')}><span>배송준비</span><b>{loaded?orders.filter(o=>o.status==='preparing').length:'—'}<small>건</small></b><small>송장 등록</small></a>
      <a href="#flow-shipped" onClick={()=>setShipmentTab('shipped')}><span>배송중</span><b>{loaded?orders.filter(o=>o.status==='shipped').length:'—'}<small>건</small></b><small>배송조회·완료 확인</small></a>
      <a href="#customer-requests"><span>고객 요청</span><b>{loaded?orders.filter(o=>orderQueue(o)==='requests').length:'—'}<small>건</small></b><small>취소·교환·반품 주문</small></a>
    </nav>
    {(exceptions.length>0||automaticIssues.length>0||automationUnavailable)&&<section className="ops-attention" aria-label="먼저 확인할 배송 업무">
      <h2>먼저 확인</h2>
      {automationUnavailable&&<p role="alert" className="ops-error">자동 처리 확인 항목을 불러오지 못했습니다. 새로고침해주세요.</p>}
      <div className="ops-attention-list">
        {exceptions.slice(0,5).map(({order,issues})=><div key={order.id}><Link href={`/admin/orders/${order.id}`}>{order.order_number}</Link><span>{issues.join(' · ')}</span><Link href={`/admin/orders/${order.id}`}>확인 →</Link></div>)}
        {automaticIssues.flatMap(group=>group.items.slice(0,3).map(item=><div key={`${group.key}-${item.id}`}><Link href={item.href}>{item.label}</Link><span>{group.title} · {item.detail}</span><Link href={item.href}>{item.actionLabel||'확인'} →</Link></div>))}
      </div>
      {automaticIssues.filter(group=>group.items.length>3).map(group=><details key={group.key} className="ops-details"><summary>{group.title} · 추가 {group.items.length-3}건</summary>{group.items.slice(3).map(item=><p key={item.id}><Link className="ops-text-button" href={item.href}>{item.label}</Link> · {item.detail}</p>)}</details>)}
      {automaticIssues.filter(group=>group.total>group.items.length).map(group=><p key={group.key} className="ops-meta">{group.title}: 전체 {group.total}건 중 우선 {group.items.length}건을 불러왔습니다. 처리 후 새로고침해주세요.</p>)}
      {exceptions.length>5&&<details className="ops-details"><summary>추가 확인 항목 {exceptions.length-5}건</summary>{exceptions.slice(5).map(({order,issues})=><p key={order.id}><Link className="ops-text-button" href={`/admin/orders/${order.id}`}>{order.order_number}</Link> · {issues.join(' · ')}</p>)}</details>}
    </section>}
    <ShipmentTrackingPanel key={site} onChanged={afterChange}/>
    {loaded?<>
      <section className="ops-list-panel ops-anchor-section" aria-label="배송 주문">
        <span id="flow-preparing" className="ops-anchor"/><span id="flow-shipped" className="ops-anchor"/><span id="flow-delivered" className="ops-anchor"/>
        <div className="ops-section-heading"><h2>배송 주문</h2><span>배송준비·배송중을 함께 확인하고, 완료 이력은 상태 필터로 조회합니다.</span></div>
        <ShipmentsClient key={shipmentTab} initialTab={shipmentTab} sharedOrders={orders} onChanged={afterChange}/>
      </section>
      <section id="customer-requests" className="ops-customer-requests">
        <div className="ops-section-heading"><h2>고객 요청</h2><span>요청 내용과 처리 버튼을 함께 표시합니다.</span></div>
        <div id="flow-cancel_requested" className="ops-list-panel">
          <div className="ops-section-heading"><h3>취소 요청 <b>{cancellations.length}건</b></h3><span>공급사 출고 중지·회수 여부를 확인한 뒤 승인하세요.</span></div>
          {cancellations.length?<ShipmentsClient initialTab="cancel_requested" sharedOrders={orders} onChanged={afterChange}/>:<p className="ops-inline-empty">대기 중인 취소 요청이 없습니다.</p>}
        </div>
        <div className="ops-list-panel ops-anchor-section">
          <span id="flow-exchange_requested" className="ops-anchor"/><span id="flow-return_requested" className="ops-anchor"/>
          <div className="ops-section-heading"><h3>교환·반품 신청</h3><span>접수·수거 중 신청</span></div>
          <ReturnsPanel kind="all" compact refreshKey={orders} initialRequestId={initialRequestId} onChanged={()=>{void afterChange();}}/>
        </div>
      </section>
    </>:!error&&<p className="ops-empty" role="status">배송 주문을 불러오는 중입니다.</p>}
  </div>;
}
