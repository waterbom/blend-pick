"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import RichEditor from "@/components/admin/RichEditor";

interface Category { id: string; name: string; }
// active: 판매상태(판매중/판매중지), sel: 일괄편집용 체크 상태(저장에는 미포함)
interface OptionRow { name: string; price: string; stock: string; active: boolean; sel: boolean; supply: string; }
// 추가옵션(추가상품): 메인 구매 시 함께 살 수 있는 부가상품
interface AddonRow { name: string; price: string; active: boolean; }

const EMPTY_IMAGES = ["", "", "", "", ""];

interface Props {
  mode: "new" | "edit";
  productId?: string;
}

export default function ProductFormClient({ mode, productId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<string[]>([...EMPTY_IMAGES]);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [addonMulti, setAddonMulti] = useState(true);
  const [stockConfirmed, setStockConfirmed] = useState(false);
  const [detailFullscreen, setDetailFullscreen] = useState(false);

  const [form, setForm] = useState({
    name: "", brand: "", category: "",
    manufacturer: "", origin_country: "",
    product_condition: "new", manufacture_date: "",
    sale_type: "always",
    presale_enabled: "false",
    presale_start_at: "", presale_end_at: "",
    original_price: "", discount_rate: "", price: "",
    instant_discount_price: "",
    supply_price: "",
    influencer_rate: "",
    sale_start_at: "", sale_end_at: "",
    tax_type: "taxable",
    stock: "0",
    shipping_type: "paid", shipping_cost: "3000",
    free_shipping_threshold: "",
    per_unit_shipping_cost: "3000",
    shipping_carrier: "04",
    shipping_attr: "standard",
    shipping_attr_custom: "",
    island_shipping_cost: "0",
    installation_cost: "0",
    release_address: "",
    return_address: "",
    return_cost_oneway: "0",
    return_cost_roundtrip: "0",
    exchange_cost_oneway: "0",
    exchange_cost_roundtrip: "0",
    as_notes: "",
    detail_html: "",
  });

  useEffect(() => {
    fetch("/api/admin/categories").then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !productId) return;
    setLoading(true);
    fetch(`/api/admin/products/${productId}`)
      .then(r => r.json())
      .then((data) => {
        const origPrice = String(data.original_price ?? "");
        const price = String(data.price ?? "");
        let discountRate = "";
        if (origPrice && price) {
          const orig = parseFloat(origPrice);
          const p = parseFloat(price);
          if (orig > 0 && p < orig) discountRate = String(Math.round((1 - p / orig) * 100));
        }
        const rawAttr = data.shipping_attr || "standard";
        const isCustomAttr = rawAttr !== "standard";
        setForm({
          name: data.name ?? "",
          brand: data.brand ?? "",
          category: data.category ?? "",
          manufacturer: data.manufacturer ?? "",
          origin_country: data.origin_country ?? "",
          product_condition: data.product_condition ?? "new",
          manufacture_date: data.manufacture_date ? String(data.manufacture_date).slice(0, 10) : "",
          sale_type: data.sale_type ?? "always",
          presale_enabled: String(data.presale_enabled ?? false),
          presale_start_at: data.presale_start_at ? String(data.presale_start_at).slice(0, 16) : "",
          presale_end_at: data.presale_end_at ? String(data.presale_end_at).slice(0, 16) : "",
          original_price: origPrice,
          discount_rate: discountRate,
          price,
          instant_discount_price: data.instant_discount_price ? String(data.instant_discount_price) : "",
          supply_price: data.supply_price ? String(data.supply_price) : "",
          influencer_rate: data.influencer_rate != null ? String(data.influencer_rate) : "",
          sale_start_at: data.sale_start_at ? String(data.sale_start_at).slice(0, 16) : "",
          sale_end_at: data.sale_end_at ? String(data.sale_end_at).slice(0, 16) : "",
          tax_type: data.tax_type ?? "taxable",
          stock: String(data.stock ?? 0),
          shipping_type: data.shipping_type ?? "paid",
          shipping_cost: String(data.shipping_cost ?? 3000),
          free_shipping_threshold: data.free_shipping_threshold ? String(data.free_shipping_threshold) : "",
          per_unit_shipping_cost: data.per_unit_shipping_cost ? String(data.per_unit_shipping_cost) : "3000",
          shipping_carrier: data.shipping_carrier ?? "04",
          shipping_attr: isCustomAttr ? "custom" : "standard",
          shipping_attr_custom: isCustomAttr ? rawAttr : "",
          island_shipping_cost: String(data.island_shipping_cost ?? 0),
          installation_cost: String(data.installation_cost ?? 0),
          release_address: data.release_address ?? "",
          return_address: data.return_address ?? "",
          return_cost_oneway: String(data.return_cost_oneway ?? 0),
          return_cost_roundtrip: String(data.return_cost_roundtrip ?? 0),
          exchange_cost_oneway: String(data.exchange_cost_oneway ?? 0),
          exchange_cost_roundtrip: String(data.exchange_cost_roundtrip ?? 0),
          as_notes: data.as_notes ?? "",
          detail_html: data.description ?? "",
        });
        const allImgs = [
          ...(data.main_image ? [data.main_image] : []),
          ...(data.extra_images ?? []),
        ];
        // 5슬롯 고정, 부족하면 빈 문자열로 채움
        const padded = [...allImgs, ...EMPTY_IMAGES].slice(0, 5);
        setImages(padded);
        setOptions(
          (data.options ?? []).map((o: { name: string; price: number; stock: number; active?: boolean; supply_price?: number | null }) => ({
            name: o.name, price: String(o.price), stock: String(o.stock),
            active: o.active !== false, sel: false,
            supply: o.supply_price != null ? String(o.supply_price) : "",
          }))
        );
        setAddons(
          (data.addons ?? []).map((a: { name: string; price: number; active?: boolean }) => ({
            name: a.name, price: String(a.price), active: a.active !== false,
          }))
        );
        setAddonMulti(data.addon_multi !== false);
      })
      .finally(() => setLoading(false));
  }, [mode, productId]);

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleOriginalPrice(val: string) {
    const orig = parseFloat(val);
    const rate = parseFloat(form.discount_rate);
    const newPrice = !isNaN(orig) && !isNaN(rate) && rate >= 0 && rate <= 100
      ? String(Math.round(orig * (1 - rate / 100))) : form.price;
    setForm(f => ({ ...f, original_price: val, price: newPrice }));
  }

  function handleDiscountRate(val: string) {
    const orig = parseFloat(form.original_price);
    const rate = parseFloat(val);
    const newPrice = !isNaN(orig) && !isNaN(rate) && rate >= 0 && rate <= 100
      ? String(Math.round(orig * (1 - rate / 100))) : form.price;
    setForm(f => ({ ...f, discount_rate: val, price: newPrice }));
  }

  const discountAmount = (() => {
    const orig = parseFloat(form.original_price);
    const price = parseFloat(form.price);
    if (!isNaN(orig) && !isNaN(price) && orig > price) return Math.round(orig - price);
    return null;
  })();

  const optionStockTotal = options.reduce((sum, o) => sum + (parseInt(o.stock) || 0), 0);

  function confirmOptionStock() {
    setForm(f => ({ ...f, stock: String(optionStockTotal) }));
    setStockConfirmed(true);
  }

  function setImage(i: number, val: string) {
    setImages(imgs => imgs.map((img, idx) => idx === i ? val : img));
  }

  async function handleFileUpload(i: number, file: File) {
    setUploadingSlot(i);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) setImage(i, data.url);
    setUploadingSlot(null);
  }

  function addOption() {
    setOptions(opts => [...opts, { name: "", price: "", stock: "", active: true, sel: false, supply: "" }]);
    setStockConfirmed(false);
  }
  function removeOption(i: number) {
    setOptions(opts => opts.filter((_, idx) => idx !== i));
    setStockConfirmed(false);
  }
  function setOption(i: number, key: "name" | "price" | "stock" | "supply", val: string) {
    setOptions(opts => opts.map((opt, idx) => idx === i ? { ...opt, [key]: val } : opt));
    if (key === "stock") setStockConfirmed(false);
  }
  function setOptionActive(i: number, val: boolean) {
    setOptions(opts => opts.map((opt, idx) => idx === i ? { ...opt, active: val } : opt));
  }

  // ── 옵션 일괄 관리 ──
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const selCount = options.filter(o => o.sel).length;
  const allSelected = options.length > 0 && selCount === options.length;

  function toggleSel(i: number) {
    setOptions(opts => opts.map((opt, idx) => idx === i ? { ...opt, sel: !opt.sel } : opt));
  }
  function toggleSelAll() {
    const next = !allSelected;
    setOptions(opts => opts.map(opt => ({ ...opt, sel: next })));
  }
  function applyBulkPrice() {
    if (bulkPrice === "") { alert("적용할 판매가를 입력해주세요."); return; }
    setOptions(opts => opts.map(opt => opt.sel ? { ...opt, price: bulkPrice } : opt));
  }
  function applyBulkStock() {
    if (bulkStock === "") { alert("적용할 재고를 입력해주세요."); return; }
    setOptions(opts => opts.map(opt => opt.sel ? { ...opt, stock: bulkStock } : opt));
    setStockConfirmed(false);
  }
  function applyBulkStatus(active: boolean) {
    setOptions(opts => opts.map(opt => opt.sel ? { ...opt, active } : opt));
  }

  // ── 추가옵션(추가상품) ──
  function addAddon() {
    setAddons(a => [...a, { name: "", price: "", active: true }]);
  }
  function removeAddon(i: number) {
    setAddons(a => a.filter((_, idx) => idx !== i));
  }
  function setAddon(i: number, key: "name" | "price", val: string) {
    setAddons(a => a.map((row, idx) => idx === i ? { ...row, [key]: val } : row));
  }
  function setAddonActive(i: number, val: boolean) {
    setAddons(a => a.map((row, idx) => idx === i ? { ...row, active: val } : row));
  }

  function buildPayload() {
    const shippingAttrValue = form.shipping_attr === "custom" ? form.shipping_attr_custom : "standard";
    const statusMap: Record<string, string> = {
      always: "active", groupbuy: "active", preparing: "draft", soldout: "soldout",
    };
    return {
      name: form.name,
      brand: form.brand || null,
      category: form.category || null,
      manufacturer: form.manufacturer || null,
      origin_country: form.origin_country || null,
      product_condition: form.product_condition,
      manufacture_date: form.manufacture_date || null,
      sale_type: form.sale_type,
      status: statusMap[form.sale_type] ?? "active",
      presale_enabled: form.presale_enabled === "true",
      presale_start_at: form.presale_start_at || null,
      presale_end_at: form.presale_end_at || null,
      price: Number(form.price) || 0,
      original_price: form.original_price ? Number(form.original_price) : null,
      instant_discount_price: form.instant_discount_price ? Number(form.instant_discount_price) : null,
      supply_price: form.supply_price ? Number(form.supply_price) : null,
      influencer_rate: form.influencer_rate !== "" ? Number(form.influencer_rate) : null,
      sale_start_at: form.sale_start_at || null,
      sale_end_at: form.sale_end_at || null,
      tax_type: form.tax_type,
      stock: Number(form.stock) || 0,
      shipping_type: form.shipping_type,
      shipping_cost: Number(form.shipping_cost) || 0,
      free_shipping_threshold: form.free_shipping_threshold ? Number(form.free_shipping_threshold) : null,
      per_unit_shipping_cost: Number(form.per_unit_shipping_cost) || 0,
      shipping_carrier: form.shipping_carrier || null,
      shipping_attr: shippingAttrValue,
      island_shipping_cost: Number(form.island_shipping_cost) || 0,
      installation_cost: Number(form.installation_cost) || 0,
      release_address: form.release_address || null,
      return_address: form.return_address || null,
      return_cost_oneway: Number(form.return_cost_oneway) || 0,
      return_cost_roundtrip: Number(form.return_cost_roundtrip) || 0,
      exchange_cost_oneway: Number(form.exchange_cost_oneway) || 0,
      exchange_cost_roundtrip: Number(form.exchange_cost_roundtrip) || 0,
      as_notes: form.as_notes || null,
      description: form.detail_html || null,
      main_image: images[0] || null,
      extra_images: images.slice(1).filter(Boolean),
      options: options.filter(o => o.name).map(o => ({
        name: o.name, price: Number(o.price) || 0, stock: Number(o.stock) || 0, active: o.active !== false,
        supply_price: o.supply ? Number(o.supply) : null,
      })),
      addons: addons.filter(a => a.name).map(a => ({
        name: a.name, price: Number(a.price) || 0, active: a.active !== false,
      })),
      addon_multi: addonMulti,
    };
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const url = mode === "new" ? "/api/admin/products" : `/api/admin/products/${productId}`;
    const method = mode === "new" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    if (res.ok) {
      router.push("/admin/products");
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error || (mode === "new" ? "등록 실패" : "수정 실패"));
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
    router.push("/admin/products");
    router.refresh();
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";
  const lbl = "block text-xs font-medium text-gray-500 mb-1";

  if (loading) return <div className="text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">
            {mode === "new" ? "상품 등록" : "상품 수정"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {mode === "new" ? "새 상품을 등록해요" : "상품 정보를 수정해요"}
          </p>
        </div>
        {mode === "edit" && (
          <button onClick={handleDelete}
            className="text-xs text-red-400 hover:text-red-600 font-bold border border-red-200 px-3 py-1.5 rounded-lg transition-colors">
            삭제
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ① 기본 정보 */}
        <Section title="기본 정보">
          <div>
            <label className={lbl}>상품명 *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)}
              className={inp} placeholder="상품명을 입력하세요" required />
          </div>
          <Grid2>
            <div>
              <label className={lbl}>브랜드</label>
              <input value={form.brand} onChange={e => set("brand", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>카테고리</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} className={inp}>
                <option value="">카테고리 선택</option>
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
            </div>
          </Grid2>
          <Grid2>
            <div>
              <label className={lbl}>제조사</label>
              <input value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)}
                className={inp} placeholder="제조사명" />
            </div>
            <div>
              <label className={lbl}>원산지</label>
              <input value={form.origin_country} onChange={e => set("origin_country", e.target.value)}
                className={inp} placeholder="예: 대한민국" />
            </div>
          </Grid2>
          <Grid2>
            <div>
              <label className={lbl}>상품 상태</label>
              <select value={form.product_condition} onChange={e => set("product_condition", e.target.value)} className={inp}>
                <option value="new">신상품</option>
                <option value="used">중고상품</option>
              </select>
            </div>
            <div>
              <label className={lbl}>제조일자</label>
              <input value={form.manufacture_date} onChange={e => set("manufacture_date", e.target.value)}
                type="date" className={inp} />
            </div>
          </Grid2>
        </Section>

        {/* ② 판매 상태 */}
        <Section title="판매 상태">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "always", label: "상시 판매", sub: "전시 상품" },
              { value: "groupbuy", label: "공동구매", sub: "비전시 상품" },
              { value: "preparing", label: "준비중", sub: "공개" },
              { value: "soldout", label: "품절", sub: "" },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => set("sale_type", opt.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  form.sale_type === opt.value
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}>
                <p className={`text-sm font-semibold ${form.sale_type === opt.value ? "text-orange-600" : "text-gray-700"}`}>
                  {opt.label}
                </p>
                {opt.sub && <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">예약구매</p>
                <p className="text-xs text-gray-400">판매 전 사전 예약을 받습니다</p>
              </div>
              <button type="button"
                onClick={() => set("presale_enabled", form.presale_enabled === "true" ? "false" : "true")}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.presale_enabled === "true" ? "bg-orange-500" : "bg-gray-200"
                }`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  form.presale_enabled === "true" ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
            {form.presale_enabled === "true" && (
              <Grid2 className="mt-3">
                <div>
                  <label className={lbl}>예약 시작일시</label>
                  <input value={form.presale_start_at} onChange={e => set("presale_start_at", e.target.value)}
                    type="datetime-local" className={inp} />
                </div>
                <div>
                  <label className={lbl}>예약 종료일시</label>
                  <input value={form.presale_end_at} onChange={e => set("presale_end_at", e.target.value)}
                    type="datetime-local" className={inp} />
                </div>
              </Grid2>
            )}
          </div>
        </Section>

        {/* ③ 이미지 */}
        <Section title="이미지">
          {/* 대표 이미지 */}
          <div>
            <label className={lbl}>대표 이미지</label>
            <ImageSlot
              url={images[0]}
              uploading={uploadingSlot === 0}
              onFile={f => handleFileUpload(0, f)}
              onUrl={u => setImage(0, u)}
              onClear={() => setImage(0, "")}
              large
            />
          </div>

          {/* 서브 이미지 */}
          <div>
            <label className={lbl}>서브 이미지 (최대 4장)</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(i => (
                <ImageSlot
                  key={i}
                  url={images[i]}
                  uploading={uploadingSlot === i}
                  onFile={f => handleFileUpload(i, f)}
                  onUrl={u => setImage(i, u)}
                  onClear={() => setImage(i, "")}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* ④ 판매가 */}
        <Section title="판매가">
          <Grid2>
            <div>
              <label className={lbl}>소비자가 (정가)</label>
              <input value={form.original_price} onChange={e => handleOriginalPrice(e.target.value)}
                type="number" min="0" className={inp} placeholder="0" />
            </div>
            <div>
              <label className={lbl}>할인율 (%)</label>
              <input value={form.discount_rate} onChange={e => handleDiscountRate(e.target.value)}
                type="number" min="0" max="100" className={inp} placeholder="0" />
            </div>
          </Grid2>
          <Grid2>
            <div>
              <label className={lbl}>판매가 *</label>
              <input value={form.price} onChange={e => set("price", e.target.value)}
                type="number" min="0" className={inp} placeholder="0" required />
              {discountAmount !== null && (
                <p className="text-xs text-orange-500 mt-1 font-medium">→ {discountAmount.toLocaleString()}원 절약</p>
              )}
            </div>
            <div>
              <label className={lbl}>즉시할인가</label>
              <input value={form.instant_discount_price} onChange={e => set("instant_discount_price", e.target.value)}
                type="number" min="0" className={inp} placeholder="미입력 시 미적용" />
            </div>
          </Grid2>
          <Grid2>
            <div>
              <label className={lbl}>공급가 (매입원가)</label>
              <input value={form.supply_price} onChange={e => set("supply_price", e.target.value)}
                type="number" min="0" className={inp} placeholder="손익관리용 — 고객에게 노출 안 됨" />
              <p className="text-xs text-gray-400 mt-1">옵션별 공급가가 다르면 아래 옵션 행에서 개별 입력 (옵션값 우선 적용)</p>
            </div>
            <div>
              <label className={lbl}>인플루언서 수수료율 (%)</label>
              <input value={form.influencer_rate} onChange={e => set("influencer_rate", e.target.value)}
                type="number" min="0" max="100" step="0.1" className={inp} placeholder="예: 5" />
              <p className="text-xs text-gray-400 mt-1">입력하면 인플루언서 전용 링크(?inf=) 판매가 귀속되고 공구 정산에 수수료가 잡혀요</p>
            </div>
          </Grid2>
          <Grid2>
            <div>
              <label className={lbl}>판매 시작일시</label>
              <input value={form.sale_start_at} onChange={e => set("sale_start_at", e.target.value)}
                type="datetime-local" className={inp} />
            </div>
            <div>
              <label className={lbl}>판매 종료일시</label>
              <input value={form.sale_end_at} onChange={e => set("sale_end_at", e.target.value)}
                type="datetime-local" className={inp} />
            </div>
          </Grid2>
          <div>
            <label className={lbl}>부가세</label>
            <div className="flex gap-2">
              {[
                { value: "taxable", label: "과세상품" },
                { value: "exempt", label: "면세상품" },
                { value: "zero_rated", label: "영세상품" },
              ].map(t => (
                <button key={t.value} type="button" onClick={() => set("tax_type", t.value)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    form.tax_type === t.value
                      ? "border-orange-400 bg-orange-50 text-orange-600"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ⑤ 재고 & 옵션 */}
        <Section title="재고 & 옵션" action={
          <button type="button" onClick={addOption} className="text-xs text-orange-500 font-bold hover:text-orange-600">
            + 옵션 추가
          </button>
        }>
          {options.length === 0 ? (
            <div>
              <label className={lbl}>기본 재고</label>
              <input value={form.stock} onChange={e => set("stock", e.target.value)}
                type="number" min="0" className={inp} />
            </div>
          ) : (
            <>
              {/* 일괄 관리 툴바 — 옵션이 선택되면 노출 */}
              {selCount > 0 && (
                <div className="mb-3 rounded-lg bg-orange-50 border border-orange-100 p-3 space-y-2">
                  <p className="text-xs font-bold text-orange-600">선택한 {selCount}개 옵션 일괄 변경</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                        type="number" min="0" placeholder="판매가"
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400" />
                      <button type="button" onClick={applyBulkPrice}
                        className="text-xs bg-white border border-orange-200 text-orange-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-100">판매가 적용</button>
                    </div>
                    <div className="flex items-center gap-1">
                      <input value={bulkStock} onChange={e => setBulkStock(e.target.value)}
                        type="number" min="0" placeholder="재고"
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400" />
                      <button type="button" onClick={applyBulkStock}
                        className="text-xs bg-white border border-orange-200 text-orange-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-100">재고 적용</button>
                    </div>
                    <span className="w-px h-5 bg-orange-200" />
                    <button type="button" onClick={() => applyBulkStatus(true)}
                      className="text-xs bg-white border border-green-200 text-green-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-green-50">판매중으로</button>
                    <button type="button" onClick={() => applyBulkStatus(false)}
                      className="text-xs bg-white border border-gray-200 text-gray-500 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50">판매중지로</button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <div className="grid grid-cols-[24px_1fr_90px_90px_70px_92px_28px] gap-2 text-xs text-gray-400 items-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelAll}
                    className="w-4 h-4 accent-orange-500 cursor-pointer" title="전체 선택/해제" />
                  <span>옵션명</span><span>옵션 가격</span><span>공급가</span><span>재고</span><span>판매상태</span><span />
                </div>
                {options.map((opt, i) => (
                  <div key={i} className="grid grid-cols-[24px_1fr_90px_90px_70px_92px_28px] gap-2 items-center">
                    <input type="checkbox" checked={opt.sel} onChange={() => toggleSel(i)}
                      className="w-4 h-4 accent-orange-500 cursor-pointer" />
                    <input value={opt.name} onChange={e => setOption(i, "name", e.target.value)}
                      className={inp} placeholder="예: 빨강/XL" />
                    <input value={opt.price} onChange={e => setOption(i, "price", e.target.value)}
                      type="number" min="0" className={inp} placeholder="판매가" />
                    <input value={opt.supply} onChange={e => setOption(i, "supply", e.target.value)}
                      type="number" min="0" className={inp} placeholder="공급가" />
                    <input value={opt.stock} onChange={e => setOption(i, "stock", e.target.value)}
                      type="number" min="0" className={inp} placeholder="0" />
                    <button type="button" onClick={() => setOptionActive(i, !opt.active)}
                      className={`text-xs font-bold px-2 py-1.5 rounded-lg border transition-colors ${
                        opt.active
                          ? "bg-green-50 border-green-200 text-green-600 hover:bg-green-100"
                          : "bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200"
                      }`}
                      title="클릭하여 판매중/판매중지 전환">
                      {opt.active ? "판매중" : "판매중지"}
                    </button>
                    <button type="button" onClick={() => removeOption(i)}
                      className="text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={confirmOptionStock}
                  className="text-xs bg-gray-800 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors">
                  재고 확인
                </button>
                <p className="text-xs text-gray-500">
                  {stockConfirmed
                    ? <span className="text-green-600 font-semibold">총 재고 {Number(form.stock).toLocaleString()}개 반영됨</span>
                    : <>옵션 합계: <b>{optionStockTotal}</b>개 → 확인 눌러서 반영</>
                  }
                </p>
              </div>
            </>
          )}
        </Section>

        {/* ⑤-2 추가옵션(추가상품) */}
        <Section title="추가옵션 (추가상품)" action={
          <button type="button" onClick={addAddon} className="text-xs text-orange-500 font-bold hover:text-orange-600">
            + 추가옵션
          </button>
        }>
          <p className="text-xs text-gray-400 mb-3">
            메인상품 구매 시 함께 담을 수 있는 부가상품이에요. (예: 아이스팩 +1,000 / 보냉백 +3,000)
            <br />고객은 <b>메인상품(옵션)</b>을 선택해야 추가옵션을 담을 수 있어요.
          </p>
          {addons.length === 0 ? (
            <p className="text-sm text-gray-300 py-2">등록된 추가옵션이 없어요. "+ 추가옵션"으로 추가하세요.</p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_110px_92px_28px] gap-2 text-xs text-gray-400">
                  <span>추가옵션명</span><span>추가금액(원)</span><span>판매상태</span><span />
                </div>
                {addons.map((ad, i) => (
                  <div key={i} className="grid grid-cols-[1fr_110px_92px_28px] gap-2 items-center">
                    <input value={ad.name} onChange={e => setAddon(i, "name", e.target.value)}
                      className={inp} placeholder="예: 아이스팩 추가" />
                    <input value={ad.price} onChange={e => setAddon(i, "price", e.target.value)}
                      type="number" min="0" className={inp} placeholder="1000" />
                    <button type="button" onClick={() => setAddonActive(i, !ad.active)}
                      className={`text-xs font-bold px-2 py-1.5 rounded-lg border transition-colors ${
                        ad.active
                          ? "bg-green-50 border-green-200 text-green-600 hover:bg-green-100"
                          : "bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200"
                      }`}
                      title="클릭하여 판매중/판매중지 전환">
                      {ad.active ? "판매중" : "판매중지"}
                    </button>
                    <button type="button" onClick={() => removeAddon(i)}
                      className="text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 pt-3 mt-1 border-t border-gray-100 cursor-pointer">
                <input type="checkbox" checked={addonMulti} onChange={e => setAddonMulti(e.target.checked)}
                  className="w-4 h-4 accent-orange-500" />
                <span className="text-sm text-gray-600">여러 개 선택 허용 <span className="text-xs text-gray-400">(끄면 추가옵션 중 1개만 선택 가능)</span></span>
              </label>
            </>
          )}
        </Section>

        {/* ⑥ 배송 */}
        <Section title="배송">
          <div>
            <label className={lbl}>배송 방법</label>
            <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">택배</div>
          </div>
          <div>
            <label className={lbl}>배송 속성</label>
            <div className="flex gap-2 mb-2">
              {[{ value: "standard", label: "일반 배송" }, { value: "custom", label: "당일 출고" }].map(a => (
                <button key={a.value} type="button" onClick={() => set("shipping_attr", a.value)}
                  className={`px-4 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    form.shipping_attr === a.value
                      ? "border-orange-400 bg-orange-50 text-orange-600"
                      : "border-gray-200 text-gray-500"
                  }`}>
                  {a.label}
                </button>
              ))}
            </div>
            {form.shipping_attr === "custom" && (
              <input value={form.shipping_attr_custom} onChange={e => set("shipping_attr_custom", e.target.value)}
                className={inp} placeholder="예: 오후 2시 이전 주문 시 당일 출고" />
            )}
          </div>
          <div>
            <label className={lbl}>택배사</label>
            <select value={form.shipping_carrier} onChange={e => set("shipping_carrier", e.target.value)} className={inp}>
              <optgroup label="── 메이저 ──">
                <option value="04">CJ대한통운</option>
                <option value="05">한진택배</option>
                <option value="08">롯데택배</option>
                <option value="01">우체국택배</option>
                <option value="06">로젠택배</option>
              </optgroup>
              <optgroup label="── 기타 ──">
                <option value="23">경동택배</option>
                <option value="26">대신택배</option>
                <option value="40">GS편의점택배</option>
                <option value="41">드림택배</option>
                <option value="46">일양로지스</option>
                <option value="53">CU편의점택배</option>
                <option value="68">우리택배</option>
                <option value="77">합동택배</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label className={lbl}>배송비 설정</label>
            <select value={form.shipping_type} onChange={e => set("shipping_type", e.target.value)} className={inp}>
              <option value="free">무료배송</option>
              <option value="paid">유료배송</option>
              <option value="conditional_free">조건부 무료배송 (기준금액 이상 무료)</option>
              <option value="per_unit">건별 유료배송 (1건 무료 / 합배송 유료)</option>
            </select>
          </div>
          {(form.shipping_type === "paid" || form.shipping_type === "conditional_free") && (
            <div>
              <label className={lbl}>배송비 (원)</label>
              <input value={form.shipping_cost} onChange={e => set("shipping_cost", e.target.value)}
                type="number" min="0" className={inp} />
            </div>
          )}
          {form.shipping_type === "conditional_free" && (
            <div>
              <label className={lbl}>무료배송 기준금액 (원 이상)</label>
              <input value={form.free_shipping_threshold} onChange={e => set("free_shipping_threshold", e.target.value)}
                type="number" min="0" className={inp} placeholder="예: 30000" />
            </div>
          )}
          {form.shipping_type === "per_unit" && (
            <div>
              <label className={lbl}>2건째부터 건별 배송비 (원)</label>
              <input value={form.per_unit_shipping_cost} onChange={e => set("per_unit_shipping_cost", e.target.value)}
                type="number" min="0" className={inp} />
              <p className="text-xs text-gray-400 mt-1">1건은 무료, 합배송 시 이 금액이 추가됩니다</p>
            </div>
          )}
          <div>
            <label className={lbl}>제주 및 도서산간 추가 배송비 (원)</label>
            <input value={form.island_shipping_cost} onChange={e => set("island_shipping_cost", e.target.value)}
              type="number" min="0" className={inp} placeholder="0 (미적용)" />
          </div>
          <div>
            <label className={lbl}>별도 설치비 (원)</label>
            <input value={form.installation_cost} onChange={e => set("installation_cost", e.target.value)}
              type="number" min="0" className={inp} placeholder="0 (없음)" />
            <p className="text-xs text-gray-400 mt-1">실링팬 등 설치가 필요한 제품에 적용</p>
          </div>
          <div>
            <label className={lbl}>출고지 주소</label>
            <input value={form.release_address} onChange={e => set("release_address", e.target.value)}
              className={inp} placeholder="위탁배송 출고지 주소 (브랜드사 주소)" />
          </div>
          <div>
            <label className={lbl}>반품지 주소</label>
            <input value={form.return_address} onChange={e => set("return_address", e.target.value)}
              className={inp} placeholder="반품지 주소 (출고지와 다를 경우)" />
          </div>
        </Section>

        {/* ⑦ 반품 & 교환 */}
        <Section title="반품 & 교환">
          <Grid2>
            <div>
              <label className={lbl}>반품 비용 — 편도 (원)</label>
              <input value={form.return_cost_oneway} onChange={e => set("return_cost_oneway", e.target.value)}
                type="number" min="0" className={inp} />
            </div>
            <div>
              <label className={lbl}>반품 비용 — 왕복 (원)</label>
              <input value={form.return_cost_roundtrip} onChange={e => set("return_cost_roundtrip", e.target.value)}
                type="number" min="0" className={inp} />
            </div>
          </Grid2>
          <Grid2>
            <div>
              <label className={lbl}>교환 비용 — 편도 (원)</label>
              <input value={form.exchange_cost_oneway} onChange={e => set("exchange_cost_oneway", e.target.value)}
                type="number" min="0" className={inp} />
            </div>
            <div>
              <label className={lbl}>교환 비용 — 왕복 (원)</label>
              <input value={form.exchange_cost_roundtrip} onChange={e => set("exchange_cost_roundtrip", e.target.value)}
                type="number" min="0" className={inp} />
            </div>
          </Grid2>
        </Section>

        {/* ⑧ A/S */}
        <Section title="A/S 특이사항">
          <textarea value={form.as_notes} onChange={e => set("as_notes", e.target.value)}
            rows={4} className={`${inp} resize-y`}
            placeholder="A/S 관련 특이사항을 입력하세요" />
        </Section>

        {/* ⑨ 상세 페이지 */}
        <Section title="상세 페이지" action={
          <button type="button" onClick={() => setDetailFullscreen(true)}
            className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
            전체화면 편집 ↗
          </button>
        }>
          <p className="text-xs text-gray-400">스마트스토어 등에서 글씨·이미지를 복사해 붙여넣으면 서식·이미지가 그대로 들어가요 (Ctrl+V)</p>
          <RichEditor
            value={form.detail_html}
            onChange={v => set("detail_html", v)}
            className="min-h-[240px] max-h-[520px] overflow-auto border border-gray-200 rounded-lg p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 [&_img]:max-w-full [&_img]:rounded-lg"
            style={{ lineHeight: 1.6 }}
            placeholder="여기에 상세 내용을 붙여넣으세요"
          />
        </Section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => router.back()}
            className="flex-1 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
            {saving
              ? (mode === "new" ? "등록 중..." : "저장 중...")
              : (mode === "new" ? "상품 등록" : "저장")}
          </button>
        </div>
      </form>

      {/* 상세 페이지 전체화면 모달 */}
      {detailFullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
            <div>
              <p className="text-sm font-bold text-gray-800">상세 페이지 편집</p>
              <p className="text-xs text-gray-400 mt-0.5">스마트스토어 등에서 복사해 붙여넣으면 서식·이미지가 그대로 들어가요</p>
            </div>
            <button type="button" onClick={() => setDetailFullscreen(false)}
              className="bg-gray-900 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-gray-700 transition-colors">
              완료
            </button>
          </div>
          <RichEditor
            value={form.detail_html}
            onChange={v => set("detail_html", v)}
            className="flex-1 p-6 text-sm overflow-auto focus:outline-none [&_img]:max-w-full [&_img]:rounded-lg"
            style={{ lineHeight: 1.7 }}
            placeholder="여기에 상세 내용을 붙여넣으세요"
          />
        </div>
      )}
    </div>
  );
}

function ImageSlot({
  url, uploading, onFile, onUrl, onClear, large = false,
}: {
  url: string;
  uploading: boolean;
  onFile: (f: File) => void;
  onUrl: (url: string) => void;
  onClear: () => void;
  large?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) onFile(file);
        return;
      }
    }
    // 이미지 파일이 아니면 URL 텍스트 붙여넣기로 처리 (기본 동작 유지)
  }

  return (
    <div className="space-y-1.5">
      <div
        className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-gray-50 transition-colors ${
          large ? "aspect-[4/3]" : "aspect-square"
        } ${url ? "border-gray-200" : "border-gray-200 hover:border-orange-300 cursor-pointer"}`}
        onClick={() => !url && fileRef.current?.click()}
      >
        {url ? (
          <>
            <img src={url} alt="" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClear(); }}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
              className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded-lg transition-colors"
            >
              변경
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-300">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {large && <span className="text-xs">클릭·파일업로드·붙여넣기(Ctrl+V)</span>}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-xs text-white font-medium">업로드 중...</span>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" className="hidden" ref={fileRef}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <input
        value={url}
        onChange={e => onUrl(e.target.value)}
        onPaste={handlePaste}
        onClick={e => e.stopPropagation()}
        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400 text-gray-600 placeholder-gray-300"
        placeholder="URL 입력 또는 이미지 붙여넣기(Ctrl+V)"
      />
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Grid2({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-4 ${className ?? ""}`}>{children}</div>;
}
