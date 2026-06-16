"use client";

import { useEffect, useState, useRef } from "react";

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
  total_amount: number;
  tracking_company: string | null;
  tracking_number: string | null;
  created_at: string;
  items: OrderItem[];
}

const CARRIERS = [
  { code: "04", name: "CJ대한통운" },
  { code: "08", name: "롯데택배" },
  { code: "05", name: "한진택배" },
  { code: "01", name: "우체국택배" },
  { code: "06", name: "로젠택배" },
  { code: "23", name: "경동택배" },
  { code: "26", name: "GS편의점택배" },
  { code: "46", name: "CU편의점택배" },
  { code: "77", name: "대신택배" },
  { code: "53", name: "홈픽택배" },
  { code: "68", name: "DHL" },
  { code: "40", name: "FedEx" },
  { code: "41", name: "UPS" },
];

// CSV 파싱: 주문번호,운송장번호 (2컬럼)
function parseTrackingCSV(text: string): { order_number: string; tracking_number: string }[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const results = [];
  const startIdx = /^[0-9]/.test(lines[0]) ? 0 : 1;
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 2 || !cols[0] || !cols[1]) continue;
    results.push({ order_number: cols[0], tracking_number: cols[1] });
  }
  return results;
}

function downloadTemplate() {
  const content = "주문번호,운송장번호\nBP20240101001,123456789012\n";
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "운송장입력양식.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type Tab = "preparing" | "shipped";

export default function ShipmentsClient() {
  const [tab, setTab] = useState<Tab>("preparing");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 택배사 선택
  const [carrierCode, setCarrierCode] = useState("04");

  // CSV 업로드 상태
  const [csvRows, setCsvRows] = useState<{ order_number: string; tracking_number: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ succeeded: number; failed: { order_number: string; reason?: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 배송완료 처리 상태
  const [delivering, setDelivering] = useState(false);

  // 배송추적 상태
  const [tracking, setTracking] = useState(false);
  const [trackResult, setTrackResult] = useState<{ checked: number; delivered: number } | null>(null);

  async function load(status: Tab) {
    setLoading(true);
    setSelected(new Set());
    setCsvRows([]);
    setImportResult(null);
    const res = await fetch(`/api/admin/orders?status=${status}`);
    const data = await res.json();
    setOrders(data);
    setLoading(false);
  }

  useEffect(() => { load(tab); }, [tab]);

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
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvRows(parseTrackingCSV(ev.target?.result as string));
      setImportResult(null);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  async function handleImport() {
    if (csvRows.length === 0) return;
    setImporting(true);
    const rows = csvRows.map((r) => ({ ...r, carrier: carrierCode }));
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

  async function handleTrack() {
    setTracking(true);
    setTrackResult(null);
    const res = await fetch("/api/admin/shipments/track", { method: "POST" });
    const data = await res.json();
    setTrackResult({ checked: data.checked, delivered: data.delivered });
    if (data.delivered > 0) await load("shipped");
    setTracking(false);
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "preparing", label: "배송준비" },
    { key: "shipped", label: "배송중" },
  ];

  const carrierName = CARRIERS.find((c) => c.code === carrierCode)?.name ?? "";

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 w-fit mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 배송준비 탭 ── */}
      {tab === "preparing" && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-bold text-gray-800">운송장번호 일괄 입력</p>
                <p className="text-xs text-gray-400 mt-0.5">CSV: 주문번호, 운송장번호 (2컬럼)</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium border border-blue-200 px-3 py-1.5 rounded-lg"
              >
                양식 다운로드
              </button>
            </div>

            {/* 택배사 선택 */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">택배사 선택</label>
              <select
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-orange-400 bg-white"
              >
                {CARRIERS.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* CSV 업로드 */}
            {csvRows.length === 0 ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors"
              >
                CSV 파일 선택 또는 클릭
              </button>
            ) : (
              <div>
                <div className="border border-gray-100 rounded-lg overflow-hidden mb-3">
                  <table className="w-full text-xs">
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
                          <td className="px-4 py-2 text-gray-600">{carrierName}</td>
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
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
                  >
                    {importing ? "처리 중..." : `${csvRows.length}건 배송중으로 변경`}
                  </button>
                  <button
                    onClick={() => setCsvRows([])}
                    className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

            {importResult && (
              <div className={`mt-3 px-4 py-3 rounded-lg text-sm ${importResult.failed.length > 0 ? "bg-yellow-50" : "bg-green-50"}`}>
                <p className="font-semibold text-gray-800">
                  처리 완료 — 성공 {importResult.succeeded}건
                  {importResult.failed.length > 0 && `, 실패 ${importResult.failed.length}건`}
                </p>
                {importResult.failed.map((f, i) => (
                  <p key={i} className="text-xs text-red-500 mt-1">{f.order_number}: {f.reason}</p>
                ))}
              </div>
            )}
          </div>

          <OrderTable
            orders={orders}
            loading={loading}
            selected={selected}
            onToggleAll={toggleAll}
            onToggle={toggleOrder}
            emptyText="배송준비 중인 주문이 없습니다"
          />
        </>
      )}

      {/* ── 배송중 탭 ── */}
      {tab === "shipped" && (
        <>
          <div className="flex items-center justify-between mb-3 gap-3">
            <button
              onClick={handleTrack}
              disabled={tracking}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {tracking ? "조회 중..." : "배송추적 실행"}
            </button>
            {trackResult && (
              <span className="text-xs text-gray-500">
                {trackResult.checked}건 조회 →{" "}
                <span className={trackResult.delivered > 0 ? "text-green-600 font-bold" : "text-gray-400"}>
                  {trackResult.delivered}건 배송완료 처리됨
                </span>
              </span>
            )}
            {selected.size > 0 && (
              <button
                onClick={handleBulkDeliver}
                disabled={delivering}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {delivering ? "처리 중..." : `배송완료 처리 (${selected.size}건)`}
              </button>
            )}
          </div>

          <OrderTable
            orders={orders}
            loading={loading}
            selected={selected}
            onToggleAll={toggleAll}
            onToggle={toggleOrder}
            showTracking
            emptyText="배송 중인 주문이 없습니다"
          />
        </>
      )}
    </div>
  );
}

function OrderTable({
  orders,
  loading,
  selected,
  onToggleAll,
  onToggle,
  showTracking = false,
  emptyText,
}: {
  orders: Order[];
  loading: boolean;
  selected: Set<string>;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  showTracking?: boolean;
  emptyText: string;
}) {
  if (loading) {
    return <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-sm text-gray-400">불러오는 중...</div>;
  }
  if (orders.length === 0) {
    return <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-sm text-gray-400">{emptyText}</div>;
  }

  const carrierName = (code: string | null) =>
    CARRIERS.find((c) => c.code === code)?.name ?? code ?? "—";

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100 bg-gray-50">
          <tr>
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={selected.size === orders.length && orders.length > 0}
                onChange={onToggleAll}
                className="w-4 h-4 rounded accent-orange-500"
              />
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">주문번호</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">주문일</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">수령인</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">상품</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">금액</th>
            {showTracking && (
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">운송장</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {orders.map((o) => (
            <tr key={o.id} className={`hover:bg-gray-50 transition-colors ${selected.has(o.id) ? "bg-orange-50/40" : ""}`}>
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => onToggle(o.id)}
                  className="w-4 h-4 rounded accent-orange-500"
                />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.order_number}</td>
              <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                {new Date(o.created_at).toLocaleDateString("ko-KR")}
              </td>
              <td className="px-4 py-3">
                <div className="text-xs font-medium text-gray-800">{o.recipient_name ?? o.buyer_name}</div>
                <div className="text-xs text-gray-400">{o.recipient_phone ?? o.buyer_phone}</div>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
