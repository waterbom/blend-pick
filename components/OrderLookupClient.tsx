"use client";

import { useState } from "react";
import PhoneVerifyField from "@/components/PhoneVerifyField";
import { carrierName, trackingUrl } from "@/lib/carriers";

interface LookupOrder {
  id: string;
  order_number: string;
  order_type: "shop" | "hotel";
  status: string;
  total_amount: number;
  tracking_company: string | null;
  tracking_number: string | null;
  recipient_name: string | null;
  addr_address: string | null;
  addr_detail: string | null;
  shipped_kst: string | null;
  delivered_kst: string | null;
  paid_date: string | null;
  check_in: string | null;
  check_out: string | null;
  items: { name: string; option: string | null; qty: number }[] | null;
}

const STATUS_LABEL: Record<string, string> = {
  paid: "결제완료", confirmed: "주문확인", preparing: "배송준비", shipped: "배송중",
  delivered: "배송완료", cancelled: "취소됨", cancel_requested: "취소요청중",
  checked_in: "체크인완료", no_show: "노쇼", awaiting: "예약대기",
  exchange_requested: "교환신청", exchange_completed: "교환완료",
  return_requested: "반품신청", return_completed: "반품완료",
};
const hotelStatus: Record<string, string> = { paid: "예약확정", checked_in: "체크인완료", cancelled: "취소됨", no_show: "노쇼", awaiting: "예약대기" };

export default function OrderLookupClient() {
  const [phone, setPhone] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<LookupOrder[] | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null); // 취소 처리 중인 주문 id

  async function load(p: string) {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { setError(d.error || "조회에 실패했어요."); return; }
      setOrders(d.orders);
    } finally { setLoading(false); }
  }

  // 비회원 주문 취소 — 발송 전엔 즉시 전액 환불, 운송장 등록 후엔 취소 요청 접수
  async function handleCancel(o: LookupOrder) {
    const instant = ["paid", "confirmed", "preparing"].includes(o.status);
    const msg = instant
      ? "주문을 취소할까요?\n결제하신 금액이 전액 환불됩니다."
      : "취소 요청을 보낼까요?\n\n이미 운송장이 등록된 주문이라, 택배가 이미 출고된 경우에는 취소가 불가할 수 있어요. 확인 후 처리해 드려요.\n단순 변심에 의한 취소는 배송비를 제외한 금액이 환불됩니다.";
    if (!confirm(msg)) return;
    setCancelling(o.id);
    try {
      const res = await fetch(`/api/orders/${o.id}/cancel`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d.error || "취소 처리에 실패했어요. 잠시 후 다시 시도해주세요."); return; }
      alert(d.message || "처리되었습니다.");
      await load(phone); // 목록 새로고침 (인증 쿠키 30분 유효)
    } catch {
      alert("네트워크 문제로 요청이 전달되지 않았어요. 연결 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="ds-caption mb-2">ORDER LOOKUP</div>
      <h1 className="ds-serif text-2xl font-semibold m-0 mb-6" style={{ color: "#1C2418" }}>주문 조회</h1>

      {!orders && (
        <div className="ds-card p-6">
          <p className="text-[13px] mb-4" style={{ color: "#6B7263" }}>
            주문할 때 입력한 휴대폰 번호로 인증하면, 그 번호로 결제한 주문·예약 내역을 한 번에 볼 수 있어요.
          </p>
          <label className="ds-label">휴대폰 번호</label>
          <input
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setVerified(false); }}
            placeholder="010-0000-0000"
            inputMode="tel"
            className="ds-input"
            style={{ maxWidth: "280px" }}
          />
          <PhoneVerifyField
            phone={phone}
            verified={verified}
            onVerified={() => { setVerified(true); load(phone); }}
          />
          {loading && <p className="text-xs mt-3" style={{ color: "#8B927F" }}>조회 중…</p>}
          {error && <p className="text-xs mt-3" style={{ color: "var(--sale)" }}>{error}</p>}
        </div>
      )}

      {orders && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: "#8B927F" }}>
            인증된 번호로 결제한 내역 {orders.length}건이에요. 주문번호는 문의 시 그대로 알려주시면 됩니다.
          </p>
          {orders.length === 0 && (
            <div className="ds-card p-6 text-sm" style={{ color: "#8B927F" }}>이 번호로 결제한 내역이 없어요.</div>
          )}
          {orders.map((o) => {
            const isHotel = o.order_type === "hotel";
            const st = (isHotel ? hotelStatus[o.status] : STATUS_LABEL[o.status]) ?? o.status;
            return (
              <div key={o.id} className="ds-card">
                <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-2" style={{ borderBottom: "1px solid #E4E1D6", background: "#FAFAF6" }}>
                  <div className="flex items-baseline gap-3 min-w-0 flex-wrap">
                    <span className="ds-mono text-xs font-semibold" style={{ color: "#5C6553" }}>{o.paid_date || ""}</span>
                    <span className="ds-mono text-xs font-bold" style={{ color: "#244B1F" }}>{o.order_number}</span>
                    {isHotel && (
                      <span className="text-[10px] font-bold px-2 py-0.5" style={{ letterSpacing: "0.08em", color: "#244B1F", background: "#EAF0E6" }}>호텔 예약</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold shrink-0" style={{ color: o.status === "cancelled" ? "#8B927F" : "#2D5A27" }}>{st}</span>
                </div>
                <div className="px-5 py-4">
                  {(o.items ?? []).map((it, i) => (
                    <p key={i} className="text-sm font-medium" style={{ color: "#1C2418" }}>
                      {it.name}
                      {it.option && <span style={{ color: "#8B927F" }}> / {it.option}</span>}
                      {it.qty > 1 ? ` × ${it.qty}` : ""}
                    </p>
                  ))}
                  {isHotel && o.check_in && (
                    <p className="text-xs mt-1" style={{ color: "#8B927F" }}>{o.check_in} 입실 ~ {o.check_out} 퇴실</p>
                  )}
                  {!isHotel && o.addr_address && (
                    <p className="text-xs mt-1" style={{ color: "#8B927F" }}>
                      배송지 · {o.recipient_name} · {o.addr_address}{o.addr_detail ? ` ${o.addr_detail}` : ""}
                    </p>
                  )}
                  {(o.shipped_kst || o.delivered_kst) && (
                    <p className="ds-mono text-[11px] mt-1" style={{ color: "#8B927F" }}>
                      {o.shipped_kst ? `발송 ${o.shipped_kst}` : ""}{o.shipped_kst && o.delivered_kst ? " · " : ""}{o.delivered_kst ? `배송완료 ${o.delivered_kst}` : ""}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-3 mt-3 flex-wrap gap-2" style={{ borderTop: "1px solid #E4E1D6" }}>
                    <span className="ds-mono text-sm font-semibold" style={{ color: "#1C2418" }}>
                      {Number(o.total_amount).toLocaleString()}원
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {o.tracking_company && o.tracking_number && (
                        <a href={trackingUrl(o.tracking_company, o.tracking_number)} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-3.5 py-2" style={{ border: "1px solid #E4E1D6", color: "#4A5442" }}>
                          {carrierName(o.tracking_company)} 배송 조회
                        </a>
                      )}
                      {/* 발송 전엔 즉시 취소, 운송장 등록 후엔 취소 요청 — 회원 마이페이지와 같은 정책 */}
                      {!isHotel && ["paid", "confirmed", "preparing", "shipped"].includes(o.status) && (
                        <button onClick={() => handleCancel(o)} disabled={cancelling === o.id}
                          className="text-xs px-3.5 py-2 disabled:opacity-50"
                          style={{ border: "1px solid #E8C9C9", color: "#B4423C", background: "#FDF7F7" }}>
                          {cancelling === o.id ? "처리 중..." : ["shipped"].includes(o.status) ? "취소 요청" : "주문 취소"}
                        </button>
                      )}
                      {!isHotel && ["shipped", "delivered"].includes(o.status) && (
                        <a href={`/orders/returns/new?order=${o.id}`}
                          className="text-xs px-3.5 py-2" style={{ border: "1px solid #E4E1D6", color: "#4A5442" }}>
                          교환·반품 신청
                        </a>
                      )}
                      {["exchange_requested", "return_requested"].includes(o.status) && (
                        <span className="text-xs px-3.5 py-2" style={{ color: "#8B927F", background: "#F5F3EA" }}>
                          접수 확인 중이에요
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
