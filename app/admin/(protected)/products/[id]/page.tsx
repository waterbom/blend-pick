"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", brand: "", description: "",
    price: "", original_price: "", stock: "0",
    category: "", status: "draft",
    shipping_type: "paid", shipping_cost: "3000",
    main_image: "",
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          name: data.name ?? "",
          brand: data.brand ?? "",
          description: data.description ?? "",
          price: String(data.price ?? ""),
          original_price: String(data.original_price ?? ""),
          stock: String(data.stock ?? 0),
          category: data.category ?? "",
          status: data.status ?? "draft",
          shipping_type: data.shipping_type ?? "paid",
          shipping_cost: String(data.shipping_cost ?? 3000),
          main_image: data.main_image ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
        stock: Number(form.stock),
        shipping_cost: Number(form.shipping_cost),
      }),
    });

    if (res.ok) {
      router.push("/admin/products");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "수정 실패");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    router.push("/admin/products");
    router.refresh();
  }

  if (loading) return <div className="text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">상품 수정</h1>
          <p className="text-sm text-gray-400 mt-0.5">상품 정보를 수정해요</p>
        </div>
        <button onClick={handleDelete}
          className="text-xs text-red-400 hover:text-red-600 font-bold border border-red-200 px-3 py-1.5 rounded-lg transition-colors">
          삭제
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">기본 정보</p>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">상품명 *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">브랜드</label>
              <input value={form.brand} onChange={(e) => set("brand", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
              <input value={form.category} onChange={(e) => set("category", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">상품 설명</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">가격 & 재고</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">판매가 *</label>
              <input value={form.price} onChange={(e) => set("price", e.target.value)}
                type="number" min="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">정가</label>
              <input value={form.original_price} onChange={(e) => set("original_price", e.target.value)}
                type="number" min="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">재고</label>
            <input value={form.stock} onChange={(e) => set("stock", e.target.value)}
              type="number" min="0"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">배송 & 상태</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">배송 타입</label>
              <select value={form.shipping_type} onChange={(e) => set("shipping_type", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="paid">유료배송</option>
                <option value="free">무료배송</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">배송비</label>
              <input value={form.shipping_cost} onChange={(e) => set("shipping_cost", e.target.value)}
                type="number" min="0"
                disabled={form.shipping_type === "free"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-300" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">판매 상태</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="draft">준비중 (비공개)</option>
              <option value="active">판매중</option>
              <option value="soldout">품절</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">이미지</p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">대표 이미지 URL</label>
            <input value={form.main_image} onChange={(e) => set("main_image", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="https://..." />
            {form.main_image && (
              <img src={form.main_image} alt="미리보기"
                className="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-100" />
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="flex-1 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
