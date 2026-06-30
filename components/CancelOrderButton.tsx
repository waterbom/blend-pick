"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("주문을 취소할까요?")) return;
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      alert(data.message);
      router.refresh();
    } else {
      alert(data.error || "취소 처리 중 오류가 발생했습니다.");
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
      style={{ background: "#fff1f0", color: "#ef4444" }}
    >
      {loading ? "처리 중..." : "주문 취소"}
    </button>
  );
}
