"use client";

import { useState, useEffect, useRef, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import RichEditor from "@/components/admin/RichEditor";
import { productInputError } from "@/lib/product-required";
import { useSiteKey } from "@/components/SiteContext";
import { suggestCategories } from "@/lib/admin-workflow";
import { SITES } from "@/lib/sites";
import { sanjiSecretLinkUrl } from "@/lib/secret-link";
import { shrinkImage, uploadErrorMessage } from "@/lib/client-image";

interface Category { id: string; name: string; }
// active: 판매상태(판매중/판매중지), sel: 일괄편집용 체크 상태(저장에는 미포함)
interface OptionRow { id?: string; name: string; price: string; stock: string; active: boolean; sel: boolean; supply: string; linkPrice?: string; }
// 추가옵션(추가상품): 메인 구매 시 함께 살 수 있는 부가상품
interface AddonRow { supply: string; name: string; price: string; active: boolean; }

const STEP_TITLES = ["기본 정보", "가격·옵션", "판매 설정", "배송·최종 확인"];
const StepContext = createContext(0);
const SECTION_STEP: Record<string, number> = {"상품코드로 복제 등록":0,"기본 정보":0,"이미지":0,"상세 페이지":0,"판매가":1,"재고 & 옵션":1,"추가옵션 (추가상품)":1,"판매 상태":2,"비전시 링크":2,"배송":3,"반품 & 교환":3,"A/S 특이사항":3};
const SHIPPING_KEYS = ["shipping_type", "shipping_cost", "shipping_carrier", "free_shipping_threshold", "per_unit_shipping_cost", "island_shipping_cost", "remote_zipcodes", "release_address", "return_address", "return_cost_oneway", "return_cost_roundtrip", "exchange_cost_oneway", "exchange_cost_roundtrip"] as const;
const EMPTY_IMAGES = ["", "", "", "", ""];

// 관리자 토큰 만료(401) 시 안내 — 새 탭 재로그인이면 이 화면의 입력 내용은 그대로 유지된다
const SESSION_EXPIRED_MSG =
  "관리자 로그인이 만료됐어요. 이 화면은 그대로 두고, 새 탭에서 관리자 로그인을 다시 한 뒤 돌아와서 등록 버튼을 다시 눌러주세요. (입력한 내용은 유지돼요)";

interface Props {
  mode: "new" | "edit";
  productId?: string;
}

export default function ProductFormClient({ mode, productId }: Props) {
  const router = useRouter();
  const currentSiteKey=useSiteKey();
  const [step, setStep] = useState(0);
  const [manualStatus, setManualStatus] = useState("draft");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<string[]>([...EMPTY_IMAGES]);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [loadedVersion,setLoadedVersion]=useState<string|null>(null);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [addonMulti, setAddonMulti] = useState(true);
  const [stockConfirmed, setStockConfirmed] = useState(false);
  const [detailFullscreen, setDetailFullscreen] = useState(false);

  // 공동구매 인플루언서 태그 — 태그 1명당 상품 1개씩 복제 등록
  // 제목은 [이름 X 브랜드] 상품명 양식으로 자동, 공구기간(판매기간)만 태그별 개별 입력
  const [infList, setInfList] = useState<{ id: string; name: string }[]>([]);
  const [infTags, setInfTags] = useState<{ influencerId: string; start: string; end: string }[]>([]);

  // 비전시 링크 — 상품은 항상 전시(기본값)되고, 켜면 전용 가격으로 파는 비공개 링크가 하나 더 생긴다
  // useLink: 사용 여부 (끄고 저장하면 링크 해제·링크가격 삭제) · linkCode: 발급된 코드 (저장 시 없으면 자동 발급)
  const [useLink, setUseLink] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [form, setForm] = useState({
    name: "", brand: "", category: "",
    link_start_at: "", link_end_at: "",
    link_price: "",       // 비전시 링크로 들어왔을 때 적용되는 판매가 (비우면 전시가 그대로)
    manufacturer: "", origin_country: "",
    product_condition: "new", manufacture_date: "",
    sale_type: "always",
    supplier_name: "", expected_ship_date: "",
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
    island_shipping_cost: "0", remote_zipcodes: "",
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
    fetch("/api/admin/categories").then(async r => {if(!r.ok)throw new Error();return r.json();}).then(d=>{if(Array.isArray(d))setCategories(d);}).catch(() => setError("상품 분류를 불러오지 못했습니다. 새로고침해주세요."));
  }, []);

  useEffect(()=>{
    if(mode!=="new")return;
    try{const raw=localStorage.getItem(`product-shipping:${location.hostname}`);if(!raw)return;const values=JSON.parse(raw);setForm(f=>({...f,...Object.fromEntries(SHIPPING_KEYS.filter(k=>typeof values[k]==="string").map(k=>[k,values[k]]))}));setNotice("저장된 배송 기본값을 적용했습니다.");}catch{/* The form's normal defaults remain available. */}
  },[mode]);

  // 인플루언서 목록 (공동구매 태그용 — 등록 모드에서만)
  useEffect(() => {
    if (mode !== "new") return;
    fetch("/api/admin/influencers")
      .then(r => r.json())
      .then((rows: { id: string; name: string }[]) => {
        if (Array.isArray(rows)) setInfList(rows.map(r => ({ id: r.id, name: r.name })));
      })
      .catch(() => {});
  }, [mode]);

  const infNameOf = (id: string) => infList.find(i => i.id === id)?.name ?? "";
  // 제목 양식: [인플루언서 X 브랜드] 상품명 (브랜드 없으면 이름만)
  const taggedTitle = (infName: string) =>
    `[${infName}${form.brand ? ` X ${form.brand}` : ""}] ${form.name}`;

  // 날짜 입력은 한국시간 의도 — 서버 저장 시 +09:00 명시 (없으면 UTC로 해석돼 9시간 밀림)
  const kstISO = (v: string) => (v ? `${v}:00+09:00` : null);
  // DB의 UTC ISO → 수정화면 표시용 KST "YYYY-MM-DDTHH:mm"
  const utcToKSTLocal = (v: string | null | undefined) => {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 16);
    return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 16);
  };

  // 상품 데이터 → 폼 채우기 (수정 모드 로드와 코드 복제 로드가 공유)
  // stripTagPrefix: "[인플루언서 X 브랜드] 상품명" 제목에서 대괄호 프리픽스 제거 (복제 시 새 태그로 다시 조합)
  function fillFromData(data: any, opts?: { stripTagPrefix?: boolean }) {
    {
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
        setManualStatus(opts?.stripTagPrefix ? "draft" : (["inactive","ended"].includes(data.status)?"soldout":data.status ?? "draft"));
        setForm({
          name: opts?.stripTagPrefix ? String(data.name ?? "").replace(/^\[[^\]]*\]\s*/, "") : (data.name ?? ""),
          brand: data.brand ?? "",
          category: data.category ?? "",
          link_start_at: utcToKSTLocal(data.link_start_at), link_end_at: utcToKSTLocal(data.link_end_at),
          link_price: data.link_price != null ? String(data.link_price) : "",
          manufacturer: data.manufacturer ?? "",
          origin_country: data.origin_country ?? "",
          product_condition: data.product_condition ?? "new",
          manufacture_date: data.manufacture_date ? String(data.manufacture_date).slice(0, 10) : "",
          sale_type: data.sale_type === "groupbuy" ? "groupbuy" : "always",
          supplier_name: data.supplier_name ?? "", expected_ship_date: data.expected_ship_date ? String(data.expected_ship_date).slice(0,10) : "",
          presale_enabled: String(data.presale_enabled ?? false),
          presale_start_at: utcToKSTLocal(data.presale_start_at),
          presale_end_at: utcToKSTLocal(data.presale_end_at),
          original_price: origPrice,
          discount_rate: discountRate,
          price,
          instant_discount_price: data.instant_discount_price ? String(data.instant_discount_price) : "",
          supply_price: data.supply_price ? String(data.supply_price) : "",
          influencer_rate: data.influencer_rate != null ? String(data.influencer_rate) : "",
          sale_start_at: utcToKSTLocal(data.sale_start_at),
          sale_end_at: utcToKSTLocal(data.sale_end_at),
          tax_type: data.tax_type ?? "taxable",
          stock: String(data.stock ?? 0),
          shipping_type: data.shipping_type ?? "paid",
          shipping_cost: String(data.shipping_cost ?? 3000),
          free_shipping_threshold: data.free_shipping_threshold ? String(data.free_shipping_threshold) : "",
          per_unit_shipping_cost: data.per_unit_shipping_cost ? String(data.per_unit_shipping_cost) : "3000",
          shipping_carrier: data.shipping_carrier ?? "04",
          shipping_attr: isCustomAttr ? "custom" : "standard",
          shipping_attr_custom: isCustomAttr ? rawAttr : "",
          island_shipping_cost: String(data.island_shipping_cost ?? 0), remote_zipcodes: data.remote_zipcodes ?? "",
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
        if(mode === "edit")setLoadedVersion(data.updated_at??null);
        setOptions(
          (data.options ?? []).map((o: { id?: string; name: string; price: number; stock: number; active?: boolean; supply_price?: number | null; link_price?: number | null }) => ({
            id: opts?.stripTagPrefix ? undefined : o.id,
            linkPrice: o.link_price != null ? String(o.link_price) : "",
            name: o.name, price: String(o.price), stock: String(o.stock),
            active: o.active !== false, sel: false,
            supply: o.supply_price != null ? String(o.supply_price) : "",
          }))
        );
        setAddons(
          (data.addons ?? []).map((a: { name: string; price: number; active?: boolean; supply_price?: number | null }) => ({
            name: a.name, price: String(a.price), supply: a.supply_price == null ? "" : String(a.supply_price), active: a.active !== false,
          }))
        );
        setAddonMulti(data.addon_multi !== false);
        // 비전시 링크 코드는 복제 등록 시 새 상품으로 따라가지 않는다 (상품마다 별도 발급) — 사용 여부·링크가격은 따라간다
        const code = opts?.stripTagPrefix ? null : (data.link_code ?? null);
        setLinkCode(code);
        setUseLink(!!code || data.link_price != null);
    }
  }

  useEffect(() => {
    if (mode !== "edit" || !productId) return;
    setLoading(true);
    fetch(`/api/admin/products/${productId}`)
      .then(r => r.json())
      .then((data) => fillFromData(data))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, productId]);

  // ── 상품코드 복제 등록 — 코드 입력으로 기존 상품 정보를 그대로 채움 ──
  // 공구(공동구매) 상품이면 인플루언서 태그·공구기간만 수정 가능하게 잠금
  const [copyCode, setCopyCode] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyInfo, setCopyInfo] = useState<string | null>(null);
  const [copyLocked, setCopyLocked] = useState(false);

  async function loadFromCode() {
    const code = copyCode.trim().toUpperCase();
    if (!code) return;
    setCopyBusy(true);
    try {
      const list = await fetch("/api/admin/products").then(r => r.json());
      const hit = Array.isArray(list)
        ? list.find((p: { product_code?: string | null }) => String(p.product_code || "").toUpperCase() === code)
        : null;
      if (!hit) { alert(`상품코드 ${code} 를 찾을 수 없어요.`); return; }
      const data = await fetch(`/api/admin/products/${hit.id}`).then(r => r.json());
      fillFromData(data, { stripTagPrefix: true });
      const isGroupbuy = (data.sale_type ?? "always") === "groupbuy";
      setCopyLocked(isGroupbuy);
      if (isGroupbuy && infTags.length === 0) setInfTags([{ influencerId: "", start: "", end: "" }]);
      setCopyInfo(
        `"${data.name}" 정보를 불러왔어요.` +
        (isGroupbuy ? " 공구 상품이라 인플루언서 태그와 공구기간만 수정할 수 있어요." : "")
      );
    } finally {
      setCopyBusy(false);
    }
  }

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
    try {
      // 업로드 전에 브라우저에서 축소 (휴대폰 원본은 서버 앞단 업로드 한도에 걸릴 수 있음)
      const fd = new FormData();
      fd.append("file", await shrinkImage(file));
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) setImage(i, data.url);
      else setError(uploadErrorMessage(res.status, data));
    } catch {
      setError("사진 업로드 중 연결이 끊겼어요. 네트워크를 확인하고 다시 시도해주세요.");
    }
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
  function setOption(i: number, key: "name" | "price" | "supply" | "stock" | "supply", val: string) {
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
    setAddons(a => [...a, { name: "", price: "", supply: "", active: true }]);
  }
  function removeAddon(i: number) {
    setAddons(a => a.filter((_, idx) => idx !== i));
  }
  function setAddon(i: number, key: "name" | "price" | "supply", val: string) {
    setAddons(a => a.map((row, idx) => idx === i ? { ...row, [key]: val } : row));
  }
  function setAddonActive(i: number, val: boolean) {
    setAddons(a => a.map((row, idx) => idx === i ? { ...row, active: val } : row));
  }

  function buildPayload() {
    const shippingAttrValue = form.shipping_attr === "custom" ? form.shipping_attr_custom : "standard";
    return {
      expected_updated_at: mode === "edit" ? loadedVersion : undefined,
      name: form.name,
      brand: form.brand || null,
      category: form.category || null,
      // 비전시 링크를 끄면 링크가격은 지우고 발급된 코드도 해제 (서버 PATCH가 revoke_link 처리)
      link_start_at: kstISO(form.link_start_at), link_end_at: kstISO(form.link_end_at),
      link_price: useLink && form.link_price !== "" ? Number(form.link_price) : null,
      revoke_link: !useLink,
      manufacturer: form.manufacturer || null,
      origin_country: form.origin_country || null,
      product_condition: form.product_condition,
      manufacture_date: form.manufacture_date || null,
      sale_type: form.sale_type,
      status: manualStatus,
      supplier_name: form.supplier_name.trim() || null, expected_ship_date: form.expected_ship_date || null,
      presale_enabled: form.presale_enabled === "true",
      presale_start_at: kstISO(form.presale_start_at),
      presale_end_at: kstISO(form.presale_end_at),
      price: Number(form.price) || 0,
      original_price: form.original_price ? Number(form.original_price) : null,
      instant_discount_price: form.instant_discount_price ? Number(form.instant_discount_price) : null,
      supply_price: form.supply_price ? Number(form.supply_price) : null,
      influencer_rate: form.influencer_rate !== "" ? Number(form.influencer_rate) : null,
      sale_start_at: kstISO(form.sale_start_at),
      sale_end_at: kstISO(form.sale_end_at),
      tax_type: form.tax_type,
      stock: Number(form.stock) || 0,
      shipping_type: form.shipping_type,
      shipping_cost: Number(form.shipping_cost) || 0,
      free_shipping_threshold: form.free_shipping_threshold ? Number(form.free_shipping_threshold) : null,
      per_unit_shipping_cost: Number(form.per_unit_shipping_cost) || 0,
      shipping_carrier: form.shipping_carrier || null,
      shipping_attr: shippingAttrValue,
      island_shipping_cost: Number(form.island_shipping_cost) || 0, remote_zipcodes: form.remote_zipcodes,
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
        id: o.id, supply_price: o.supply !== "" ? Number(o.supply) : null,
        link_price: useLink && o.linkPrice !== "" && o.linkPrice != null ? Number(o.linkPrice) : null,
      })),
      addons: addons.filter(a => a.name).map(a => ({
        supply_price: a.supply !== "" ? Number(a.supply) : null,
        name: a.name, price: Number(a.price) || 0, active: a.active !== false,
      })),
      addon_multi: addonMulti,
    };
  }

  // 손익 집계에 빠지지 않도록 필수 확인 — 카테고리, 공급가(상품 공급가 또는 판매중 옵션마다 공급가)
  function validateRequired(): string | null {
    if (!form.name.trim()) { setStep(0); return "상품명을 입력해주세요."; }
    if (!form.category) { setStep(0); return "카테고리를 선택해주세요."; }
    if (form.price === "" || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) { setStep(1); return "판매가를 확인해주세요."; }
    const activeOpts = options.filter(o => o.name && o.active !== false);
    const supplyOk = form.supply_price !== "" || (activeOpts.length > 0 && activeOpts.every(o => o.supply !== ""));
    if (!supplyOk) setStep(1);
    if (!supplyOk) return activeOpts.length > 0
      ? "공급가(매입원가)를 입력해주세요. 상품 공급가를 넣거나, 판매중 옵션마다 공급가를 넣어주세요."
      : "공급가(매입원가)를 입력해주세요. 비어 있으면 이익을 확정할 수 없어요.";
    return null;
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const missing = validateRequired();
    if (missing) {
      setError(missing);
      setSaving(false);
      return;
    }
    const invalid=productInputError(buildPayload(),currentSiteKey);
    if(invalid){setStep(3);setError(invalid);setSaving(false);return;}
    if (useLink && (!form.link_start_at || !form.link_end_at || form.link_start_at >= form.link_end_at)) { setStep(2); setError("비전시 링크 시작·종료 일시를 확인해주세요."); setSaving(false); return; }

    try {
    // 공동구매 + 인플루언서 태그 → 태그별로 상품 복제 등록 (제목 양식 + 개별 공구기간)
    if (mode === "new" && form.sale_type === "groupbuy" && infTags.length > 0) {
      for (const [i, t] of infTags.entries()) {
        if (!t.influencerId) { setError(`${i + 1}번째 태그의 인플루언서를 선택해주세요.`); setSaving(false); return; }
        if (!t.start || !t.end) { setError(`${infNameOf(t.influencerId)}의 공구기간(시작·종료)을 입력해주세요.`); setSaving(false); return; }
        if (t.end <= t.start) { setError(`${infNameOf(t.influencerId)}의 공구 종료가 시작보다 빨라요.`); setSaving(false); return; }
      }
      const dupIds = new Set(infTags.map(t => t.influencerId));
      if (dupIds.size !== infTags.length) { setError("같은 인플루언서가 중복 태그되어 있어요."); setSaving(false); return; }

      const base = buildPayload();
      const created: string[] = [];
      for (const t of infTags) {
        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...base,
            name: taggedTitle(infNameOf(t.influencerId)),
            sale_start_at: kstISO(t.start),
            sale_end_at: kstISO(t.end),
            influencer_id: t.influencerId, // 소속 인플루언서 — 본인 페이지에만 노출·본인 링크만 귀속
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(
            res.status === 401
              ? SESSION_EXPIRED_MSG
              : `${infNameOf(t.influencerId)} 상품 등록 실패${created.length ? ` (${created.join(", ")}은 이미 등록됨)` : ""}: ${d.error || "오류"}`
          );
          setSaving(false);
          return;
        }
        created.push(infNameOf(t.influencerId));
      }
      router.push("/admin/products");
      router.refresh();
      setSaving(false);
      return;
    }

    const url = mode === "new" ? "/api/admin/products" : `/api/admin/products/${productId}`;
    const method = mode === "new" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    if (res.ok) {
      // 비전시 링크를 켰는데 아직 코드가 없으면 저장과 함께 자동 발급 (등록 직후 / 수정에서 처음 켠 경우)
      if (useLink && isSanjiCat && Date.parse(kstISO(form.link_end_at)!) > Date.now()) {
        const saved = await res.json().catch(() => ({}));
        const savedId = mode === "new" ? saved.id : productId;
        if (savedId) {
          const lr = await fetch(`/api/admin/products/${savedId}/secret-link`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({expected_updated_at:saved.updated_at}),
          }).catch(() => null);
          if (!lr || !lr.ok) alert("상품은 저장됐지만 비전시 링크 발급에 실패했어요. 수정 화면에서 「지금 발급」을 눌러주세요.");
        }
      }
      router.push("/admin/products");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(
        res.status === 401
          ? SESSION_EXPIRED_MSG
          : d.error || (mode === "new" ? "등록 실패" : "수정 실패")
      );
    }
    } catch { setError("저장 결과를 확인하지 못했습니다. 상품 목록을 확인한 뒤 다시 시도해주세요."); } finally { setSaving(false); }
  }

  // ── 비밀링크 발급/재발급/해제 ────────────────────────────────
  const isSanjiCat = SITES.sanjipick.categories.includes(form.category);
  const linkExpired = !!form.link_end_at && Date.parse(kstISO(form.link_end_at)!) <= Date.now();
  const secretUrl = productId && linkCode && !linkExpired ? sanjiSecretLinkUrl(productId, linkCode) : "";

  async function issueLink() {
    if (!productId) return;
    setLinkBusy(true);
    setError("");
    const res = await fetch(`/api/admin/products/${productId}/secret-link`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({expected_updated_at:loadedVersion}),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setLinkCode(d.code); setLoadedVersion(d.updated_at); }
    else setError(res.status === 401 ? SESSION_EXPIRED_MSG : d.error || "비밀링크 발급에 실패했어요.");
    setLinkBusy(false);
  }

  async function revokeLink() {
    if (!productId || !confirm("해제하면 이 링크는 잘못된 요청으로 표시되고 같은 기간에는 재발급할 수 없습니다. 해제할까요?")) return;
    setLinkBusy(true);
    const res = await fetch(`/api/admin/products/${productId}/secret-link`, { method: "DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify({expected_updated_at:loadedVersion}) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setLinkCode(null); setLoadedVersion(d.updated_at); }
    else setError(res.status === 401 ? SESSION_EXPIRED_MSG : "해제에 실패했어요.");
    setLinkBusy(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(secretUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      alert("복사에 실패했어요. 링크를 직접 선택해 복사해주세요.");
    }
  }

  async function handleDelete() {
    if (!confirm("판매를 중단하고 보관할까요? 주문·정산 이력은 유지됩니다.")) return;
    await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
    router.push("/admin/products");
    router.refresh();
  }

  const inp = "w-full border border-gray-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D6C0]";
  const lbl = "block text-xs font-medium text-gray-500 mb-1";

  if (loading) return <div className="text-sm text-gray-400">불러오는 중...</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1A1D18]">
            {mode === "new" ? "상품 등록" : "상품 수정"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {mode === "new" ? "새 상품을 등록해요" : "상품 정보를 수정해요"}
          </p>
        </div>
        {mode === "edit" && (
          <button onClick={handleDelete}
            className="text-xs text-red-400 hover:text-red-600 font-bold border border-red-200 px-3 py-1.5 rounded-none transition-colors">
            삭제
          </button>
        )}
      </div>

      <nav aria-label="상품 등록 단계" className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">{STEP_TITLES.map((title,i)=><button type="button" key={title} aria-current={step===i?"step":undefined} onClick={()=>setStep(i)} className={`border p-3 text-sm text-left ${step===i?"bg-[#2D5A27] text-white":"bg-white"}`}>{i+1}. {title}</button>)}</nav>
      <StepContext.Provider value={step}>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">

        {/* 상품코드 복제 등록 — 기존 상품 정보를 그대로 불러와 새 상품으로 등록 */}
        {mode === "new" && (
          <Section title="상품코드로 복제 등록">
            <div className="flex items-center gap-2">
              <input value={copyCode} onChange={e => setCopyCode(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); loadFromCode(); } }}
                className={`${inp} font-mono max-w-[160px]`} placeholder="예: P0012" />
              <button type="button" onClick={loadFromCode} disabled={copyBusy}
                className="shrink-0 bg-gray-900 text-white text-sm font-bold px-4 py-2 rounded-none hover:bg-gray-700 disabled:opacity-40">
                {copyBusy ? "불러오는 중..." : "불러오기"}
              </button>
              {copyLocked && (
                <button type="button" onClick={() => { setCopyLocked(false); setCopyInfo(null); }}
                  className="shrink-0 text-xs text-gray-400 hover:text-gray-600 underline">
                  잠금 해제
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {copyInfo ?? "상품 관리에서 복사한 상품코드를 붙여넣으면 그 상품 정보가 그대로 채워져요 (공구 상품은 인플루언서만 바꿔서 등록)"}
            </p>
          </Section>
        )}

        <fieldset disabled={copyLocked} className={`space-y-4 ${copyLocked ? "opacity-60" : ""}`}>
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
              <label className={lbl}>카테고리 *</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} className={inp} required>
                <option value="">카테고리 선택</option>
                {mode==="edit"&&form.category&&!categories.some(c=>c.name===form.category)&&<option value={form.category}>{form.category} (기존 분류)</option>}
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
              {suggestCategories(form.name,categories).filter(c=>c!==form.category).map(c=><button type="button" key={c} className="text-xs underline mr-2 mt-2" onClick={()=>set("category",c)}>상품명 기준 추천: {c}</button>)}
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

        </fieldset>

        {/* ② 판매 상태 */}
        <Section title="판매 상태">
          <label className="block text-sm">운영 상태 <select className="border p-2 ml-2" value={manualStatus} onChange={e=>setManualStatus(e.target.value)}><option value="draft">판매 준비</option><option value="active">판매 허용</option><option value="soldout">판매 중지·품절</option></select></label>
          <p className="text-xs text-gray-500">판매 허용 상품만 기간·재고에 따라 판매됩니다. 재고를 채워도 수동 판매 중지는 해제되지 않습니다.</p>
          <fieldset disabled={copyLocked} className={copyLocked ? "opacity-60" : ""}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "always", label: "상시 판매", sub: "기간 없이 계속 판매" },
              { value: "groupbuy", label: "공동구매", sub: "공구 기간 동안 판매" },

            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => set("sale_type", opt.value)}
                className={`p-3 rounded-none border text-left transition-colors ${
                  form.sale_type === opt.value
                    ? "border-[#C7D6C0] bg-[#EAF0E6]"
                    : "border-gray-200 hover:border-gray-300"
                }`}>
                <p className={`text-sm font-semibold ${form.sale_type === opt.value ? "text-[#2D5A27]" : "text-gray-700"}`}>
                  {opt.label}
                </p>
                {opt.sub && <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>}
              </button>
            ))}
          </div>
          </fieldset>

          {/* 공동구매 — 인플루언서 태그 (태그당 상품 1개 복제 등록, 기간 개별) — 복제 잠금과 무관하게 항상 수정 가능 */}
          {mode === "new" && form.sale_type === "groupbuy" && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">인플루언서 태그</p>
                  <p className="text-xs text-gray-400">
                    태그한 인플루언서마다 <b>[이름 X 브랜드] 상품명</b> 제목으로 상품이 각각 등록돼요 · 공구기간만 개별 입력
                  </p>
                </div>
                <button type="button"
                  onClick={() => setInfTags(t => [...t, { influencerId: "", start: "", end: "" }])}
                  className="text-xs font-bold text-[#2D5A27] border border-[#C7D6C0] px-3 py-1.5 rounded-none hover:bg-[#EAF0E6]">
                  + 인플루언서 추가
                </button>
              </div>

              {infTags.length === 0 ? (
                <p className="text-xs text-gray-300">태그 없이 등록하면 일반 공동구매 상품 1개만 등록돼요.</p>
              ) : (
                <div className="space-y-2">
                  {infTags.map((t, i) => (
                    <div key={i} className="rounded-none border border-gray-100 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {/* ① 인플루언서 태그 */}
                        <select value={t.influencerId}
                          onChange={e => setInfTags(rows => rows.map((r, idx) => idx === i ? { ...r, influencerId: e.target.value } : r))}
                          className={`${inp} flex-1`}>
                          <option value="">인플루언서 선택</option>
                          {infList.map(inf => (
                            <option key={inf.id} value={inf.id}>{inf.name}</option>
                          ))}
                        </select>
                        <button type="button"
                          onClick={() => setInfTags(rows => rows.filter((_, idx) => idx !== i))}
                          className="shrink-0 text-xs text-red-400 hover:text-red-600 px-2 py-2">
                          삭제
                        </button>
                      </div>
                      {/* ② 공구기간 (태그별 개별) */}
                      <Grid2>
                        <div>
                          <label className={lbl}>공구 시작일시</label>
                          <input type="datetime-local" value={t.start}
                            onChange={e => setInfTags(rows => rows.map((r, idx) => idx === i ? { ...r, start: e.target.value } : r))}
                            className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>공구 종료일시</label>
                          <input type="datetime-local" value={t.end}
                            onChange={e => setInfTags(rows => rows.map((r, idx) => idx === i ? { ...r, end: e.target.value } : r))}
                            className={inp} />
                        </div>
                      </Grid2>
                      {/* ③ 제목 미리보기 */}
                      {t.influencerId && form.name && (
                        <p className="text-xs text-gray-500">
                          등록될 제목: <b className="text-gray-700">{taggedTitle(infNameOf(t.influencerId))}</b>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <fieldset disabled={copyLocked} className={copyLocked ? "opacity-60" : ""}>
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">예약구매</p>
                <p className="text-xs text-gray-400">판매 전 사전 예약을 받습니다</p>
              </div>
              <button type="button"
                onClick={() => set("presale_enabled", form.presale_enabled === "true" ? "false" : "true")}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.presale_enabled === "true" ? "bg-[#2D5A27]" : "bg-gray-200"
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
          </fieldset>
        </Section>

        <fieldset disabled={copyLocked} className={`space-y-4 ${copyLocked ? "opacity-60 pointer-events-none" : ""}`}>
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

        {/* ③-1 비전시 링크 — 상품은 항상 전시(기본값). 켜면 전용 가격으로 파는 비공개 링크가 하나 더 생긴다 (산지픽 상품) */}
        {isSanjiCat && (
        <Section title="비전시 링크">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={useLink} onChange={e => setUseLink(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#2D5A27]" />
            <span>
              <span className="block text-sm font-semibold text-gray-800">비전시 링크 사용</span>
              <span className="block text-xs text-gray-400 mt-0.5">
                상품은 평소처럼 전시(메인·목록·검색)되고, 이 링크로 들어온 사람에게만 아래 링크가격이 적용돼요. 링크는 어디에도 노출되지 않아요.
              </span>
            </span>
          </label>

          {useLink && (
            <>
              <Grid2>
                <div><label className={lbl}>링크 시작 (한국시간)</label><input type="datetime-local" required value={form.link_start_at} onChange={e=>set("link_start_at",e.target.value)} className={inp}/></div>
                <div><label className={lbl}>링크 종료 (한국시간)</label><input type="datetime-local" required value={form.link_end_at} onChange={e=>set("link_end_at",e.target.value)} className={inp}/></div>
              </Grid2>
              <p className="text-xs text-gray-500">한 기간에 링크 하나만 사용합니다. 시작 전·종료 후에는 “잘못된 요청입니다”로 표시하고 구매를 차단합니다. 기간을 바꾸면 기존 링크가 해제됩니다.</p>
              <Grid2>
                <div>
                  <label className={lbl}>전시가격 (판매가)</label>
                  <input readOnly value={form.price ? `${Number(form.price).toLocaleString()}원` : "아래 판매가에서 입력"} className={`${inp} bg-gray-50 text-gray-500`} tabIndex={-1} />
                  <p className="text-xs text-gray-400 mt-1">일반 방문자에게 보이는 가격 — 아래 「판매가」 칸이 그대로 전시가예요</p>
                </div>
                <div>
                  <label className={lbl}>링크가격 (링크 전용가)</label>
                  <input value={form.link_price} onChange={e => set("link_price", e.target.value)}
                    type="number" min="0" className={inp} placeholder="옵션 없는 상품의 비전시 판매가" />
                  {form.link_price !== "" && form.price && (
                    <p className="text-xs mt-1 font-medium text-[#2D5A27]">
                      {Number(form.link_price) < Number(form.price)
                        ? `→ 링크로 들어오면 ${(Number(form.price) - Number(form.link_price)).toLocaleString()}원 저렴`
                        : Number(form.link_price) > Number(form.price)
                          ? `→ 링크로 들어오면 ${(Number(form.link_price) - Number(form.price)).toLocaleString()}원 비쌈`
                          : "→ 전시가와 같음"}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">옵션 상품은 아래에서 비전시 가격을 각각 입력합니다. 빈 옵션은 비전시 판매에서 제외됩니다.</p>
                </div>
              </Grid2>
              {options.length > 0 && <div className="space-y-2">
                <p className="text-sm font-semibold">옵션별 판매가격</p>
                {options.filter(o=>o.name).map((o)=> <div key={o.name} className="grid grid-cols-3 items-center gap-3 text-sm">
                  <span>{o.name}</span><span>전시 {Number(o.price).toLocaleString()}원</span>
                  <input aria-label={`${o.name} 비전시 가격`} type="number" min="0" step="1" placeholder="비전시 제외" value={o.linkPrice ?? ""} onChange={e=>setOptions(prev=>prev.map(v=>v===o?{...v,linkPrice:e.target.value}:v))} className={inp}/>
                </div>)}
              </div>}
              <div>
                <label className={lbl}>링크 주소</label>
                {mode === "new" ? (
                  <p className="text-xs text-gray-400">등록하면 추측할 수 없는 코드가 붙은 링크가 자동 발급돼요. 상품 목록의 「링크 복사」나 수정 화면에서 복사할 수 있어요.</p>
                ) : linkExpired ? (<p className="text-sm text-gray-500">종료된 링크입니다. 고객에게는 “잘못된 요청입니다”로 표시됩니다. 새 기간을 설정하고 저장하면 새 링크를 발급합니다.</p>) : linkCode ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input readOnly value={secretUrl} onFocus={e => e.currentTarget.select()}
                        className={`${inp} font-mono text-xs bg-gray-50`} />
                      <button type="button" onClick={copyLink}
                        className="shrink-0 bg-[#2D5A27] hover:bg-[#244B1F] text-white text-xs font-bold px-3 py-2 rounded-none">
                        {linkCopied ? "✓ 복사됨" : "링크 복사"}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => issueLink()} disabled={linkBusy}
                        className="text-xs text-gray-500 hover:text-gray-800 underline disabled:opacity-40">저장된 기간의 링크 확인</button>
                    </div>
                    <p className="text-xs text-gray-400">
                      가격·기간을 바꿨다면 저장해주세요. 체크를 끄고 저장하면 즉시 해제됩니다. 종료·해제한 링크는 다시 살아나지 않으며 과거 주문은 보존됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => issueLink()} disabled={linkBusy}
                      className="border border-[#C7D6C0] text-[#2D5A27] hover:bg-[#EAF0E6] text-xs font-bold px-3 py-2 rounded-none disabled:opacity-40">
                      {linkBusy ? "발급 중..." : "🔗 지금 발급"}
                    </button>
                    <p className="text-xs text-gray-400">저장할 때 자동으로 발급되기도 해요.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </Section>
        )}

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
                <p className="text-xs text-[#2D5A27] mt-1 font-medium">→ {discountAmount.toLocaleString()}원 절약</p>
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
              <label className={lbl}>공급가 (매입원가) *</label>
              <input value={form.supply_price} onChange={e => set("supply_price", e.target.value)}
                type="number" min="0" className={inp} placeholder="손익관리용 — 고객에게 노출 안 됨"
                required={!options.some(o => o.name && o.active !== false)} />
              <p className="text-xs text-gray-400 mt-1">손익 집계에 꼭 필요해요. 옵션별 공급가가 다르면 아래 옵션 행마다 개별 입력 (옵션값 우선 적용)</p>
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
                  className={`flex-1 py-2 rounded-none border text-xs font-medium transition-colors ${
                    form.tax_type === t.value
                      ? "border-[#C7D6C0] bg-[#EAF0E6] text-[#2D5A27]"
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
          <button type="button" onClick={addOption} className="text-xs text-[#2D5A27] font-bold hover:text-[#244B1F]">
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
                <div className="mb-3 rounded-none bg-[#EAF0E6] border border-[#C7D6C0] p-3 space-y-2">
                  <p className="text-xs font-bold text-[#2D5A27]">선택한 {selCount}개 옵션 일괄 변경</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                        type="number" min="0" placeholder="판매가"
                        className="w-24 border border-gray-200 rounded-none px-2 py-1.5 text-sm focus:outline-none focus:border-[#C7D6C0]" />
                      <button type="button" onClick={applyBulkPrice}
                        className="text-xs bg-white border border-[#C7D6C0] text-[#2D5A27] font-semibold px-3 py-1.5 rounded-none hover:bg-[#EAF0E6]">판매가 적용</button>
                    </div>
                    <div className="flex items-center gap-1">
                      <input value={bulkStock} onChange={e => setBulkStock(e.target.value)}
                        type="number" min="0" placeholder="재고"
                        className="w-20 border border-gray-200 rounded-none px-2 py-1.5 text-sm focus:outline-none focus:border-[#C7D6C0]" />
                      <button type="button" onClick={applyBulkStock}
                        className="text-xs bg-white border border-[#C7D6C0] text-[#2D5A27] font-semibold px-3 py-1.5 rounded-none hover:bg-[#EAF0E6]">재고 적용</button>
                    </div>
                    <span className="w-px h-5 bg-orange-200" />
                    <button type="button" onClick={() => applyBulkStatus(true)}
                      className="text-xs bg-white border border-green-200 text-green-600 font-semibold px-3 py-1.5 rounded-none hover:bg-green-50">판매중으로</button>
                    <button type="button" onClick={() => applyBulkStatus(false)}
                      className="text-xs bg-white border border-gray-200 text-gray-500 font-semibold px-3 py-1.5 rounded-none hover:bg-gray-50">판매중지로</button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <div className="grid grid-cols-[24px_1fr_90px_90px_70px_92px_28px] gap-2 text-xs text-gray-400 items-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelAll}
                    className="w-4 h-4 accent-[#2D5A27] cursor-pointer" title="전체 선택/해제" />
                  <span>옵션명</span><span>옵션 가격</span><span>공급가</span><span>재고</span><span>판매상태</span><span />
                </div>
                {options.map((opt, i) => (
                  <div key={i} className="grid grid-cols-[24px_1fr_90px_90px_70px_92px_28px] gap-2 items-center">
                    <input type="checkbox" checked={opt.sel} onChange={() => toggleSel(i)}
                      className="w-4 h-4 accent-[#2D5A27] cursor-pointer" />
                    <input value={opt.name} onChange={e => setOption(i, "name", e.target.value)}
                      className={inp} placeholder="예: 빨강/XL" />
                    <input value={opt.price} onChange={e => setOption(i, "price", e.target.value)}
                      type="number" min="0" className={inp} placeholder="판매가" />
                    <input value={opt.supply} onChange={e => setOption(i, "supply", e.target.value)}
                      type="number" min="0" className={inp} placeholder={form.supply_price ? "공급가 (비우면 상품 공급가)" : "공급가 *"} />
                    <input value={opt.stock} onChange={e => setOption(i, "stock", e.target.value)}
                      type="number" min="0" className={inp} placeholder="0" />
                    <button type="button" onClick={() => setOptionActive(i, !opt.active)}
                      className={`text-xs font-bold px-2 py-1.5 rounded-none border transition-colors ${
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
                  className="text-xs bg-gray-800 text-white px-4 py-2 rounded-none font-semibold hover:bg-gray-700 transition-colors">
                  재고 확인
                </button>
                <p className="text-xs text-gray-500">
                  {stockConfirmed
                    ? <span className="text-green-600 font-semibold">총 재고 {Number(form.stock).toLocaleString()}개 반영됨</span>
                    : <>옵션 합계: <b>{optionStockTotal}</b>개 — 저장하면 자동 반영돼요</>
                  }
                </p>
              </div>
            </>
          )}
        </Section>

        {/* ⑤-2 추가옵션(추가상품) */}
        <Section title="추가옵션 (추가상품)" action={
          <button type="button" onClick={addAddon} className="text-xs text-[#2D5A27] font-bold hover:text-[#244B1F]">
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
                <div className="grid grid-cols-[1fr_100px_100px_92px_28px] gap-2 text-xs text-gray-400">
                  <span>추가옵션명</span><span>추가금액(원)</span><span>공급가(원)</span><span>판매상태</span><span />
                </div>
                {addons.map((ad, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_100px_92px_28px] gap-2 items-center">
                    <input value={ad.name} onChange={e => setAddon(i, "name", e.target.value)}
                      className={inp} placeholder="예: 아이스팩 추가" />
                    <input value={ad.price} onChange={e => setAddon(i, "price", e.target.value)}
                      type="number" min="0" className={inp} placeholder="1000" />
                    <input aria-label={`${ad.name} 공급가`} value={ad.supply} onChange={e=>setAddon(i,"supply",e.target.value)} type="number" min="0" className={inp} placeholder="공급가 필수" />
                    <button type="button" onClick={() => setAddonActive(i, !ad.active)}
                      className={`text-xs font-bold px-2 py-1.5 rounded-none border transition-colors ${
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
                  className="w-4 h-4 accent-[#2D5A27]" />
                <span className="text-sm text-gray-600">여러 개 선택 허용 <span className="text-xs text-gray-400">(끄면 추가옵션 중 1개만 선택 가능)</span></span>
              </label>
            </>
          )}
        </Section>

        {/* ⑥ 배송 */}
        <Section title="배송">
          <div className="flex gap-3 text-sm"><button type="button" className="underline" onClick={()=>{try{localStorage.setItem(`product-shipping:${location.hostname}`,JSON.stringify(Object.fromEntries(SHIPPING_KEYS.map(k=>[k,form[k]]))));setNotice("이 사이트의 배송 기본값을 저장했습니다.");}catch{setNotice("브라우저 저장 공간을 사용할 수 없습니다.");}}}>현재 배송값을 기본값으로 저장</button><button type="button" className="underline" onClick={()=>{try{const raw=localStorage.getItem(`product-shipping:${location.hostname}`);if(!raw){setNotice("저장된 배송 기본값이 없습니다.");return;}const values=JSON.parse(raw);setForm(f=>({...f,...Object.fromEntries(SHIPPING_KEYS.filter(k=>typeof values[k]==="string").map(k=>[k,values[k]]))}));setNotice("배송 기본값을 불러왔습니다. 저장 전에 확인해주세요.");}catch{setNotice("배송 기본값을 불러오지 못했습니다.");}}}>배송 기본값 불러오기</button></div>
          {notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
          <Grid2><label className="text-sm">발주 공급사<input className="block border p-2 w-full" maxLength={120} value={form.supplier_name} onChange={e=>set("supplier_name",e.target.value)} placeholder="실제 발주할 공급사" /></label><label className="text-sm">출고 예정일<input className="block border p-2 w-full" type="date" value={form.expected_ship_date} onChange={e=>set("expected_ship_date",e.target.value)} /></label></Grid2>
          <div>
            <label className={lbl}>배송 방법</label>
            <div className="border border-gray-200 rounded-none px-3 py-2 text-sm text-gray-400 bg-gray-50">택배</div>
          </div>
          <div>
            <label className={lbl}>배송 속성</label>
            <div className="flex gap-2 mb-2">
              {[{ value: "standard", label: "일반 배송" }, { value: "custom", label: "당일 출고" }].map(a => (
                <button key={a.value} type="button" onClick={() => set("shipping_attr", a.value)}
                  className={`px-4 py-2 rounded-none border text-xs font-medium transition-colors ${
                    form.shipping_attr === a.value
                      ? "border-[#C7D6C0] bg-[#EAF0E6] text-[#2D5A27]"
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
          <div><label className={lbl}>추가 배송비 적용 우편번호</label><textarea className={inp} value={form.remote_zipcodes} onChange={e=>set("remote_zipcodes",e.target.value)} placeholder="택배사 계약 기준 5자리 번호 또는 시작-종료 범위, 쉼표로 구분" maxLength={12000}/><p className="text-xs text-gray-500 mt-1">도서산간 추가비가 있으면 필수입니다. 택배사 계약상 추가 요금 지역을 입력하세요. 해당 우편번호에만 자동 부과합니다.</p></div>
          <p className="text-xs text-gray-500">같은 공급사·출고지·택배사 상품은 고정 배송비 중 큰 금액으로 묶습니다. 정보가 하나라도 없으면 상품별로 계산합니다. 조건부 무료는 각 상품 금액 기준입니다.</p>
          <div>
            <label className={lbl}>개당 설치비 (원)</label>
            <input value={form.installation_cost} onChange={e => set("installation_cost", e.target.value)}
              type="number" min="0" className={inp} placeholder="0 (없음)" />
            <p className="text-xs text-gray-400 mt-1">설치가 포함된 상품에 적용합니다. 상품 수량만큼 결제에 합산되며 배송비와 별도로 표시합니다. 설치비의 공급원가 확인 전에는 순이익이 미확정으로 표시됩니다.</p>
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
            className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-none transition-colors">
            전체화면 편집 ↗
          </button>
        }>
          <p className="text-xs text-gray-400">스마트스토어 등에서 글씨·이미지를 복사해 붙여넣거나(Ctrl+V), 사진 파일을 끌어다 놓으면 업로드돼 들어가요</p>
          <RichEditor
            value={form.detail_html}
            onChange={v => set("detail_html", v)}
            className="min-h-[240px] max-h-[520px] overflow-auto border border-gray-200 rounded-none p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C7D6C0] [&_img]:max-w-full [&_img]:rounded-none"
            style={{ lineHeight: 1.6 }}
            placeholder="여기에 상세 내용을 붙여넣으세요"
          />
        </Section>

        </fieldset>

        {step===3&&<div className="border p-4 bg-white text-sm space-y-2"><strong>저장 전 확인</strong><p>{form.name||"상품명 미입력"} · {form.category||"분류 미선택"} · {Number(form.price).toLocaleString()}원</p><p>{manualStatus==="draft"?"판매 준비":manualStatus==="active"?"판매 허용":"판매 중지"} / {form.sale_type==="groupbuy"?"공동구매":"상시 판매"} / 비전시 링크 {useLink?"사용":"미사용"}</p><p>공급사: {form.supplier_name||"미지정"} · 출고 예정: {form.expected_ship_date||"미지정"}</p><p className="text-gray-500">기존 상품 복제 시 재고·가격·판매 기간을 다시 확인해주세요.</p></div>}
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => router.back()}
            className="flex-1 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-none text-sm hover:bg-gray-50 transition-colors">
            취소
          </button>
          {step>0&&<button type="button" className="border px-4" onClick={()=>setStep(step-1)}>이전</button>}
          {step<3&&<button type="button" className="bg-[#2D5A27] text-white px-6" onClick={()=>setStep(step+1)}>다음</button>}
          <button type="submit" hidden={step!==3} disabled={saving}
            className="flex-1 bg-[#2D5A27] hover:bg-[#244B1F] text-white font-bold py-2.5 rounded-none text-sm transition-colors disabled:opacity-50">
            {saving
              ? (mode === "new" ? "등록 중..." : "저장 중...")
              : mode !== "new" ? "저장"
              : form.sale_type === "groupbuy" && infTags.length > 0
              ? `상품 ${infTags.length}개 등록 (인플루언서별)`
              : "상품 등록"}
          </button>
        </div>
      </form>
      </StepContext.Provider>

      {/* 상세 페이지 전체화면 모달 */}
      {detailFullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
            <div>
              <p className="text-sm font-bold text-gray-800">상세 페이지 편집</p>
              <p className="text-xs text-gray-400 mt-0.5">복사해 붙여넣거나(Ctrl+V) 사진 파일을 끌어다 놓으면 들어가요</p>
            </div>
            <button type="button" onClick={() => setDetailFullscreen(false)}
              className="bg-gray-900 text-white text-sm font-bold px-5 py-2 rounded-none hover:bg-gray-700 transition-colors">
              완료
            </button>
          </div>
          <RichEditor
            value={form.detail_html}
            onChange={v => set("detail_html", v)}
            className="flex-1 p-6 text-sm overflow-auto focus:outline-none [&_img]:max-w-full [&_img]:rounded-none"
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
        className={`relative overflow-hidden rounded-none border-2 border-dashed bg-gray-50 transition-colors ${
          large ? "aspect-[4/3]" : "aspect-square"
        } ${url ? "border-gray-200" : "border-gray-200 hover:border-[#2D5A27] cursor-pointer"}`}
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
              className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded-none transition-colors"
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
        className="w-full text-xs border border-gray-200 rounded-none px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#C7D6C0] text-gray-600 placeholder-gray-300"
        placeholder="URL 입력 또는 이미지 붙여넣기(Ctrl+V)"
      />
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const step = useContext(StepContext);
  return (
    <div hidden={(SECTION_STEP[title]??0)!==step} className="bg-white rounded-none border border-gray-100 p-6 space-y-4">
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
