"use client";
import { apiErrorMessage, readApiJson } from '@/lib/api-error-message';

import { useEffect, useMemo, useState, useRef } from "react";
import { parseTrackingXlsx } from '@/lib/tracking-xlsx';
import { parseTrackingCSV, type TrackingRow } from "@/lib/shipping-flow";
import { resolveImportCarrier, type ImportReview } from "@/lib/tracking-import";
import type { ShipmentImportResult } from "@/lib/admin-shipment-import";
import { CORE_CARRIERS, carrierName as libCarrierName } from "@/lib/carriers";
import { downloadXlsx } from "@/lib/xlsx-download";
import ReturnsPanel from "@/components/admin/ReturnsPanel";
import Link from "next/link";
import SiteBadge from "@/components/admin/SiteBadge";
import { matchesOrderSearch, selectionAction, shipmentStatusMatches } from "@/lib/admin-list-workspace";
import { useSiteKey } from "@/components/SiteContext";
import { formatPhone } from "@/lib/phone-format";

interface OrderItem {
  product_id: string | null; // 추가옵션 행은 null
  product_name: string;
  option_label: string | null;
  quantity: number;
  supplier_name?: string | null; expected_ship_date?: string | null;
}

export interface ShipmentOrder {
  id: string;
  order_number: string;
  status: string;
  site: string | null; // 결제된 사이트 — 'blendpick' | 'sanjipick'
  recipient_name: string | null;
  recipient_phone: string | null;
  buyer_name: string;
  buyer_phone: string;
  addr_address: string;
  addr_detail: string | null;
  addr_memo: string | null;
  total_amount: number;
  tracking_company: string | null;
  tracking_number: string | null;
  created_at: string;
  items: OrderItem[];
}

// 택배사 목록은 서버(/api/admin/shipments/carriers)에서 스위트트래커 공식 코드표를
// 받아온다 (키 미설정 시 주요 6사 폴백). 코드표 하드코딩으로 인한 오배송 조회 방지.

export type ShipmentTab =
  | "active"
  | "history"
  | "preparing"
  | "shipped"
  | "delivered"
  | "exchange_requested"
  | "return_requested"
  | "exchange_completed"
  | "return_completed"
  | "cancel_requested"
  | "cancelled";

const TABS: { key: ShipmentTab; label: string }[] = [
  { key: "active", label: "진행 중 전체" },
  { key: "history", label: "처리 완료 전체" },
  { key: "preparing",          label: "배송준비" },
  { key: "shipped",            label: "배송중" },
  { key: "delivered",          label: "배송완료" },
  { key: "exchange_requested", label: "교환신청" },
  { key: "return_requested",   label: "반품신청" },
  { key: "exchange_completed", label: "교환완료" },
  { key: "return_completed",   label: "반품완료" },
  { key: "cancel_requested",   label: "취소요청" },
  { key: "cancelled",          label: "취소완료" },
];

export default function ShipmentsClient({ initialTab = "active", initialRequestId, sharedOrders, onChanged }: { initialTab?: ShipmentTab; initialRequestId?: string; sharedOrders?: ShipmentOrder[]; onChanged?: () => Promise<void> }) {
  const [tab, setTab] = useState<ShipmentTab>(initialTab);
  const [query, setQuery] = useState("");
  const [allOrders, setAllOrders] = useState<ShipmentOrder[]>([]);
  // 사이트 필터 (블랜드픽/산지픽) — 산지픽은 농가 발송이라 배송 담당이 달라 따로 볼 수 있게
  const siteFilter = useSiteKey();
  const [loadError, setLoadError] = useState("");
  const sourceOrders = sharedOrders ?? allOrders;
  const orders = useMemo(() => sourceOrders.filter(o => (o.site || 'blendpick') === siteFilter && shipmentStatusMatches(o.status, tab) && matchesOrderSearch(o, query)), [sourceOrders, siteFilter, tab, query]);
  const [loading, setLoading] = useState(!sharedOrders);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedAction = selectionAction(orders, selected);
  const shippingList = ["active", "preparing", "shipped"].includes(tab);

  const [carrierCode, setCarrierCode] = useState("04");
  const [carriers, setCarriers] = useState(CORE_CARRIERS);

  const resolveCarrier = (raw?: string) => resolveImportCarrier(raw ?? "", carriers);
  // 상품 그룹 단위 선택/해제 (배송준비·배송중 테이블의 그룹 헤더 체크박스)
  function toggleGroup(ids: string[], select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  const [csvRows, setCsvRows] = useState<TrackingRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ShipmentImportResult | null>(null);
  const [preview, setPreview] = useState<(ImportReview & { token: string; expiresAt: string; requestKey: string }) | null>(null);
  const importBusy = useRef(false);
  const [readingFile, setReadingFile] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileVersion = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [delivering, setDelivering] = useState(false);
  const [acting, setActing] = useState(false);

  // 선택 주문 운송장 입력 모달
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [modalTracking, setModalTracking] = useState<Record<string, string>>({});

  async function load(status: ShipmentTab) {
    setSelected(new Set());
    if (sharedOrders) { await onChanged?.(); return; }
    setLoading(true); setLoadError("");
    try {
      const q = status === "active" ? "preparing,shipped" : status === "history" ? "delivered,cancelled,exchange_completed,return_completed" : status;
      const res = await fetch(`/api/admin/orders?status=${q}`);
      const data = await readApiJson(res);
      if (!res.ok || !Array.isArray(data)) throw Error(apiErrorMessage(data,"배송 목록을 불러오지 못했습니다."));
      setAllOrders(data);
    } catch (e) { setLoadError(apiErrorMessage(e, "조회 실패")); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (!sharedOrders) void load(tab); else setLoading(false); }, [tab]);
  useEffect(() => { setSelected(new Set()); }, [query, tab]);
  useEffect(() => { setSelected(prev => new Set([...prev].filter(id => orders.some(o => o.id === id)))); }, [orders]);

  // 택배사 코드표 로드 (스위트트래커 공식 목록, 키 없으면 주요 6사)
  useEffect(() => {
    if (!["active", "preparing", "shipped"].includes(tab)) return;
    fetch("/api/admin/shipments/carriers")
      .then((r) => readApiJson(r, "정보를 불러오지 못했습니다."))
      .then((d) => {
        if (Array.isArray(d.carriers) && d.carriers.length > 0) setCarriers(d.carriers);
      })
      .catch(error => setLoadError(apiErrorMessage(error)));
  }, [tab]);

  function toggleAll() {
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o.id)));
  }

  function toggleOrder(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || importBusy.current) return;
    const version = ++fileVersion.current;
    setCsvRows([]); setPreview(null); setImportResult(null); setLoadError("");
    setFileName(file.name); setReadingFile(true);
    try {
      const rows = /\.xlsx?$/i.test(file.name)
        ? await parseTrackingXlsx(await file.arrayBuffer())
        : parseTrackingCSV(await file.text());
      if (version !== fileVersion.current) return;
      if (!rows.length) throw Error("등록할 송장 데이터가 없습니다.");
      setCsvRows(rows);
    } catch (e) {
      if (version === fileVersion.current) {
        setCsvRows([]);
        setLoadError(`파일을 읽지 못했습니다. ${apiErrorMessage(e, "운송장 양식을 확인해주세요.")}`);
      }
    } finally { if (version === fileVersion.current) setReadingFile(false); }
  }

  function downloadTemplate() {
    const targets = orders.filter(o => o.status === "preparing" && (!selected.size || selected.has(o.id)));
    const unique = [...new Map(targets.map(o => [o.id, o])).values()];
    downloadXlsx("운송장회신양식.xlsx", ["주문번호", "운송장번호", "택배사"], unique.map(o => [o.order_number, "", ""]), "운송장");
  }

  async function previewTracking(rows: TrackingRow[]) {
    if (importBusy.current || readingFile || !rows.length) return;
    importBusy.current = true; setImporting(true); setLoadError(""); setImportResult(null); setPreview(null);
    const version = fileVersion.current;
    try {
      const res = await fetch("/api/admin/shipments/import/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, defaultCarrier: carrierCode }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.token || !Array.isArray(data.rows)) throw Error(apiErrorMessage(data, "미리보기를 불러오지 못했습니다."));
      if (version === fileVersion.current) setPreview({ ...data, requestKey: crypto.randomUUID() });
    } catch (e) { setLoadError(apiErrorMessage(e, "미리보기 실패")); }
    finally { importBusy.current = false; setImporting(false); }
  }
  async function handleImport() {
    if (importBusy.current || readingFile || !preview) return;
    importBusy.current = true; setImporting(true); setLoadError("");
    try {
      const res = await fetch("/api/admin/shipments/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvRows, defaultCarrier: carrierCode, token: preview.token, requestKey: preview.requestKey }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !Array.isArray(data.failed)) throw Error(apiErrorMessage(data, "결과를 확인하지 못했습니다. 같은 화면에서 등록을 다시 눌러주세요."));
      setImportResult(data);
      setPreview(null); setModalTracking({});
      await load(tab);
      if (data.ok === false || data.error) setLoadError(current => [apiErrorMessage(data, "일부 송장 등록 결과를 확인해주세요."), current].filter(Boolean).join(' '));
    } catch (e) { setLoadError(apiErrorMessage(e, "등록 결과를 확인하지 못했습니다. 같은 요청으로 재시도해주세요.")); }
    finally { importBusy.current = false; setImporting(false); }
  }
  async function handleModalSubmit() {
    if (selectedAction !== "tracking") { setLoadError("배송준비 주문만 선택해주세요."); return; }
    const rows = orders.filter(o => selected.has(o.id)).map((o, i) => ({ order_number: o.order_number, carrier_raw: carrierCode, tracking_number: (modalTracking[o.id] || "").trim(), source_row: i + 1 })).filter(r => r.tracking_number);
    if (!rows.length) { setLoadError("운송장번호를 하나 이상 입력해주세요."); return; }
    ++fileVersion.current; setCsvRows(rows); setFileName("선택 주문 직접 입력"); setShowTrackModal(false);
    await previewTracking(rows);
  }

  async function handleBulkDeliver() {
    if (selectedAction !== "deliver") return;
    if (!confirm(`선택한 ${selected.size}건을 배송완료 처리할까요?\n정산이 자동 생성됩니다.`)) return;
    setDelivering(true); setLoadError("");
    try {
      const res = await fetch("/api/admin/shipments/deliver", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderIds: [...selected] }),
      });
      const data = await readApiJson(res);
      if (!res.ok || data.error) throw Error(apiErrorMessage(data, "배송완료 처리 실패"));
      if(data.updated !== selected.size) setLoadError(`배송완료 ${data.updated ?? 0}건 반영. 나머지는 현재 주문 상태를 확인해주세요.`);
      await load(tab);
    } catch(e) { setLoadError(apiErrorMessage(e, "처리 결과를 확인해주세요.")); }
    finally { setDelivering(false); }
  }

  async function handleTabAction(action: string, label: string, deductShipping = false) {
    if (selectedAction !== "cancel") return;
    const extra = action === "cancel_confirm"
      ? deductShipping
        ? "\n각 주문의 배송비를 뺀 금액이 토스로 환불됩니다."
        : "\n결제 금액이 토스로 전액 환불됩니다."
      : "";
    if (!confirm(`선택한 ${selected.size}건을 ${label} 처리할까요?${extra}${action === "cancel_confirm" ? "\n공급사에 모든 선택 주문의 출고 중지 또는 회수 완료를 확인한 경우에만 승인하세요." : ""}`)) return;
    setActing(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [...selected], action, deduct_shipping: deductShipping, dispatch_stop_confirmed: action === "cancel_confirm" }),
      });
      const d = await readApiJson(res);
      if (!res.ok || d.error) alert(apiErrorMessage(d, "처리에 실패했어요."));
      await load(tab);
    } catch (error) {
      alert(apiErrorMessage(error, "네트워크 문제로 요청이 전달되지 않았어요. 목록을 새로고침해 확인해주세요."));
    } finally {
      setActing(false);
    }
  }

  const carrierName = carriers.find((c) => c.code === carrierCode)?.name ?? "";
  const locked = importing || readingFile || delivering || acting;

  return (
    <div className="ops-shipment-list">
      {loadError && <p role="alert" className="ops-error">{loadError} <button className="ops-text-button" onClick={()=>load(tab)}>목록 다시 확인</button></p>}
      <div className="ops-toolbar">
        <input className="ops-search" aria-label="배송 주문 검색" value={query} disabled={locked} onChange={e=>setQuery(e.target.value)} placeholder="주문번호 · 수령인 · 상품 · 송장 검색"/>
        {!['cancel_requested','exchange_requested','return_requested'].includes(tab) && <select aria-label="배송 상태" value={tab} disabled={locked} onChange={e=>{setTab(e.target.value as ShipmentTab);setSelected(new Set());}}>
          {TABS.filter(t=>!['cancel_requested','exchange_requested','return_requested'].includes(t.key)).map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
        </select>}
        <span className="ops-meta">{loading ? '조회 중' : `${orders.length}건 표시`}</span>
      </div>
      {['active','preparing'].includes(tab) && <div className="ops-import-bar">
        <div className="ops-import-heading"><div><h3>송장 등록</h3><p>회신 파일을 올리거나 목록에서 배송준비 주문을 선택해 입력하세요.</p></div><button onClick={downloadTemplate} className="ops-button">회신 양식 받기</button></div>
        <label className="ops-inline-field">파일에 택배사가 없을 때 <select aria-label="기본 택배사" value={carrierCode} disabled={importing||readingFile} onChange={e=>{setCarrierCode(e.target.value);setPreview(null);setImportResult(null);}}>{carriers.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
            {fileName && <p className="text-xs text-gray-600 mb-2" aria-live="polite">선택 파일: {fileName}{readingFile ? " · 읽는 중…" : ""}</p>}
            {csvRows.length === 0 ? (
              <button disabled={importing} onClick={() => fileRef.current?.click()}
                className="ops-button ops-button-primary">
                엑셀/CSV 파일 선택
              </button>
            ) : (
              <div>
                <div className="border border-gray-100 rounded-none overflow-x-auto mb-3">
                  <table className="w-full min-w-[480px] text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">주문번호</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">택배사</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-500">운송장번호</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {csvRows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-mono text-gray-700">{r.order_number}</td>
                          <td className="px-4 py-2 text-gray-600">{r.carrier_raw ? (resolveCarrier(r.carrier_raw) ? libCarrierName(resolveCarrier(r.carrier_raw)) : r.carrier_raw) : carrierName}</td>
                          <td className="px-4 py-2 font-mono text-gray-700">{r.tracking_number}</td>
                        </tr>
                      ))}
                      {csvRows.length > 5 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-gray-400 text-center">
                            외 {csvRows.length - 5}건 더 있음
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {!preview && !importResult && <p className="text-xs text-gray-500 mb-3">파일 {csvRows.length}행 · 서버에서 현재 주문 상태와 중복을 확인한 후 등록합니다.</p>}
                {preview && <ImportReviewTable review={preview} />}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => previewTracking(csvRows)} disabled={importing || readingFile}
                    className="flex-1 border border-gray-300 disabled:opacity-50 text-gray-700 text-sm font-bold py-2.5 px-4">
                    {importing ? "처리 중..." : preview ? "미리보기 다시 확인" : "등록 전 미리보기"}
                  </button>
                  {preview && <button onClick={handleImport} disabled={importing || readingFile || preview.counts.ready === 0}
                    className="flex-1 bg-[#2D5A27] hover:bg-[#244B1F] disabled:opacity-50 text-white text-sm font-bold py-2.5 px-4">
                    {importing ? "처리 중..." : `정상 ${preview.counts.ready}건 등록`}
                  </button>}
                  <button disabled={importing} onClick={() => { ++fileVersion.current; setCsvRows([]); setPreview(null); setImportResult(null); setFileName(""); setReadingFile(false); }}
                    className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200">
                    파일 바꾸기
                  </button>
                </div>
              </div>
            )}

            <input ref={fileRef} disabled={importing} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />

            {importResult && (
              <div className="mt-3 px-4 py-3 bg-green-50 text-sm" role="status">
                <p className="font-semibold text-gray-800">등록 완료 — 신규 {importResult.succeeded}건 · 이미 등록 {importResult.alreadyApplied}건 · 중복 제외 {importResult.duplicateExcluded}행 · 확인 필요 {importResult.failed.length}행</p>
                <p className="text-xs text-gray-600 mt-1">발송 안내 {importResult.smsQueued}건 예약 · 발송 결과는 <a href="/admin/shipment-notifications" className="underline">발송 알림 관리</a>에서 확인해주세요.</p>
                <ImportReviewTable review={importResult} completed />
              </div>
            )}
      </div>}
      {selected.size>0 && <div className="ops-selection-bar" aria-live="polite">
        <strong>{selected.size}건 선택</strong>
        {selectedAction==='tracking' && <button disabled={locked} onClick={()=>{setModalTracking({});setShowTrackModal(true);}} className="ops-button ops-button-primary">선택 주문 송장 입력</button>}
        {selectedAction==='deliver' && <button onClick={handleBulkDeliver} disabled={locked} className="ops-button ops-button-primary">{delivering?'처리 중…':'선택 주문 배송완료 처리'}</button>}
        {selectedAction==='cancel' && <>
          <button onClick={()=>handleTabAction('cancel_confirm','취소 승인 · 전액 환불')} disabled={locked} className="ops-button ops-button-danger">승인 · 전액 환불</button>
          <button onClick={()=>handleTabAction('cancel_confirm','취소 승인 · 배송비 차감',true)} disabled={locked} className="ops-button">승인 · 배송비 차감</button>
          <button onClick={()=>handleTabAction('cancel_reject','취소요청 반려 (주문 유지, 환불 없음)')} disabled={locked} className="ops-button">반려</button>
        </>}
        {selectedAction==='mixed'&&<span className="ops-warning">같은 처리 단계의 주문만 선택해주세요.</span>}
      </div>}
      {(tab==='exchange_requested'||tab==='return_requested') ? <ReturnsPanel kind={tab==='exchange_requested'?'exchange':'return'} compact refreshKey={sharedOrders} initialRequestId={initialRequestId} onChanged={()=>{void load(tab);}} /> :
        <OrderTable orders={orders} loading={loading} selected={selected} onToggleAll={toggleAll} onToggle={toggleOrder} onToggleGroup={shippingList||tab==='cancel_requested'?toggleGroup:undefined} showTracking emptyText="조건에 맞는 주문이 없습니다." />}

      {/* ── 운송장 입력 모달 (선택 주문 → 배송중) ── */}
      {showTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !importing && setShowTrackModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="선택 주문 운송장 입력" className="bg-white rounded-none w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800">선택 주문 운송장 입력</p>
              <p className="text-xs text-gray-400 mt-0.5">
                선택 {orders.filter((o) => selected.has(o.id)).length}건 · 번호를 입력한 건의 등록 가능 여부를 미리 확인합니다
              </p>
            </div>
            <div className="p-5 border-b border-gray-100">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">택배사 (전체 공통)</label>
              <select value={carrierCode} disabled={importing || readingFile} onChange={(e) => { setCarrierCode(e.target.value); setPreview(null); setImportResult(null); }}
                className="w-full border border-gray-200 rounded-none px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#C7D6C0] bg-white">
                {carriers.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="overflow-auto p-5 space-y-2 flex-1">
              {orders.filter((o) => selected.has(o.id)).map((o) => (
                <div key={o.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-gray-500">{o.order_number} <SiteBadge site={o.site} className="ml-1 font-sans" /></div>
                    <div className="text-xs text-gray-700 truncate">{o.recipient_name ?? o.buyer_name}</div>
                  </div>
                  <input value={modalTracking[o.id] ?? ""}
                    onChange={(e) => setModalTracking((p) => ({ ...p, [o.id]: e.target.value }))}
                    placeholder="운송장번호" inputMode="numeric"
                    className="w-40 border border-gray-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-[#C7D6C0]" />
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-2">
              <button onClick={handleModalSubmit} disabled={importing}
                className="flex-1 bg-[#2D5A27] hover:bg-[#244B1F] disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-none transition-colors">
                {importing ? "처리 중..." : "등록 전 미리보기"}
              </button>
              <button onClick={() => setShowTrackModal(false)} disabled={importing}
                className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-none">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const REVIEW_LABELS = { ready: "등록 가능", already: "이미 등록", duplicate: "중복 제외", blocked: "확인 필요" };
const IMPORT_STATUS: Record<string, string> = { paid: "결제완료", confirmed: "주문확인", preparing: "배송준비", shipped: "배송중", delivered: "배송완료", cancelled: "취소완료", cancel_requested: "취소요청", return_requested: "반품신청", returned: "반품완료", return_completed: "반품완료", exchange_requested: "교환신청", exchange_completed: "교환완료" };
function ImportReviewTable({ review, completed = false }: { review: ImportReview; completed?: boolean }) {
  return <div className="my-3">
    {!completed && <p className="text-sm font-semibold mb-2" role="status">등록 가능 {review.counts.ready}건 · 이미 등록 {review.counts.already}건 · 중복 제외 {review.counts.duplicate}행 · 확인 필요 {review.counts.blocked}행</p>}
    {!completed && <p className="text-xs text-gray-500 mb-2">확인 필요 주문은 제외하고 정상 주문만 등록합니다. 미리보기는 15분 동안 유효하며 등록 시 상태를 다시 확인합니다.</p>}
    <div className="max-h-80 overflow-auto border border-gray-200 bg-white">
      <table className="w-full min-w-[800px] text-xs text-left">
        <thead className="sticky top-0 bg-gray-50"><tr>{["원본 행", "주문번호", "현재 상태", "택배사 / 송장", "결과", "확인 사항"].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>{review.rows.map((r, i) => <tr key={i} className="border-t border-gray-100">
          <td className="px-3 py-2 whitespace-nowrap">{r.source_sheet && `${r.source_sheet} · `}{r.source_row}행</td>
          <td className="px-3 py-2 font-mono">{r.order_number || "—"}{r.resolved_order && r.resolved_order !== r.order_number && <div className="text-gray-500">→ {r.resolved_order}</div>}</td>
          <td className="px-3 py-2 whitespace-nowrap">{r.current_status ? IMPORT_STATUS[r.current_status] ?? r.current_status : "주문 없음"}</td>
          <td className="px-3 py-2">{r.carrier ? libCarrierName(r.carrier) : r.carrier_raw || "—"}<div className="font-mono">{r.tracking_number || "—"}</div></td>
          <td className={`px-3 py-2 whitespace-nowrap font-semibold ${r.result === 'blocked' ? 'text-red-600' : r.result === 'ready' ? 'text-green-700' : 'text-gray-500'}`}>{completed && r.result === 'ready' ? '등록 완료' : REVIEW_LABELS[r.result]}</td>
          <td className="px-3 py-2 text-gray-600">{completed && r.result === 'ready' ? '배송중으로 변경했습니다.' : r.reason}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

function OrderTable({
  orders, loading, selected, onToggleAll, onToggle, onToggleGroup, showTracking = false, emptyText,
}: {
  orders: ShipmentOrder[];
  loading: boolean;
  selected: Set<string>;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onToggleGroup?: (ids: string[], select: boolean) => void;
  showTracking?: boolean;
  emptyText: string;
}) {
  const carrierName = (code: string | null) =>
    code ? libCarrierName(code) : "—";

  if (loading) return <div className="bg-white rounded-none border border-gray-100 p-6 text-center text-sm text-gray-400">불러오는 중...</div>;
  if (orders.length === 0) return <div className="bg-white rounded-none border border-gray-100 p-6 text-center text-sm text-gray-400">{emptyText}</div>;

  return <div className="ops-table-scroll"><table className="ops-table ops-shipments-table">
    <thead><tr><th>{onToggleGroup&&<input type="checkbox" aria-label="표시된 배송 주문 전체 선택" checked={selected.size===orders.length&&orders.length>0} onChange={onToggleAll}/>}</th><th>주문 · 주문일시 <small>한국시간</small></th><th>수령인</th><th>상품 · 출고 정보</th><th>상태 · 운송장</th><th>결제 금액</th></tr></thead>
    <tbody>{orders.map(o=><tr key={o.id} data-selected={selected.has(o.id)}>
      <td>{onToggleGroup&&<input type="checkbox" aria-label={`${o.order_number} 선택`} checked={selected.has(o.id)} onChange={()=>onToggle(o.id)}/>}</td>
      <td><Link className="ops-text-button" href={`/admin/orders/${o.id}`}>{o.order_number}</Link><time className="ops-meta" dateTime={o.created_at}>{new Date(o.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}</time></td>
      <td><strong>{o.recipient_name||o.buyer_name}</strong><span className="ops-meta">{formatPhone(o.recipient_phone||o.buyer_phone)}</span>{o.addr_memo&&<span className="ops-warning">{o.addr_memo}</span>}</td>
      <td>{o.items.map((it,i)=><div key={i} className="ops-order-item"><strong>{it.product_name}</strong><span className="ops-meta">{it.option_label||'기본 구성'} · {it.quantity}개</span>{it.product_id&&<span className="ops-meta">{it.supplier_name||'공급사 미지정'} · {it.expected_ship_date?.slice(0,10)||'출고일 미지정'}</span>}</div>)}</td>
      <td><span className={`ops-status ops-status-${o.status}`}>{TABS.find(t=>t.key===o.status)?.label||o.status}</span>{o.tracking_number?<span className="ops-meta">{carrierName(o.tracking_company)}<br/>{o.tracking_number}</span>:o.status==='shipped'?<span className="ops-warning">송장 정보 누락</span>:null}</td>
      <td className="ops-nowrap"><strong>{Number(o.total_amount).toLocaleString()}원</strong></td>
    </tr>)}</tbody>
  </table></div>;
}
