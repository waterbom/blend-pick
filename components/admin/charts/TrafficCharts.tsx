'use client';
import { useState } from 'react';
import MetricChart from '@/components/admin/charts/MetricChart';
import { trafficPoints } from '@/lib/admin-chart-data';
import type { ServerTraffic } from '@/lib/server-traffic';
const routes: Record<string,string> = {home:'메인',products:'상품',login:'로그인',assets:'이미지·정적 파일',api:'일반 API',admin:'관리자',other:'기타'};
export default function TrafficCharts({data}:{data:ServerTraffic}) {
  const [grain,setGrain]=useState<'hour'|'day'>(data.days===1?'hour':'day');
  if(!data.totals) return null;
  const t=data.totals;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-stone-500">한국시간 · 빈 구간은 연결하지 않습니다. 평균 처리 시간은 요청 수로 가중 계산합니다.</p><div className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">{(['hour','day'] as const).map(g=><button type="button" key={g} aria-pressed={grain===g} onClick={()=>setGrain(g)} className={`rounded-md px-3 py-2 text-xs ${grain===g?'bg-emerald-900 text-white':''}`}>{g==='hour'?'시간별':'일별'}</button>)}</div></div>
    <div className="grid gap-4 xl:grid-cols-2">
      <MetricChart title="요청 추이" description="전체 서버 요청 · 이미지·봇·API 포함" points={trafficPoints(data,grain,'requests')} series={[{label:'요청',color:'#315e43'}]} kind="bar"/>
      <MetricChart title="전송량 추이" points={trafficPoints(data,grain,'sentBytes')} series={[{label:'보낸 데이터',color:'#3876a4'}]} unit="bytes"/>
      <MetricChart title="서버 오류 추이" description="HTTP 5xx 응답" points={trafficPoints(data,grain,'errors5xx')} series={[{label:'서버 오류',color:'#bb513b'}]} kind="bar"/>
      <MetricChart title="응답 처리 시간" points={trafficPoints(data,grain,'averageMs')} series={[{label:'평균 처리 시간',color:'#8963a9'}]} unit="ms"/>
      <MetricChart title="요청 종류별 비교" description="세 종류는 서로 겹치지 않습니다. 느린 요청은 별도 KPI에서 확인하세요." points={[{label:'일반·미분류',values:[t.otherRequests]},{label:'식별된 봇',values:[t.botRequests]},{label:'자동 점검',values:[t.monitorRequests]}]} series={[{label:'요청',color:'#315e43'}]} kind="bar"/>
      <MetricChart title="화면별 전송량" points={data.routes.map(r=>({label:routes[r.route]||r.route,values:[r.sentBytes]}))} series={[{label:'보낸 데이터',color:'#3876a4'}]} kind="bar" unit="bytes"/>
    </div>
  </div>;
}
