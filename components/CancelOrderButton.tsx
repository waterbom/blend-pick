"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("주문을 취소할까요?")) return;
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
      alert("네트워크 문제로 취소 요청이 전달되지 않았어요. 연결 상태를 확인하고 다시 시도해주세요.");
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
      {loading ? "처리 중..." : "주문 취소"}
    </button>
  );
}
