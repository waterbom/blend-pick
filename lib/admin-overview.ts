import type {WorkGroup} from '@/lib/operations';
import type {VisitSummary} from '@/lib/visit-analytics/rules';
import {kstDay} from '@/lib/admin-chart-data';
const order=['cancellations','payment-recovery','tracking','tracking-errors','returns','unshipped','stock','sms'];
const rank=(key:string)=>order.includes(key)?order.indexOf(key):order.length;
export function overviewWorkItems(groups:WorkGroup[]){
 return groups.flatMap(group=>group.items.map(item=>({...item,key:group.key+':'+item.id,group:group.key,groupTitle:group.title})))
  .sort((a,b)=>Number(b.priority==='first')-Number(a.priority==='first')||rank(a.group)-rank(b.group));
}
export function overviewVisitPoints(data:VisitSummary){
 const rows=new Map(data.daily.map(d=>[d.day,d])),points=[];
 for(let at=Date.parse(kstDay(data.from)+'T00:00:00Z'),end=Date.parse(kstDay(data.to)+'T00:00:00Z');at<=end;at+=86400000){
  const day=new Date(at).toISOString().slice(0,10);
  // Missing collection is not a measured zero, including dates before activation.
  points.push({label:day.slice(5),values:[rows.get(day)?.visitors??null,rows.get(day)?.pageviews??null]});
 }
 return points;
}
