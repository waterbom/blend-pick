"use client";

import { useEffect, useMemo, useState } from "react";
import { BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/settlement";

interface Row {
  campaign_id: string | null;
  label: string;
  influencer_id: string | null;
  influencer_name: string | null;
  business_type: BusinessType | null;
  period: string | null;
  channel: "shop" | "campaign" | "hotel";
  orders: number;
  qty: number;
  gross: number;
  sales_vat: number;
  supply_cost: number;
  missing_supply: number;
  shipping_cost: number;
  pg_fee: number;
  fee_estimated: boolean;
  other_costs: number;
  commission: number;
  rate: number | null;
  net_profit: number;
}

const WON = (n: number) => n.toLocaleString();

export default function ProfitClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [channel, setChannel] = useState("");
  const [infFilter, setInfFilter] = useState("");
  const [bizFilter, setBizFilter] = useState("");

  async function load() {
    setLoading(true);
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (channel) p.set("channel", channel);
    const res = await fetch(`/api/admin/profit?${p.toString()}`);
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 인플루언서/사업자유형 필터는 클라이언트에서
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (infFilter && r.influencer_id !== infFilter) return false;
        if (bizFilter && r.business_type !== bizFilter) return false;
        return true;
      }),
    [rows, infFilter, bizFilter]
  );

  const influencerOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => { if (r.influencer_id && r.influencer_name) m.set(r.influencer_id, r.influencer_name); });
    return [...m.entries()];
  }, [rows]);

  const total = useMemo(
    () =>
      visible.reduce(
        (t, r) => ({
          orders: t.orders + r.orders,
          gross: t.gross + r.gross,
          sales_vat: t.sales_vat + r.sales_vat,
          supply_cost: t.supply_cost + r.supply_cost,
          shipping_cost: t.shipping_cost + r.shipping_cost,
          pg_fee: t.pg_fee + r.pg_fee,
          other_costs: t.other_costs + r.other_costs,
          commission: t.commission + r.commission,
          net_profit: t.net_profit + r.net_profit,
        }),
        { orders: 0, gross: 0, sales_vat: 0, supply_cost: 0, shipping_cost: 0, pg_fee: 0, other_costs: 0, commission: 0, net_profit: 0 }
      ),
    [visible]
  );

  const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400";
  const th = "px-3 py-3 text-xs font-bold text-gray-400 whitespace-nowrap";
  const td = "px-3 py-3 whitespace-nowrap tnum";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">수익 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          공구별/자사몰 손익 — 순이익 = 총매출 − 부가세 − 공급가 − 배송비 − PG수수료 − 기타비용 − 인플루언서 정산
        </p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">시작일</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">종료일</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">판매채널</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inp}>
            <option value="">전체</option>
            <option value="campaign">공동구매</option>
            <option value="shop">자사몰</option>
            <option value="hotel">호텔 공구</option>
          </select>
        </div>
        <button onClick={load} className="bg-gray-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-700">
          조회
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <select value={infFilter} onChange={(e) => setInfFilter(e.target.value)} className={inp}>
            <option value="">인플루언서 전체</option>
            {influencerOptions.map(([id, name]) => (
              <option key={id} value={id}>@{name}</option>
            ))}
          </select>
          <select value={bizFilter} onChange={(e) => setBizFilter(e.target.value)} className={inp}>
            <option value="">사업자유형 전체</option>
            {Object.entries(BUSINESS_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 손익 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">데이터가 없어요</div>
        ) : (
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className={`${th} text-left`}>공구 / 채널</th>
                <th className={`${th} text-left`}>인플루언서</th>
                <th className={`${th} text-right`}>주문</th>
                <th className={`${th} text-right`}>총매출</th>
                <th className={`${th} text-right`}>부가세</th>
                <th className={`${th} text-right`}>공급가</th>
                <th className={`${th} text-right`}>배송비</th>
                <th className={`${th} text-right`}>PG수수료</th>
                <th className={`${th} text-right`}>기타비용</th>
                <th className={`${th} text-right`}>인플루언서 정산</th>
                <th className={`${th} text-right`}>순이익</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map((r) => (
                <tr key={r.campaign_id ?? r.label} className="hover:bg-gray-50 transition-colors">
                  <td className={`${td} max-w-[260px]`}>
                    <p className="font-medium text-gray-900 truncate">{r.label}</p>
                    <p className="text-xs text-gray-400">
                      {r.channel === "campaign" ? "공동구매" : r.channel === "hotel" ? "호텔 공구 · 수수료 7%" : "자사몰"}
                      {r.period && ` · ${r.period}`}
                    </p>
                  </td>
                  <td className={`${td} text-xs`}>
                    {r.influencer_name ? (
                      <>
                        <span className="font-medium text-orange-600">@{r.influencer_name}</span>
                        {r.business_type && (
                          <span className="text-gray-400 ml-1">({BUSINESS_TYPE_LABEL[r.business_type]})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className={`${td} text-right text-gray-600`}>{r.orders}건</td>
                  <td className={`${td} text-right font-medium text-gray-900`}>{WON(r.gross)}</td>
                  <td className={`${td} text-right text-gray-500`}>−{WON(r.sales_vat)}</td>
                  <td className={`${td} text-right text-gray-500`}>
                    −{WON(r.supply_cost)}
                    {r.missing_supply > 0 && (
                      <span className="text-red-400 ml-1" title={`공급가 미입력 ${r.missing_supply}건`}>⚠</span>
                    )}
                  </td>
                  <td className={`${td} text-right text-gray-500`}>−{WON(r.shipping_cost)}</td>
                  <td className={`${td} text-right text-gray-500`}>
                    −{WON(r.pg_fee)}
                    {r.fee_estimated && <span className="text-[10px] text-gray-300 ml-1">예상</span>}
                  </td>
                  <td className={`${td} text-right text-gray-500`}>−{WON(r.other_costs)}</td>
                  <td className={`${td} text-right text-gray-500`}>
                    −{WON(r.commission)}
                    {r.channel === "campaign" && r.rate == null && (
                      <span className="text-red-400 ml-1" title="수수료율 미설정">⚠</span>
                    )}
                  </td>
                  <td className={`${td} text-right font-black ${r.net_profit >= 0 ? "text-gray-900" : "text-red-500"}`}>
                    {WON(r.net_profit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className={`${td} font-black text-gray-900`} colSpan={2}>합계</td>
                <td className={`${td} text-right font-bold text-gray-900`}>{total.orders}건</td>
                <td className={`${td} text-right font-bold text-gray-900`}>{WON(total.gross)}</td>
                <td className={`${td} text-right font-bold text-gray-600`}>−{WON(total.sales_vat)}</td>
                <td className={`${td} text-right font-bold text-gray-600`}>−{WON(total.supply_cost)}</td>
                <td className={`${td} text-right font-bold text-gray-600`}>−{WON(total.shipping_cost)}</td>
                <td className={`${td} text-right font-bold text-gray-600`}>−{WON(total.pg_fee)}</td>
                <td className={`${td} text-right font-bold text-gray-600`}>−{WON(total.other_costs)}</td>
                <td className={`${td} text-right font-bold text-gray-600`}>−{WON(total.commission)}</td>
                <td className={`${td} text-right font-black ${total.net_profit >= 0 ? "text-orange-600" : "text-red-500"}`}>
                  {WON(total.net_profit)}원
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        · PG수수료 "예상" = 아직 배송완료(정산 생성) 전 주문이 포함되어 요율(카드 3.63% / 이체 1.65%)로 추정한 금액입니다.
        <br />· ⚠ = 공급가 미입력 주문 포함 또는 수수료율 미설정 — 상품/공구 관리에서 입력하면 정확해집니다.
        <br />· 기간 필터는 주문(결제일) 기준이며, 공구별 배송비/기타비용은 공구 단위 입력값이 그대로 반영됩니다.
        <br />· 호텔 공구: 대행 모델 — 공급가(호텔 정산분) 88%. 부가세는 순납부 예상액(매출부가세 − 인플·토스 매입세액공제). 순이익 = 12% − 부가세(순납부) − 인플루언서 정산 5%(귀속 주문만) − 토스 1.7% ≈ 매출의 4.82% (세후 실질). 인플루언서 지급은 [공구 정산]에서 실행됩니다.
      </p>
    </div>
  );
}
