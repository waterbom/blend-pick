"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

interface Category { id: string; name: string; }
interface OptionRow { name: string; price: string; stock: string; }

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<string[]>([""]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [form, setForm] = useState({
    name: "", brand: "", category: "", status: "active",
    original_price: "", discount_rate: "", price: "",
    stock: "0",
    shipping_type: "paid", shipping_cost: "3000",
    free_shipping_threshold: "",
    detail_html: "",
  });

  useEffect(() => {
    fetch("/api/admin/categories").then((r) => r.json()).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/products/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const origPrice = String(data.original_price ?? "");
        const price = String(data.price ?? "");
        let discountRate = "";
        if (origPrice && price) {
          const orig = parseFloat(origPrice);
          const p = parseFloat(price);
          if (orig > 0 && p < orig) discountRate = String(Math.round((1 - p / orig) * 100));
        }
        setForm({
          name: data.name ?? "",
          brand: data.brand ?? "",
          category: data.category ?? "",
          status: data.status ?? "active",
          original_price: origPrice,
          discount_rate: discountRate,
          price,
          stock: String(data.stock ?? 0),
          shipping_type: data.shipping_type ?? "paid",
          shipping_cost: String(data.shipping_cost ?? 3000),
          free_shipping_threshold: data.free_shipping_threshold ? String(data.free_shipping_threshold) : "",
          detail_html: data.description ?? "",
        });
        const allImgs = [
          ...(data.main_image ? [data.main_image] : []),
          ...(data.extra_images ?? []),
        ];
        setImages(allImgs.length > 0 ? allImgs : [""]);
        setOptions(
          (data.options ?? []).map((o: { name: string; price: number; stock: number }) => ({
            name: o.name, price: String(o.price), stock: String(o.stock),
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleOriginalPrice(val: string) {
    const orig = parseFloat(val);
    const rate = parseFloat(form.discount_rate);
    const newPrice = !isNaN(orig) && !isNaN(rate) && rate >= 0 && rate <= 100
      ? String(Math.round(orig * (1 - rate / 100))) : form.price;
    setForm((f) => ({ ...f, original_price: val, price: newPrice }));
  }

  function handleDiscountRate(val: string) {
    const orig = parseFloat(form.original_price);
    const rate = parseFloat(val);
    const newPrice = !isNaN(orig) && !isNaN(rate) && rate >= 0 && rate <= 100
      ? String(Math.round(orig * (1 - rate / 100))) : form.price;
    setForm((f) => ({ ...f, discount_rate: val, price: newPrice }));
  }

  const discountAmount = (() => {
    const orig = parseFloat(form.original_price);
    const price = parseFloat(form.price);
    if (!isNaN(orig) && !isNaN(price) && orig > price) return Math.round(orig - price);
    return null;
  })();

  function addImage() { setImages((imgs) => [...imgs, ""]); }
  function removeImage(i: number) { setImages((imgs) => imgs.filter((_, idx) => idx !== i)); }
  function setImage(i: number, val: string) {
    setImages((imgs) => imgs.map((img, idx) => (idx === i ? val : img)));
  }

  async function handleFileUpload(i: number, file: File) {
    setUploadingIdx(i);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) setImage(i, data.url);
    setUploadingIdx(null);
  }

  function addOption() { setOptions((opts) => [...opts, { name: "", price: "", stock: "" }]); }
  function removeOption(i: number) { setOptions((opts) => opts.filter((_, idx) => idx !== i)); }
  function setOption(i: number, key: keyof OptionRow, val: string) {
    setOptions((opts) => opts.map((opt, idx) => (idx === i ? { ...opt, [key]: val } : opt)));
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const validImages = images.filter(Boolean);

    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        brand: form.brand || null,
        category: form.category || null,
        status: form.status,
        price: Number(form.price) || 0,
        original_price: form.original_price ? Number(form.original_price) : null,
        stock: Number(form.stock) || 0,
        shipping_type: form.shipping_type,
        shipping_cost: Number(form.shipping_cost) || 0,
        free_shipping_threshold: form.free_shipping_threshold ? Number(form.free_shipping_threshold) : null,
        main_image: validImages[0] || null,
        description: form.detail_html || null,
        extra_images: validImages.slice(1),
        options: options.filter((o) => o.name).map((o) => ({
          name: o.name, price: Number(o.price) || 0, stock: Number(o.stock) || 0,
        })),
      }),
    });

    if (res.ok) { router.push("/admin/products"); router.refresh(); }
    else { const d = await res.json(); setError(d.error || "수정 실패"); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    router.push("/admin/products");
    router.refresh();
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";

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

        {/* 기본 정보 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">기본 정보</p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">상품명 *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              className={inputCls} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">브랜드</label>
              <input value={form.brand} onChange={(e) => set("brand", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                <option value="">카테고리 선택</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">판매 상태</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
              <option value="active">판매중</option>
              <option value="draft">준비중 (비공개)</option>
              <option value="soldout">품절</option>
            </select>
          </div>
        </div>

        {/* 이미지 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">이미지</p>
            <button type="button" onClick={addImage}
              className="text-xs text-orange-500 font-bold hover:text-orange-600">
              + 이미지 추가
            </button>
          </div>
          <p className="text-xs text-gray-400">첫 번째 이미지가 대표 이미지로 사용됩니다</p>

          <div className="space-y-3">
            {images.map((url, i) => (
              <div key={i} className="space-y-2">
                <div className="flex gap-2 items-center">
                  {i === 0 && (
                    <span className="text-xs bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded shrink-0">
                      대표
                    </span>
                  )}
                  <input value={url} onChange={(e) => setImage(i, e.target.value)}
                    className={inputCls} placeholder="URL 직접 입력 또는 파일 첨부" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[i] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(i, file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[i]?.click()}
                    disabled={uploadingIdx === i}
                    className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg shrink-0 transition-colors disabled:opacity-40"
                  >
                    {uploadingIdx === i ? "업로드중..." : "파일"}
                  </button>
                  {images.length > 1 && (
                    <button type="button" onClick={() => removeImage(i)}
                      className="text-xs text-red-400 hover:text-red-600 px-1 shrink-0">✕</button>
                  )}
                </div>
                {url && (
                  <img src={url} alt={`이미지 ${i + 1}`}
                    className="w-full rounded-lg border border-gray-100 object-contain" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 가격 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">가격</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">소비자가 (정가)</label>
              <input value={form.original_price} onChange={(e) => handleOriginalPrice(e.target.value)}
                type="number" min="0" className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">할인율 (%)</label>
              <input value={form.discount_rate} onChange={(e) => handleDiscountRate(e.target.value)}
                type="number" min="0" max="100" className={inputCls} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">판매가 *</label>
            <input value={form.price} onChange={(e) => set("price", e.target.value)}
              type="number" min="0" className={inputCls} placeholder="0" required />
            {discountAmount !== null && (
              <p className="text-xs text-orange-500 mt-1.5 font-medium">
                → {discountAmount.toLocaleString()}원 절약
              </p>
            )}
          </div>
        </div>

        {/* 재고 & 배송 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">재고 & 배송</p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">기본 재고</label>
            <input value={form.stock} onChange={(e) => set("stock", e.target.value)}
              type="number" min="0" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">배송 타입</label>
            <select value={form.shipping_type} onChange={(e) => set("shipping_type", e.target.value)} className={inputCls}>
              <option value="free">무료배송</option>
              <option value="paid">유료배송</option>
              <option value="conditional_free">조건부무료 (기준금액 이상 무료)</option>
            </select>
          </div>
          {form.shipping_type !== "free" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">배송비 (원)</label>
              <input value={form.shipping_cost} onChange={(e) => set("shipping_cost", e.target.value)}
                type="number" min="0" className={inputCls} />
            </div>
          )}
          {form.shipping_type === "conditional_free" && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">무료배송 기준금액 (원 이상)</label>
              <input value={form.free_shipping_threshold} onChange={(e) => set("free_shipping_threshold", e.target.value)}
                type="number" min="0" className={inputCls} placeholder="예: 30000" />
              {form.free_shipping_threshold && (
                <p className="text-xs text-gray-400 mt-1">
                  {Number(form.free_shipping_threshold).toLocaleString()}원 이상 주문 시 무료배송
                </p>
              )}
            </div>
          )}
        </div>

        {/* 옵션 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">옵션</p>
            <button type="button" onClick={addOption}
              className="text-xs text-orange-500 font-bold hover:text-orange-600">
              + 옵션 추가
            </button>
          </div>
          {options.length === 0 ? (
            <p className="text-xs text-gray-300 py-1">색상, 사이즈 등 옵션이 있으면 추가하세요</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_100px_80px_28px] gap-2">
                <span className="text-xs text-gray-400">옵션명</span>
                <span className="text-xs text-gray-400">가격 (원)</span>
                <span className="text-xs text-gray-400">재고</span>
                <span />
              </div>
              {options.map((opt, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_80px_28px] gap-2 items-center">
                  <input value={opt.name} onChange={(e) => setOption(i, "name", e.target.value)}
                    className={inputCls} placeholder="예: 빨강/XL" />
                  <input value={opt.price} onChange={(e) => setOption(i, "price", e.target.value)}
                    type="number" min="0" className={inputCls} placeholder="0" />
                  <input value={opt.stock} onChange={(e) => setOption(i, "stock", e.target.value)}
                    type="number" min="0" className={inputCls} placeholder="0" />
                  <button type="button" onClick={() => removeOption(i)}
                    className="text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 상세 페이지 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">상세 페이지</p>
          <p className="text-xs text-gray-400">이미지 URL, HTML 태그 등 자유롭게 붙여넣기 가능해요</p>
          <textarea value={form.detail_html} onChange={(e) => set("detail_html", e.target.value)}
            rows={12}
            className={`${inputCls} resize-y font-mono text-xs`}
            placeholder={"<img src='https://...' />\n<p>상품 설명...</p>"} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pb-8">
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
