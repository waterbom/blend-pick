"use client";

import { useRouter } from "next/navigation";

export default function ProductDeleteButton({ id }: { id: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("판매를 중단하고 보관할까요? 주문·정산 이력은 유지됩니다.")) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "삭제에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-red-400 font-bold hover:text-red-600 transition-colors"
    >
      삭제
    </button>
  );
}
