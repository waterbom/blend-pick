"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string | null;
  option_label: string | null;
  unit_price: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  buyer_name: string;
  buyer_phone: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  addr_zipcode: string;
  addr_address: string;
  addr_detail: string | null;
  addr_memo: string | null;
  total_amount: number;
  shipping_fee: number;
  tracking_company: string | null;
  tracking_number: string | null;
  influencer_name: string | null;
  created_at: string;
  items: OrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  paid:               "신규주문",
  confirmed:          "주문확인",
  preparing:          "배송준비",
  shipped:            "배송중",
  delivered:          "배송완료",
  cancelled:          "취소완료",
  cancel_requested:   "취소요청",
  exchange_requested: "교환신청",
  exchange_completed: "교환완료",
  return_requested:   "반품신청",
  return_completed:   "반품완료",
};

const STATUS_STYLE: Record<string, string> = {
  paid:               "bg-blue-50 text-blue-600",
  confirmed:          "bg-indigo-50 text-indigo-600",
  preparing:          "bg-yellow-50 text-yellow-600",
  shipped:            "bg-purple-50 text-purple-600",
  delivered:          "bg-green-50 text-green-600",
  cancelled:          "bg-gray-100 text-gray-400",
  cancel_requested:   "bg-red-50 text-red-500",
  exchange_requested: "bg-violet-50 text-violet-600",
  exchange_completed: "bg-violet-50 text-violet-400",
  return_requested:   "bg-orange-50 text-orange-500",
  return_completed:   "bg-orange-50 text-orange-400",
};

const ORDER_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  campaign: { label: "공동구매", cls: "bg-emerald-50 text-emerald-600" },
  shop:     { label: "상품",     cls: "bg-slate-100 text-slate-600" },
};

const COLUMNS = [
  "판매처", "상품코드", "상품명", "주문번호",
  "주문자명", "주문자연락처", "주문일시",
  "수령인명", "수령인연락처", "우편번호", "수령인주소",
  "고객선택옵션", "주문수량", "배송요청사항",
  "택배사", "배송번호",
];

function toCSV(orders: Order[]): string {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows: string[][] = [];
  for (const o of orders) {
    for (const item of o.items) {
      const addr = [o.addr_address, o.addr_detail].filter(Boolean).join(" ");
      rows.push([
        "블렌드픽",
        item.product_code ?? "",
        item.product_name,
        o.order_number,
        o.buyer_name,
        o.buyer_phone,
        new Date(o.created_at).toLocaleString("ko-KR"),
        o.recipient_name ?? o.buyer_name,
        o.recipient_phone ?? o.buyer_phone,
        o.addr_zipcode,
        addr,
        item.option_label ?? "없음",
        String(item.quantity),
        o.addr_memo ?? "",
        o.tracking_company ?? "",
        o.tracking_number ?? "",
      ]);
    }
  }
  const header = COLUMNS.map(esc).join(",");
  const body = rows.map((r) => r.map(esc).join(",")).join("\n");
  return "﻿" + header + "\n" + body;
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  async function load(status = "") {
    setLoading(true);
    const res = await fetch(`/api/admin/orders${status ? `?status=${status}` : ""}`);
    const data = await res.json();
    setOrders(data);
    setSelected(new Set());
    setLoading(false);
  }

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  const visibleOrders = useMemo(
    () => (typeFilter ? orders.filter((o) => o.order_type === typeFilter) : orders),
    [orders, typeFilter]
  );

  const typeCounts = useMemo(() => {
    let shop = 0, campaign = 0;
    for (const o of orders) {
      if (o.order_type === "campaign") campaign++;
      else shop++;
    }
    return { all: orders.length, shop, campaign };
  }, [orders]);

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of visibleOrders) {
      const key = o.items[0]?.product_name ?? "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return map;
  }, [visibleOrders]);

  const counts = useMemo(() => {
    const c = { paid: 0, confirmed: 0, preparing: 0, delivered: 0, total: orders.length };
    for (const o of orders) {
      if (o.status in c) (c as Record<string, number>)[o.status]++;
    }
    return c;
  }, [orders]);

  function toggleOrder(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGroup(groupOrders: Order[]) {
    const ids = groupOrders.map((o) => o.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleAll() {
    const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((o) => selected.has(o.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleOrders.forEach((o) => next.delete(o.id));
      else visibleOrders.forEach((o) => next.add(o.id));
      return next;
    });
  }

  function toggleGroupExpand(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleBatchAction(action: string, label: string, withCSV = false) {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 ${label} 처리할까요?`)) return;
    setActing(true);

    if (withCSV) {
      const selectedOrders = orders.filter((o) => selected.has(o.id));
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      downloadCSV(toCSV(selectedOrders), `발주_${date}.csv`);
    }

    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: [...selected], action }),
    });

    await load(statusFilter);
    setActing(false);
  }

  const dashTabs = [
    { key: "paid",      label: "신규주문", count: counts.paid },
    { key: "confirmed", label: "주문확인", count: counts.confirmed },
    { key: "preparing", label: "배송준비", count: counts.preparing },
    { key: "delivered", label: "배송완료", count: counts.delivered },
  ];

  const filterTabs = [
    { key: "", label: "전체", count: counts.total },
    ...dashTabs,
  ];

  const actionButton = () => {
    if (selected.size === 0) return null;
    if (statusFilter === "paid" || statusFilter === "") {
      const hasPaid = orders.some((o) => selected.has(o.id) && o.status === "paid");
      if (hasPaid) return (
        <button onClick={() => handleBatchAction("confirm", "주문확인")} disabled={acting}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
          주문확인 ({selected.size}건)
        </button>
      );
    }
    if (statusFilter === "confirmed") return (
      <button onClick={() => handleBatchAction("dispatch", "발주처리(배송준비)", true)} disabled={acting}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        발주처리 + 엑셀 ({selected.size}건)
      </button>
    );
    return null;
  };

  return (
    <div>
      {/* 대시보드 카드 */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
        <p className="text-sm font-semibold text-gray-800 mb-4">판매 관리</p>
        <div className="flex items-center">
          {dashTabs.map((tab, i) => (
            <div key={tab.key} className="flex items-center flex-1">
              <button onClick={() => setStatusFilter(tab.key)} className="flex-1 text-left group">
                <div className="text-xs text-gray-400 mb-1">{tab.label}</div>
                <div className="text-2xl font-bold text-gray-800 group-hover:text-orange-500 transition-colors">
                  {tab.count}<span className="text-sm font-medium text-gray-400 ml-0.5">건</span>
                </div>
              </button>
              {i < 3 && <div className="mx-4 text-gray-200 text-lg">›</div>}
            </div>
          ))}
        </div>
      </div>

      {/* 판매 유형 필터 */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 mb-3 w-fit">
        {[
          { key: "", label: "전체", count: typeCounts.all },
          { key: "shop", label: "상품판매", count: typeCounts.shop },
          { key: "campaign", label: "공동구매", count: typeCounts.campaign },
        ].map((t) => (
          <button key={t.key} onClick={() => setTypeFilter(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === t.key ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-50"
            }`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              typeFilter === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* 상태 필터 탭 + 액션 */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 flex-wrap">
          {filterTabs.map((tab) => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.key ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  statusFilter === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        {actionButton()}
      </div>

      {/* 주문 테이블 */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : visibleOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-sm text-gray-400">주문이 없습니다</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-gray-400">
            <input type="checkbox"
              checked={visibleOrders.length > 0 && visibleOrders.every((o) => selected.has(o.id))}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-orange-500"
            />
            <span>전체 선택 ({visibleOrders.length}건)</span>
          </div>

          {[...groups.entries()].map(([productName, groupOrders]) => {
            const isExpanded = expandedGroups.has(productName);
            const groupSelected = groupOrders.every((o) => selected.has(o.id));
            const groupPartial = groupOrders.some((o) => selected.has(o.id)) && !groupSelected;
            const productCode = groupOrders[0]?.items[0]?.product_code;
            const typeBadge = ORDER_TYPE_BADGE[groupOrders[0]?.order_type] ?? ORDER_TYPE_BADGE.shop;

            return (
              <div key={productName} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleGroupExpand(productName)}
                >
                  <input type="checkbox" checked={groupSelected}
                    ref={(el) => { if (el) el.indeterminate = groupPartial; }}
                    onChange={(e) => { e.stopPropagation(); toggleGroup(groupOrders); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${typeBadge.cls}`}>{typeBadge.label}</span>
                    {productCode && (
                      <span className="text-xs font-mono bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded shrink-0">{productCode}</span>
                    )}
                    <span className="text-sm font-bold text-gray-800 truncate">{productName}</span>
                    <span className="text-xs text-gray-400 shrink-0">{groupOrders.length}건</span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="border-b border-gray-50">
                      <tr>
                        <th className="w-8 px-4 py-2" />
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">주문번호</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">주문일시</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">구매자</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">수령인</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">옵션</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">인플루언서</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-400">금액</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">상태</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {groupOrders.map((o) => (
                        <tr key={o.id} className={`hover:bg-gray-50 transition-colors ${selected.has(o.id) ? "bg-orange-50/40" : ""}`}>
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOrder(o.id)}
                              className="w-4 h-4 rounded accent-orange-500" />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">
                            <Link href={`/admin/orders/${o.id}`} className="hover:text-orange-500">{o.order_number}</Link>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {new Date(o.created_at).toLocaleDateString("ko-KR")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800 text-xs">{o.buyer_name}</div>
                            <div className="text-xs text-gray-400">{o.buyer_phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-gray-700">{o.recipient_name ?? o.buyer_name}</div>
                            <div className="text-xs text-gray-400">{o.recipient_phone ?? o.buyer_phone}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {o.items[0]?.option_label ?? <span className="text-gray-300">없음</span>}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {o.influencer_name
                              ? <span className="font-medium text-orange-600">@{o.influencer_name}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">
                            {Number(o.total_amount).toLocaleString()}원
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/admin/orders/${o.id}`} className="text-xs text-orange-500 hover:text-orange-600 font-bold">
                              상세
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
