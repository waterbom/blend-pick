"use client";

import { useEffect, useState, useRef } from "react";
import { CORE_CARRIERS, carrierName as libCarrierName } from "@/lib/carriers";
import { downloadXlsx } from "@/lib/xlsx-download";

interface OrderItem {
  product_name: string;
  option_label: string | null;
  quantity: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
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

// 행 배열(엑셀/CSV 공통) → 주문번호·운송장번호 목록
// 헤더 감지: 첫 줄에 '주문/운송장/order/tracking' 이 있으면 헤더로 보고 스킵
// (주문번호가 BP… 처럼 문자로 시작해도 데이터가 누락되지 않게)
function parseTrackingRows(grid: string[][]): { order_number: string; tracking_number: string; carrier_raw?: string }[] {
  const rows = grid.filter((r) => r.some((c) => c));
  const hasHeader = /주문|운송장|order|tracking/i.test((rows[0] ?? []).join(","));
  const results = [];
  for (let i = hasHeader ? 1 : 0; i < rows.length; i++) {
    const [a, b, c] = rows[i];
    if (!a || !b) continue;
    // 3번째 컬럼(택배사)은 선택 — 있으면 행별 택배사로 사용, 없으면 드롭다운 선택값 적용
    results.push({ order_number: a, tracking_number: b, carrier_raw: (c || "").trim() || undefined });
  }
  return results;
}

function parseTrackingCSV(text: string) {
  const grid = text.split("\n").map((l) =>
    l.trim().split(",").map((c) => c.replace(/^"|"$/g, "").trim())
  );
  return parseTrackingRows(grid);
}

async function parseTrackingXlsx(buf: ArrayBuffer) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  return parseTrackingRows(grid.map((r) => r.map((c) => String(c ?? "").trim())));
}

function downloadTemplate() {
  downloadXlsx("운송장입력양식.xlsx", ["주문번호", "운송장번호", "택배사"], [["BP20240101001", "123456789012", "CJ대한통운"]], "운송장");
}

type Tab =
  | "preparing"
  | "shipped"
  | "delivered"
  | "exchange_requested"
  | "return_requested"
  | "exchange_completed"
  | "return_completed"
  | "cancel_requested"
  | "cancelled";

const TABS: { key: Tab; label: string }[] = [
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

// 각 탭의 일괄처리 액션 정의
const TAB_ACTION: Partial<Record<Tab, { action: string; label: string; color: string }>> = {
  exchange_requested: { action: "exchange_complete", label: "교환완료 처리", color: "bg-violet-600 hover:bg-violet-700" },
  return_requested:   { action: "return_complete",   label: "반품완료 처리", color: "bg-[#2D5A27] hover:bg-[#244B1F]" },
  cancel_requested:   { action: "cancel_confirm",    label: "취소 확인",     color: "bg-red-500 hover:bg-red-600" },
};

export default function ShipmentsClient() {
  const [tab, setTab] = useState<Tab>("preparing");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [carrierCode, setCarrierCode] = useState("04");
  const [carriers, setCarriers] = useState(CORE_CARRIERS);

  // 양식의 택배사 칸(이름 또는 코드) → 코드로 해석. 못 찾으면 null (드롭다운 선택값 사용)
  function resolveCarrier(raw?: string): string | null {
    if (!raw) return null;
    const v = raw.replace(/\s/g, "");
    const byCode = carriers.find((c) => c.code === v);
    if (byCode) return byCode.code;
    const byName = carriers.find((c) => c.name.replace(/\s/g, "") === v || c.name.replace(/\s/g, "").includes(v) || v.includes(c.name.replace(/\s/g, "")));
    return byName ? byName.code : null;
  }
  const [trackerKeyMissing, setTrackerKeyMissing] = useState(false);
  // 상품 그룹 단위 선택/해제 (배송준비·배송중 테이블의 그룹 헤더 체크박스)
  function toggleGroup(ids: string[], select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  const [csvRows, setCsvRows] = useState<{ order_number: string; tracking_number: string; carrier_raw?: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ succeeded: number; failed: { order_number: string; reason?: string }[]; smsSent?: number; smsFailed?: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [delivering, setDelivering] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [trackResult, setTrackResult] = useState<{ checked: number; delivered: number; failed: number } | null>(null);
  const [acting, setActing] = useState(false);

  // 선택 주문 운송장 입력 모달
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [modalTracking, setModalTracking] = useState<Record<string, string>>({});

  async function load(status: Tab) {
    setLoading(true);
    setSelected(new Set());
    setCsvRows([]);
    setImportResult(null);
    // 배송준비 탭엔 주문확인(confirmed) 건도 포함 — 주문확인 후 바로 운송장 입력 가능
    const q = status === "preparing" ? "confirmed,preparing" : status;
    const res = await fetch(`/api/admin/orders?status=${q}`);
    const data = await res.json();
    setOrders(data);
    setLoading(false);
  }

  useEffect(() => { load(tab); }, [tab]);

  // 택배사 코드표 로드 (스위트트래커 공식 목록, 키 없으면 주요 6사)
  useEffect(() => {
    fetch("/api/admin/shipments/carriers")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.carriers) && d.carriers.length > 0) setCarriers(d.carriers);
        setTrackerKeyMissing(!!d.keyMissing);
      })
      .catch(() => {});
  }, []);

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target?.result;
      setCsvRows(isXlsx ? await parseTrackingXlsx(data as ArrayBuffer) : parseTrackingCSV(data as string));
      setImportResult(null);
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  async function handleImport() {
    if (csvRows.length === 0) return;
    setImporting(true);
    const rows = csvRows.map((r) => ({
      order_number: r.order_number,
      tracking_number: r.tracking_number,
      carrier: resolveCarrier(r.carrier_raw) ?? carrierCode,
    }));
    const res = await fetch("/api/admin/shipments/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setImportResult(data);
    setCsvRows([]);
    await load("preparing");
    setImporting(false);
  }

  // 선택 주문에 운송장 직접 입력 → 배송중 (CSV import API 재사용)
  async function handleModalSubmit() {
    const rows = orders
      .filter((o) => selected.has(o.id))
      .map((o) => ({ order_number: o.order_number, carrier: carrierCode, tracking_number: (modalTracking[o.id] || "").trim() }))
      .filter((r) => r.tracking_number);
    if (rows.length === 0) { alert("운송장번호를 하나 이상 입력해주세요."); return; }
    setImporting(true);
    const res = await fetch("/api/admin/shipments/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setImportResult(data);
    setShowTrackModal(false);
    setModalTracking({});
    await load("preparing");
    setImporting(false);
  }

  async function handleTrack() {
    setTracking(true);
    setTrackResult(null);
    try {
      const res = await fetch("/api/admin/shipments/track", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "배송추적에 실패했습니다.");
        return;
      }
      setTrackResult({ checked: data.checked, delivered: data.delivered, failed: Number(data.failed) || 0 });
      // 시도한 조회가 전부 실패 = 키·사용량 문제 — 조용히 넘어가지 않고 사유를 띄운다
      if (data.apiError) {
        alert(`배송추적 조회가 모두 실패했어요.\n\n사유: ${data.apiError}\n\nAPI 사용량(무료 한도) 초과가 흔한 원인이에요 — 스마트택배 플랜/키를 확인해주세요.`);
      }
      if (data.delivered > 0) await load("shipped");
    } catch {
      alert("네트워크 문제로 배송추적 요청이 전달되지 않았어요. 다시 시도해주세요.");
    } finally {
      setTracking(false);
    }
  }

  async function handleBulkDeliver() {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 배송완료 처리할까요?\n정산이 자동 생성됩니다.`)) return;
    setDelivering(true);
    await fetch("/api/admin/shipments/deliver", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: [...selected] }),
    });
    await load("shipped");
    setDelivering(false);
  }

  async function handleTabAction(action: string, label: string, deductShipping = false) {
    if (selected.size === 0) return;
    const extra = action === "cancel_confirm"
      ? deductShipping
        ? "\n각 주문의 배송비를 뺀 금액이 토스로 환불됩니다."
        : "\n결제 금액이 토스로 전액 환불됩니다."
      : "";
    if (!confirm(`선택한 ${selected.size}건을 ${label} 처리할까요?${extra}`)) return;
    setActing(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [...selected], action, deduct_shipping: deductShipping }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) alert(d.error || "처리에 실패했어요.");
      await load(tab);
    } catch {
      alert("네트워크 문제로 요청이 전달되지 않았어요. 목록을 새로고침해 확인해주세요.");
    } finally {
      setActing(false);
    }
  }

  const carrierName = carriers.find((c) => c.code === carrierCode)?.name ?? "";
  const tabAction = TAB_ACTION[tab];

  return (
    <div>
      {/* 탭 */}
      <div className="flex flex-wrap mb-4">
        {TABS.map((t, ti) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 text-xs font-semibold transition-colors"
            style={{
              border: "1px solid",
              marginLeft: ti > 0 ? "-1px" : 0,
              background: tab === t.key ? "#1A1D18" : "#fff",
              color: tab === t.key ? "#fff" : "#5C6156",
              borderColor: tab === t.key ? "#1A1D18" : "#D6D6CF",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 배송준비 탭 ── */}
      {tab === "preparing" && (
        <>
          <div className="bg-white rounded-none border border-gray-100 p-6 mb-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-bold text-gray-800">운송장번호 일괄 입력</p>
                <p className="text-xs text-gray-400 mt-0.5">엑셀/CSV: 주문번호, 운송장번호, 택배사(선택) — 택배사 칸이 비면 아래 선택값 적용</p>
              </div>
              <button onClick={downloadTemplate}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium border border-blue-200 px-3 py-1.5 rounded-none">
                양식 다운로드
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">택배사 선택</label>
              <select value={carrierCode} onChange={(e) => setCarrierCode(e.target.value)}
                className="w-full border border-gray-200 rounded-none px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#C7D6C0] bg-white">
                {carriers.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>

            {csvRows.length === 0 ? (
              <button onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-none py-8 text-sm text-gray-400 hover:border-[#2D5A27] hover:text-[#7A8B6F] transition-colors">
                엑셀/CSV 파일 선택 또는 클릭
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
                          <td className="px-4 py-2 text-gray-600">{r.carrier_raw ? (libCarrierName(resolveCarrier(r.carrier_raw) ?? "") || r.carrier_raw) : carrierName}</td>
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
                <div className="flex gap-2">
                  <button onClick={handleImport} disabled={importing}
                    className="flex-1 bg-[#2D5A27] hover:bg-[#244B1F] disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-none transition-colors">
                    {importing ? "처리 중..." : `${csvRows.length}건 배송중으로 변경`}
                  </button>
                  <button onClick={() => setCsvRows([])}
                    className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-none">
                    취소
                  </button>
                </div>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />

            {importResult && (
              <div className={`mt-3 px-4 py-3 rounded-none text-sm ${importResult.failed.length > 0 ? "bg-yellow-50" : "bg-green-50"}`}>
                <p className="font-semibold text-gray-800">
                  처리 완료 — 성공 {importResult.succeeded}건
                  {importResult.failed.length > 0 && `, 실패 ${importResult.failed.length}건`}
                  {(importResult.smsSent ?? 0) > 0 && ` · 발송 안내 문자 ${importResult.smsSent}건`}
                  {(importResult.smsFailed ?? 0) > 0 && ` (문자 실패 ${importResult.smsFailed}건)`}
                </p>
                {importResult.failed.map((f, i) => (
                  <p key={i} className="text-xs text-red-500 mt-1">{f.order_number}: {f.reason}</p>
                ))}
              </div>
            )}
          </div>

          {selected.size > 0 && (
            <div className="mb-3">
              <button onClick={() => { setModalTracking({}); setShowTrackModal(true); }}
                className="bg-[#2D5A27] hover:bg-[#244B1F] text-white text-sm font-bold px-5 py-2.5 rounded-none transition-colors">
                선택 {selected.size}건 운송장 입력 → 배송중
              </button>
            </div>
          )}

          <OrderTable orders={orders} loading={loading} selected={selected} onToggleGroup={toggleGroup}
            onToggleAll={toggleAll} onToggle={toggleOrder}
            emptyText="배송준비 중인 주문이 없습니다" />
        </>
      )}

      {/* ── 배송중 탭 ── */}
      {tab === "shipped" && (
        <>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <button onClick={handleTrack} disabled={tracking}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-none transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {tracking ? "조회 중..." : "배송추적 실행"}
            </button>
            {trackerKeyMissing && (
              <span className="text-xs font-semibold text-red-500 bg-red-50 border border-red-100 rounded-none px-3 py-1.5">
                ⚠ 스마트택배 API 키 미설정 — 배송추적이 동작하지 않아요 (.env.local의 SWEETTRACKER_API_KEY)
              </span>
            )}
            {trackResult && (
              <span className="text-xs text-gray-500">
                {trackResult.checked}건 조회 →{" "}
                <span className={trackResult.delivered > 0 ? "text-green-600 font-bold" : "text-gray-400"}>
                  {trackResult.delivered}건 배송완료 처리됨
                </span>
                {trackResult.failed > 0 && (
                  <span className="text-red-400 font-semibold"> · 조회 실패 {trackResult.failed}건</span>
                )}
              </span>
            )}
            {selected.size > 0 && (
              <button onClick={handleBulkDeliver} disabled={delivering}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-none transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {delivering ? "처리 중..." : `배송완료 처리 (${selected.size}건)`}
              </button>
            )}
          </div>
          <OrderTable orders={orders} loading={loading} selected={selected} onToggleGroup={toggleGroup}
            onToggleAll={toggleAll} onToggle={toggleOrder} showTracking
            emptyText="배송 중인 주문이 없습니다" />
        </>
      )}

      {/* ── 액션 탭 (교환신청/반품신청/취소요청) ── */}
      {tabAction && (
        <>
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {tab === "cancel_requested" ? (
                <>
                  {/* 취소 승인 = 토스 환불 실행 — 사유에 따라 전액 / 배송비 차감(단순 변심) 선택 */}
                  <button onClick={() => handleTabAction("cancel_confirm", "취소 승인 · 전액 환불")} disabled={acting}
                    className="text-white text-sm font-bold px-5 py-2.5 rounded-none transition-colors disabled:opacity-50 bg-red-500 hover:bg-red-600">
                    {acting ? "처리 중..." : `취소 승인 · 전액 환불 (${selected.size}건)`}
                  </button>
                  <button onClick={() => handleTabAction("cancel_confirm", "취소 승인 · 배송비 차감(단순 변심)", true)} disabled={acting}
                    className="text-white text-sm font-bold px-5 py-2.5 rounded-none transition-colors disabled:opacity-50 bg-orange-500 hover:bg-orange-600">
                    {acting ? "처리 중..." : `취소 승인 · 배송비 차감 (${selected.size}건)`}
                  </button>
                </>
              ) : (
                <button onClick={() => handleTabAction(tabAction.action, tabAction.label)} disabled={acting}
                  className={`text-white text-sm font-bold px-5 py-2.5 rounded-none transition-colors disabled:opacity-50 ${tabAction.color}`}>
                  {acting ? "처리 중..." : `${tabAction.label} (${selected.size}건)`}
                </button>
              )}
            </div>
          )}
          <OrderTable orders={orders} loading={loading} selected={selected} onToggleGroup={toggleGroup}
            onToggleAll={toggleAll} onToggle={toggleOrder}
            emptyText={`${TABS.find(t => t.key === tab)?.label} 주문이 없습니다`} />
        </>
      )}

      {/* ── 조회 전용 탭 (배송완료/교환완료/반품완료/취소완료) ── */}
      {!tabAction && tab !== "preparing" && tab !== "shipped" && (
        <OrderTable orders={orders} loading={loading} selected={new Set()}
          onToggleAll={() => {}} onToggle={() => {}} showTracking={tab === "delivered"}
          emptyText={`${TABS.find(t => t.key === tab)?.label} 주문이 없습니다`} />
      )}

      {/* ── 운송장 입력 모달 (선택 주문 → 배송중) ── */}
      {showTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !importing && setShowTrackModal(false)}>
          <div className="bg-white rounded-none w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800">운송장 입력 후 배송중 처리</p>
              <p className="text-xs text-gray-400 mt-0.5">
                선택 {orders.filter((o) => selected.has(o.id)).length}건 · 번호를 입력한 건만 배송중으로 변경됩니다
              </p>
            </div>
            <div className="p-5 border-b border-gray-100">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">택배사 (전체 공통)</label>
              <select value={carrierCode} onChange={(e) => setCarrierCode(e.target.value)}
                className="w-full border border-gray-200 rounded-none px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#C7D6C0] bg-white">
                {carriers.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="overflow-auto p-5 space-y-2 flex-1">
              {orders.filter((o) => selected.has(o.id)).map((o) => (
                <div key={o.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-gray-500">{o.order_number}</div>
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
                {importing ? "처리 중..." : "배송중으로 변경"}
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

function OrderTable({
  orders, loading, selected, onToggleAll, onToggle, onToggleGroup, showTracking = false, emptyText,
}: {
  orders: Order[];
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

  if (loading) return <div className="bg-white rounded-none border border-gray-100 p-16 text-center text-sm text-gray-400">불러오는 중...</div>;
  if (orders.length === 0) return <div className="bg-white rounded-none border border-gray-100 p-16 text-center text-sm text-gray-400">{emptyText}</div>;

  return (
    <div className="bg-white rounded-none border border-gray-100 overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-gray-100 bg-gray-50">
          <tr>
            <th className="w-10 px-4 py-3">
              <input type="checkbox"
                checked={selected.size === orders.length && orders.length > 0}
                onChange={onToggleAll}
                className="w-4 h-4 rounded accent-[#2D5A27]"
              />
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">주문번호</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">주문일</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">수령인</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">상품</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">금액</th>
            {showTracking && <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">운송장</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {/* 상품별 그룹 — 같은 상품 주문을 묶어서 보고, 그룹 체크박스로 한 번에 선택 */}
          {Array.from(
            orders.reduce((m, o) => {
              const key = o.items[0]?.product_name ?? "기타";
              if (!m.has(key)) m.set(key, [] as Order[]);
              m.get(key)!.push(o);
              return m;
            }, new Map<string, Order[]>())
          ).flatMap(([productName, group]) => [
            (() => {
              const ids = group.map((g) => g.id);
              const allSel = ids.every((id) => selected.has(id));
              return (
                <tr key={`g-${productName}`} style={{ background: "#F4F4F1" }}>
                  <td className="px-4 py-2">
                    {onToggleGroup && (
                      <input type="checkbox" checked={allSel}
                        onChange={() => onToggleGroup(ids, !allSel)}
                        className="w-4 h-4 rounded accent-[#2D5A27]" title="이 상품 주문 전체 선택" />
                    )}
                  </td>
                  <td colSpan={showTracking ? 6 : 5} className="px-4 py-2 text-xs font-bold" style={{ color: "#3E423A" }}>
                    {productName} <span className="ds-mono font-semibold" style={{ color: "#8F948A" }}>{group.length}건</span>
                  </td>
                </tr>
              );
            })(),
            ...group.map((o) => (
            <tr key={o.id} className={`hover:bg-gray-50 transition-colors ${selected.has(o.id) ? "bg-[#EAF0E6]/40" : ""}`}>
              <td className="px-4 py-3">
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => onToggle(o.id)}
                  className="w-4 h-4 rounded accent-[#2D5A27]" />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.order_number}</td>
              <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                {new Date(o.created_at).toLocaleDateString("ko-KR")}
              </td>
              <td className="px-4 py-3">
                <div className="text-xs font-medium text-gray-800">{o.recipient_name ?? o.buyer_name}</div>
                <div className="text-xs text-gray-400">{o.recipient_phone ?? o.buyer_phone}</div>
                {o.addr_memo && (
                  <div className="text-[11px] mt-0.5 text-orange-600">📦 {o.addr_memo}</div>
                )}
              </td>
              <td className="px-4 py-3">
                {o.items.map((item, i) => (
                  <div key={i} className="text-xs text-gray-700 truncate max-w-[200px]">
                    {item.product_name}
                    {item.option_label && <span className="text-gray-400"> / {item.option_label}</span>}
                    {" "}x{item.quantity}
                  </div>
                ))}
              </td>
              <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">
                {Number(o.total_amount).toLocaleString()}원
              </td>
              {showTracking && (
                <td className="px-4 py-3">
                  {o.tracking_number ? (
                    <div>
                      <div className="text-xs text-gray-500">{carrierName(o.tracking_company)}</div>
                      <div className="font-mono text-xs text-gray-800">{o.tracking_number}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">미입력</span>
                  )}
                </td>
              )}
            </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}
