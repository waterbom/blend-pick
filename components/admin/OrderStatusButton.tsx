"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const NEXT_STATUS: Record<string, { label: string; next: string } | null> = {
  paid:      { label: "배송준비로", next: "preparing" },
  preparing: { label: "배송중으로", next: "shipped" },
  shipped:   { label: "배송완료로", next: "delivered" },
  delivered: null,
  cancelled: null,
};

export default function OrderStatusButton({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const next = NEXT_STATUS[status];

  if (!next) return null;

  async function handleClick() {
    if (!confirm(`${next!.label} 변경할까요?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next!.next }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("상태 변경에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500 transition-colors disabled:opacity-40"
    >
      {loading ? "처리중..." : next.label}
    </button>
  );
}
