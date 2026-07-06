"use client";

import { useRouter } from "next/navigation";

export default function ProductDeleteButton({ id }: { id: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("정말 삭제할까요?")) return;
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
