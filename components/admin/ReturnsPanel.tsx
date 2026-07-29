"use client";

import { useCallback, useEffect, useState } from "react";
import { RETURN_STATUS_LABEL } from "@/lib/returns";

interface ReturnEvent {
  status: string;
  note: string | null;
  admin_name: string | null;
  at_kst: string;
}

interface ReturnRow {
  id: string;
  order_id: string;
  kind: "exchange" | "return";
  status: string;
  items: { item_id: string; product_name: string; option_label: string | null; unit_price: number; quantity: number }[];
  reason: string;
  detail: string | null;
  photos: string[];
  pickup_address: string | null;
  pickup_detail: string | null;
  fee_agreed: boolean;
  created_kst: string;
  order_number: string;
  buyer_name: string;
  buyer_phone: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  total_amount: number;
  shipping_fee: number;
  events: ReturnEvent[] | null;
}

// 교환·반품 신청 처리 패널 — 신청 상세(사유·사진·수거지)를 보고
// 수거 접수 → 완료(반품은 토스 환불) / 거절을 건별로 처리한다
export default function ReturnsPanel({ kind }: { kind: "exchange" | "return" }) {
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/returns?kind=${kind}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { load(); }, [load]);

  async function act(r: ReturnRow, action: "collect" | "complete" | "reject") {
    let note = "";
    let refundAmount = 0;

    if (action === "collect") {
      if (!confirm(`${r.order_number} 신청을 수거·처리 중으로 바꿀까요?`)) return;
    } else if (action === "reject") {
      const input = prompt("거절 사유를 입력해주세요 (고객 마이페이지에 표시됩니다)", "");
      if (input === null) return;
      note = input.trim();
      if (!note) { alert("거절 사유를 입력해주세요."); return; }
    } else if (action === "complete") {
      if (r.kind === "return") {
        const itemsSum = r.items.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0);
        const input = prompt(
          `환불 금액을 입력해주세요 (원)\n\n신청 상품 합계 ${itemsSum.toLocaleString()}원 · 결제 금액 ${Number(r.total_amount).toLocaleString()}원\n고객 사유면 반송 배송비를 빼고 입력하세요. 0 입력 시 환불 없이 완료 처리됩니다.`,
          String(itemsSum)
        );
        if (input === null) return;
        refundAmount = Math.floor(Number(input.replace(/[^0-9]/g, "")));
        if (Number.isNaN(refundAmount) || refundAmount < 0 || refundAmount > Number(r.total_amount)) {
          alert("환불 금액이 올바르지 않아요.");
          return;
        }
        if (!confirm(`${r.order_number} 반품 완료 처리할까요?\n토스로 ${refundAmount.toLocaleString()}원이 환불됩니다.`)) return;
      } else {
        if (!confirm(`${r.order_number} 교환 완료 처리할까요?`)) return;
      }
    }

    setActingId(r.id);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, action, note, refund_amount: refundAmount }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) { alert(d.error || "처리에 실패했어요."); return; }
      if (action === "complete" && r.kind === "return" && d.refunded > 0) {
        alert(`반품 완료 — ${Number(d.refunded).toLocaleString()}원 환불됐어요.`);
      }
      await load();
    } catch {
      alert("네트워크 문제로 요청이 전달되지 않았어요. 목록을 새로고침해 확인해주세요.");
    } finally {
      setActingId(null);
    }
  }

  const kindLabel = kind === "exchange" ? "교환" : "반품";

  if (loading) return <div className="bg-white rounded-none border border-gray-100 p-16 text-center text-sm text-gray-400">불러오는 중...</div>;
  if (rows.length === 0) return <div className="bg-white rounded-none border border-gray-100 p-16 text-center text-sm text-gray-400">진행 중인 {kindLabel} 신청이 없습니다</div>;

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const acting = actingId === r.id;
        return (
          <div key={r.id} className="bg-white rounded-none border border-gray-100">
            {/* 헤더 — 주문번호·신청일·상태 */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 border-b border-gray-100 bg-gray-50">
              <span className="font-mono text-xs font-semibold text-gray-700">{r.order_number}</span>
              <span className="text-xs text-gray-400">신청 {r.created_kst}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 ${
                r.status === "requested" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
              }`}>
                {RETURN_STATUS_LABEL[r.status] ?? r.status}
              </span>
              <span className="ml-auto text-xs text-gray-500">
                {r.recipient_name ?? r.buyer_name} · {r.recipient_phone ?? r.buyer_phone}
              </span>
            </div>

            <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {/* 신청 상품 */}
                <p className="text-[11px] font-bold text-gray-400 mb-1">신청 상품</p>
                {r.items.map((it, i) => (
                  <p key={i} className="text-xs text-gray-700 m-0">
                    {it.product_name}
                    {it.option_label && <span className="text-gray-400"> / {it.option_label}</span>}
                    {" "}× {it.quantity} <span className="text-gray-400">({(Number(it.unit_price) * it.quantity).toLocaleString()}원)</span>
                  </p>
                ))}

                {/* 사유 */}
                <p className="text-[11px] font-bold text-gray-400 mt-3 mb-1">사유</p>
                <p className="text-xs text-gray-700 m-0">
                  {r.reason}
                  <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 ${r.fee_agreed ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-700"}`}>
                    {r.fee_agreed ? "배송비 고객 부담 동의" : "배송비 판매자 부담"}
                  </span>
                </p>
                {r.detail && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap m-0">{r.detail}</p>}

                {/* 사진 */}
                {r.photos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.photos.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block w-14 h-14 border border-gray-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="신청 사진" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div>
                {/* 수거지 */}
                <p className="text-[11px] font-bold text-gray-400 mb-1">수거지</p>
                <p className="text-xs text-gray-700 m-0">{r.pickup_address || "—"} {r.pickup_detail || ""}</p>

                {/* 처리 이력 */}
                <p className="text-[11px] font-bold text-gray-400 mt-3 mb-1">처리 이력</p>
                {(r.events ?? []).map((e, i) => (
                  <p key={i} className="text-xs text-gray-500 m-0">
                    {e.at_kst} · {RETURN_STATUS_LABEL[e.status] ?? e.status}
                    {e.admin_name && ` (${e.admin_name})`}
                    {e.note && ` — ${e.note}`}
                  </p>
                ))}
              </div>
            </div>

            {/* 처리 버튼 */}
            <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-gray-100">
              {r.status === "requested" && (
                <button onClick={() => act(r, "collect")} disabled={acting}
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-none transition-colors">
                  {acting ? "처리 중..." : "수거·처리 시작"}
                </button>
              )}
              <button onClick={() => act(r, "complete")} disabled={acting}
                className={`disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-none transition-colors ${
                  kind === "return" ? "bg-[#2D5A27] hover:bg-[#244B1F]" : "bg-violet-600 hover:bg-violet-700"
                }`}>
                {acting ? "처리 중..." : kind === "return" ? "반품 완료 · 환불" : "교환 완료"}
              </button>
              <button onClick={() => act(r, "reject")} disabled={acting}
                className="disabled:opacity-50 text-xs font-bold px-4 py-2 rounded-none border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                거절
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
