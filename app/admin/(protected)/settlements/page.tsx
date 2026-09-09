import MetricChart from '@/components/admin/charts/MetricChart';
import { settlementPoints } from '@/lib/admin-chart-data';
import { currentAdminSite } from "@/lib/admin-site";
import type { SiteKey } from "@/lib/sites";
import {settlementView} from "@/lib/settlement-view";
import Link from "next/link";
import SiteBadge from "@/components/admin/SiteBadge";

interface SettlementRow {
  id: string;
  payment_key: string;
  order_id: string;
  order_number: string | null;
  buyer_name: string | null;
  site: string | null; // 결제된 사이트 (블랜드픽/산지픽)
  gross_amount: number;
  fee: number;
  net_amount: number | null;
  settled_at: string;
  created_at: string;
}

function kstDate(value:string|Date){return new Date(new Date(value).getTime()+9*3600000).toISOString().slice(0,10);}
function inPeriod(value:string,period?:string){
 const day=kstDate(value),today=kstDate(new Date()),now=new Date(today+'T00:00:00Z');
 if(period==='today')return day===today;
 if(period==='month')return day.slice(0,7)===today.slice(0,7);
 if(period==='week'){now.setUTCDate(now.getUTCDate()-(now.getUTCDay()+6)%7);return day>=now.toISOString().slice(0,10)&&day<=today;}
 return true;
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const site = (await currentAdminSite()).key;
  const { period } = await searchParams;
  const all=await settlementView(site);
  const sum=(period?:string)=>all.filter(s=>inPeriod(s.settled_at,period)).reduce((n,s)=>n+Number(s.net_amount??0),0);
  const stats={today:sum('today'),this_week:sum('week'),this_month:sum('month'),total:sum(),total_fee:all.reduce((n,s)=>n+Number(s.fee),0)};
  const selected=all.filter(s=>inPeriod(s.settled_at,period));
  const settlements=selected.slice(0,200);
  const unresolved=all.filter(s=>s.unresolved).length;

  const dashboardCards = [
    { key: "today", label: "오늘", amount: Number(stats.today) },
    { key: "week", label: "이번 주", amount: Number(stats.this_week) },
    { key: "month", label: "이번 달", amount: Number(stats.this_month) },
    { key: "", label: "총 정산액", amount: Number(stats.total) },
  ];

  return (
    <div>
      {/* 대시보드 카드 */}
      <p className="text-sm text-gray-500 mb-4">환불을 반영한 정산 예상액입니다. PG 실제 입금액과는 대조가 필요합니다.{unresolved>0 ? ` 환불 미확인 ${unresolved}건은 합계에서 제외했습니다.` : ""}</p>
      <div className="bg-white rounded-none border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-[#2D5A27] rounded-none flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-800">정산 관리</span>
        </div>
        <div className="flex items-center overflow-x-auto">
          {dashboardCards.map((card, i) => (
            <div key={card.key || "total"} className="flex items-center flex-1 min-w-[130px]">
              <Link
                href={card.key ? `/admin/settlements?period=${card.key}` : "/admin/settlements"}
                className="flex-1 group"
              >
                <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                <div className="text-2xl font-bold text-gray-800 group-hover:text-[#2D5A27] transition-colors">
                  {card.amount.toLocaleString()}<span className="text-sm font-medium text-gray-400 ml-0.5">원</span>
                </div>
              </Link>
              {i < dashboardCards.length - 1 && (
                <div className="mx-4 text-gray-200 text-lg">›</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-50 text-xs text-gray-400">
          총 수수료: <span className="font-medium text-gray-600">{Number(stats.total_fee).toLocaleString()}원</span>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 bg-white rounded-none border border-gray-100 p-1">
        {[
          { key: "", label: "전체" },
          { key: "today", label: "오늘" },
          { key: "week", label: "이번 주" },
          { key: "month", label: "이번 달" },
        ].map((tab) => {
          const active = (period || "") === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key ? `/admin/settlements?period=${tab.key}` : "/admin/settlements"}
              className={`px-3 py-2 rounded-none text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="mb-6"><MetricChart title="정산 예상액·수수료 추이" description="현재 선택 기간 전체 내역 · 한국시간 정산일 기준 · 60일 초과 범위는 월별 · 환불 미확인 구간은 빈 값 · 실제 입금액과 대조 필요" points={settlementPoints(selected)} series={[{label:'정산 예상액',color:'#315e43'},{label:'수수료',color:'#b87a28'}]} unit="won" kind="bar"/></div>
      {/* 정산 목록 테이블 */}
      <div className="bg-white rounded-none border border-gray-100 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">정산일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">주문번호</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">구매자</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">총액</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">수수료</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">정산액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {settlements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                  정산 내역이 없습니다
                </td>
              </tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(s.settled_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {s.order_number || "-"} <SiteBadge site={s.site} className="ml-1 font-sans" />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {s.buyer_name || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {Number(s.gross_amount).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right text-red-400">
                    -{Number(s.fee).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {s.net_amount == null ? "환불 확인 필요" : Number(s.net_amount).toLocaleString()+"원"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
