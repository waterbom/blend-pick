"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 주문 취소 버튼 — 상태에 따라 다르게 동작.
 * · 결제완료(paid): 즉시 취소 + 전액 환불
 * · 주문확인 이후: 셀프 취소 불가 → "취소 요청"만 접수 (관리자 확인 후 환불,
 *   단순 변심이면 배송비 차감 안내)
 */
export default function CancelOrderButton({ orderId, status = "paid" }: { orderId: string; status?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const instant = status === "paid"; // 주문확인 전에만 즉시 취소

  async function handleCancel() {
    const msg = instant
      ? "주문을 취소할까요?\n결제하신 금액이 전액 환불됩니다."
      : status === "shipped"
      ? "취소 요청을 보낼까요?\n\n이미 운송장이 등록된 주문이라, 택배가 이미 출고된 경우에는 취소가 불가할 수 있어요. 확인 후 처리해 드려요.\n단순 변심에 의한 취소는 배송비를 제외한 금액이 환불됩니다."
      : "취소 요청을 보낼까요?\n\n이미 주문 확인이 된 상태라 확인 후 순차적으로 처리해 드려요.\n단순 변심에 의한 취소는 배송비를 제외한 금액이 환불됩니다.";
    if (!confirm(msg)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(data.message);
        router.refresh();
      } else {
        alert(data.error || "취소 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    } catch {
      // 네트워크 끊김 등 — 요청이 서버에 닿았는지 알 수 없으니 새로고침 후 재시도 안내
      alert("네트워크 문제로 요청이 전달되지 않았어요. 연결 상태를 확인하고 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
      style={{ background: "var(--sale-soft)", color: "var(--sale)" }}
    >
      {loading ? "처리 중..." : instant ? "주문 취소" : "취소 요청"}
    </button>
  );
}
