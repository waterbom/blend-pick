import MetricChart from '@/components/admin/charts/MetricChart';
import { PAGE_LABELS, type VisitSummary } from '@/lib/visit-analytics/rules';
import { kstDay } from '@/lib/admin-chart-data';
export default function VisitCharts({data}:{data:VisitSummary}) {
  if(!['active','empty'].includes(data.state))return null;
  const daily=new Map(data.daily.map(d=>[d.day,d]));
  const points=[];
  const from=Date.parse(kstDay(data.from)+'T00:00:00Z'),to=Date.parse(kstDay(data.to)+'T00:00:00Z');
  for(let at=from;at<=to;at+=86400000){const day=new Date(at).toISOString().slice(0,10),d=daily.get(day);points.push({label:day.slice(5),values:[d?.visitors??null,d?.sessions??null,d?.pageviews??null]});}
  return <div className="grid gap-4 xl:grid-cols-2">
    <MetricChart title="방문·세션·조회 추이" description="방문자는 브라우저 기준입니다. 일별 방문자 합계와 기간 내 순방문자는 다를 수 있습니다." points={points} series={[{label:'방문자',color:'#315e43'},{label:'세션',color:'#b87a28'},{label:'페이지 조회',color:'#3876a4'}]}/>
    <MetricChart title="많이 본 화면" points={data.pages.map(p=>({label:PAGE_LABELS[p.page]||'기타',values:[p.views]}))} series={[{label:'페이지 조회',color:'#3876a4'}]} kind="bar"/>
  </div>;
}
