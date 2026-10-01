"use client";
import { apiErrorMessage, readApiJson } from '@/lib/api-error-message';

import { useRouter } from "next/navigation";

export default function ProductDeleteButton({ id }: { id: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("판매를 중단하고 보관할까요? 주문·정산 이력은 유지됩니다.")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      await readApiJson(res, "상품 보관에 실패했습니다.");
      router.refresh();
    } catch (error) { alert(apiErrorMessage(error)); }
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
