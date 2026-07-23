"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/categories");
    const data = await res.json();
    setCategories(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError("");
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      await load();
    } else {
      const data = await res.json();
      setError(data.error || "추가 실패");
    }
    setAdding(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 카테고리를 삭제할까요?`)) return;
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1A1D18]">카테고리 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">상품 등록 시 선택할 카테고리를 관리해요</p>
        </div>
        <Link
          href="/admin/products"
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-none transition-colors"
        >
          ← 상품 목록
        </Link>
      </div>

      {/* 추가 폼 */}
      <form onSubmit={handleAdd} className="bg-white rounded-none border border-gray-100 p-5 mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">새 카테고리 추가</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="예: 식품, 생활용품, 뷰티"
            className="flex-1 border border-gray-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D6C0]"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="bg-[#2D5A27] hover:bg-[#244B1F] text-white text-sm font-bold px-4 py-2 rounded-none transition-colors disabled:opacity-40"
          >
            {adding ? "추가 중..." : "추가"}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </form>

      {/* 카테고리 목록 */}
      <div className="bg-white rounded-none border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">불러오는 중...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">등록된 카테고리가 없어요</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-800 font-medium">{cat.name}</span>
                <button
                  onClick={() => handleDelete(cat.id, cat.name)}
                  className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
