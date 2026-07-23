"use client";

import { useEffect, useState } from "react";
import { BUSINESS_TYPE_LABEL, HOTEL_PAYOUT_CAMPAIGN_ID, type BusinessType, type PayoutBreakdown } from "@/lib/settlement";
import { downloadXlsx } from "@/lib/xlsx-download";

interface Row {
  campaign_id: string;
  influencer_id: string;
  product_name: string;
  influencer_name: string;
  start_date: string | null;
  end_date: string | null;
  business_type: BusinessType | null;
  bank: string | null;
  docs_ok: boolean;
  orders: number;
  qty: number;
  gross: number;
  rate: number | null;
  commission: number | null;
  breakdown: PayoutBreakdown | null;
  payout: {
    id: string;
    status: string;
    payout_amount: number;
    commission: number;
    supply_value: number;
    vat: number;
    withholding: number;
    paid_at: string | null;
  } | null;
}

const WON = (n: number) => `${n.toLocaleString()}원`;

export default function InfluencerSettlementsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/influencer-settlements");
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const visible = rows.filter((r) => {
    if (filter === "none") return !r.payout;
    if (filter === "pending") return r.payout?.status === "pending";
    if (filter === "paid") return r.payout?.status === "paid";
    return true;
  });

  async function confirm(r: Row) {
    if (r.rate == null) { alert("공구 관리에서 수수료율을 먼저 설정해주세요."); return; }
    if (!r.business_type) { alert("인플루언서 사업자유형을 먼저 설정해주세요."); return; }
    if (!window.confirm(`${r.influencer_name} / ${r.product_name}\n현재 매출 기준으로 정산을 확정할까요?\n(확정 후 요율이 바뀌어도 이 정산은 변하지 않습니다)`)) return;
    setActing(true);
    const res = await fetch("/api/admin/influencer-payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: r.campaign_id, influencer_id: r.influencer_id }),
    });
    const d = await res.json();
    setActing(false);
    if (res.ok) load();
    else alert(d.error || "확정 실패");
  }

  // 호텔공구 — 해당 인플루언서 링크로 구매한 사람들 명단 엑셀 (취소 포함, 상태 표기)
  async function downloadRoster(r: Row) {
    setActing(true);
    try {
      const res = await fetch("/api/admin/reservations");
      if (!res.ok) { alert("명단 조회에 실패했습니다."); return; }
      const all: { order_number: string; buyer_name: string; buyer_phone: string; status: string;
        stay_check_in: string | null; stay_check_out: string | null; total_amount: number;
        paid_at_kst: string | null; product_name: string | null; influencer_id: string | null }[] = await res.json();
      const mine = all.filter((o) => o.influencer_id === r.influencer_id);
      if (mine.length === 0) { alert("이 인플루언서 링크로 들어온 예약이 없습니다."); return; }
      const header = ["예약번호", "예약자", "연락처", "패키지", "객실", "체크인", "체크아웃", "상태", "결제금액", "결제시간"];
      const rows = mine.map((o) => {
        const parts = (o.product_name || "").split(" · ");
        return [
          o.order_number, o.buyer_name, o.buyer_phone, parts[1] || "", parts[2] || "",
          o.stay_check_in || "", o.stay_check_out || "",
          o.status === "paid" ? "예약확정" : o.status === "cancelled" ? "취소" : o.status,
          Number(o.total_amount), o.paid_at_kst || "",
        ];
      });
      await downloadXlsx(`구매자명단_${r.influencer_name}_${new Date().toISOString().slice(0, 10)}.xlsx`, header, rows, "구매자명단");
    } finally {
      setActing(false);
    }
  }

  async function setStatus(payoutId: string, status: "paid" | "pending") {
    setActing(true);
    const res = await fetch(`/api/admin/influencer-payouts/${payoutId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActing(false);
    if (res.ok) load();
    else alert("처리 실패");
  }

  const tabs = [
    { key: "", label: "전체" },
    { key: "none", label: "미확정" },
    { key: "pending", label: "확정(지급대기)" },
    { key: "paid", label: "지급완료" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1A1D18]">공구 정산</h1>
        <p className="text-sm text-gray-400 mt-0.5">공구별 인플루언서 수수료 확정 및 지급 관리</p>
      </div>

      <div className="flex mb-4 w-fit flex-wrap">
        {tabs.map((t, ti) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className="px-3.5 py-2 text-xs font-semibold transition-colors"
            style={{
              border: "1px solid",
              marginLeft: ti > 0 ? "-1px" : 0,
              background: filter === t.key ? "#1A1D18" : "#fff",
              color: filter === t.key ? "#fff" : "#5C6156",
              borderColor: filter === t.key ? "#1A1D18" : "#D6D6CF",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-none border border-gray-100 text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-none border border-gray-100 text-center py-16 text-gray-400 text-sm">
            정산할 공구 매출이 없어요
          </div>
        ) : (
          visible.map((r) => {
            // 확정된 정산은 스냅샷 수치, 미확정은 현재 계산치 표시
            const view = r.payout
              ? { commission: r.payout.commission, supplyValue: r.payout.supply_value, vat: r.payout.vat, withholding: r.payout.withholding, payout: r.payout.payout_amount }
              : r.breakdown;
            return (
              <div key={`${r.campaign_id}:${r.influencer_id}`} className="bg-white rounded-none border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      @{r.influencer_name} <span className="text-gray-400 font-medium">·</span> {r.product_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.start_date} ~ {r.end_date}
                      {r.business_type && ` · ${BUSINESS_TYPE_LABEL[r.business_type]}`}
                      {!r.docs_ok && <span className="text-red-500 font-bold ml-1.5">⚠ 서류 미비</span>}
                    </p>
                    {r.bank && <p className="text-xs text-gray-400 mt-0.5">{r.bank}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.campaign_id === HOTEL_PAYOUT_CAMPAIGN_ID && (
                      <button onClick={() => downloadRoster(r)} disabled={acting}
                        className="text-xs font-bold px-3 py-2 rounded-none border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        title="이 인플루언서 링크로 구매한 사람들 명단 (취소 포함, 상태 표기)">
                        📋 구매자 명단
                      </button>
                    )}
                    {!r.payout && (
                      <button onClick={() => confirm(r)} disabled={acting}
                        className="bg-[#2D5A27] hover:bg-[#244B1F] text-white text-xs font-bold px-3 py-2 rounded-none disabled:opacity-40">
                        정산 확정
                      </button>
                    )}
                    {r.payout?.status === "pending" && (
                      <>
                        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-yellow-50 text-yellow-600">지급대기</span>
                        <button onClick={() => confirm(r)} disabled={acting}
                          className="text-xs font-bold px-3 py-2 rounded-none border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                          title="현재 매출로 다시 계산해 확정">
                          재확정
                        </button>
                        <button onClick={() => setStatus(r.payout!.id, "paid")} disabled={acting}
                          className="bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold px-3 py-2 rounded-none disabled:opacity-40">
                          지급완료
                        </button>
                      </>
                    )}
                    {r.payout?.status === "paid" && (
                      <>
                        <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-green-50 text-green-600">
                          지급완료{r.payout.paid_at ? ` · ${new Date(r.payout.paid_at).toLocaleDateString("ko-KR")}` : ""}
                        </span>
                        <button onClick={() => setStatus(r.payout!.id, "pending")} disabled={acting}
                          className="text-xs text-gray-400 hover:text-red-500 px-2 py-2">
                          지급 취소
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-8 gap-x-4 gap-y-2 text-xs mt-3 pt-3 border-t border-gray-50 tnum">
                  <div><p className="text-gray-400">주문/수량</p><p className="font-bold text-gray-800">{r.orders}건 / {r.qty}개</p></div>
                  <div><p className="text-gray-400">총매출</p><p className="font-bold text-gray-800">{WON(r.gross)}</p></div>
                  <div><p className="text-gray-400">수수료율</p><p className="font-bold text-[#2D5A27]">{r.rate != null ? `${r.rate}%` : "미설정"}</p></div>
                  <div><p className="text-gray-400">수수료 (부가세 포함)</p><p className="font-bold text-gray-800">{view ? WON(view.commission) : "—"}</p></div>
                  <div><p className="text-gray-400">공급가액/부가세</p><p className="font-bold text-gray-800">{view ? `${WON(view.supplyValue)} / ${WON(view.vat)}` : "—"}</p></div>
                  <div><p className="text-gray-400">원천징수</p><p className="font-bold text-gray-800">{view ? WON(view.withholding) : "—"}</p></div>
                  <div><p className="text-gray-400">지급액 (이체)</p><p className="font-black text-[#2D5A27]">{view ? WON(view.payout) : "—"}</p></div>
                  <div>
                    <p className="text-gray-400">실질 수령 (세후)</p>
                    <p className="font-black text-gray-900">
                      {view ? WON(r.business_type === "general" ? view.supplyValue : view.payout) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        · 미확정 상태의 금액은 현재 매출·요율 기준 예상치입니다. <b>정산 확정</b> 시점의 수치로 동결되며, 이후 요율 변경에 영향받지 않습니다.
        <br />· <b>지급액(이체)</b> = 실제 송금할 금액. <b>실질 수령(세후)</b> = 인플루언서가 자기 세금(사업자: 부가세 납부 / 프리랜서: 원천세 기공제)까지 정리한 뒤 남는 돈.
      </p>
    </div>
  );
}
