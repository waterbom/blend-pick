import { financialOrders, orderAmounts, type FinanceOrder } from '@/lib/order-finance';
import { analyticsRange } from '@/lib/visit-analytics/rules';
import { kstDay } from '@/lib/admin-chart-data';
import type { SiteKey } from '@/lib/sites';
export type SalesBucket={label:string;gross:number;refunds:number;net:number|null;orders:number;unresolved:number};
export type SalesSummary={days:number;from:string;to:string;totals:SalesBucket;daily:SalesBucket[];channels:SalesBucket[]};
const empty=(label:string):SalesBucket=>({label,gross:0,refunds:0,net:0,orders:0,unresolved:0});
export function summarizeSales(orders:FinanceOrder[],days:number,now=new Date()):SalesSummary {
  const {from,to}=analyticsRange(days,now),first=kstDay(from),last=kstDay(to);
  const daily=new Map<string,SalesBucket>();
  for(let at=Date.parse(first+'T00:00:00Z');at<=Date.parse(last+'T00:00:00Z');at+=86400000){const day=new Date(at).toISOString().slice(0,10);daily.set(day,empty(day));}
  const totals=empty('합계'),channels=[empty('전시'),empty('비전시')];
  for(const order of orders){
    const bucket=daily.get(kstDay(order.paid_at));if(!bucket)continue;
    const a=orderAmounts(order);
    for(const row of [totals,bucket,channels[order.sales_channel==='non_display'?1:0]]){
      row.gross+=a.total;row.refunds+=a.refund;row.orders++;
      row.net=row.net===null||a.unresolved?null:row.net+a.net;
      if(a.unresolved)row.unresolved++;
    }
  }
  return {days,from:first,to:last,totals,daily:[...daily.values()],channels};
}
export async function getSalesSummary(site:SiteKey,days:number,now=new Date()):Promise<SalesSummary>{
  const {from,to}=analyticsRange(days,now);
  return summarizeSales(await financialOrders(site,kstDay(from),kstDay(to)),days,now);
}
