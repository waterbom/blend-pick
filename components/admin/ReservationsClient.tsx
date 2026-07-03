"use client";

import { useEffect, useMemo, useState } from "react";

interface Reservation {
  id: string;
  order_number: string;
  status: string;
  buyer_name: string;
  buyer_phone: string;
  addr_memo: string | null;
  stay_check_in: string | null;
  stay_check_out: string | null;
  total_amount: number;
  created_at: string;
  product_name: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  paid:       { label: "예약확정",   cls: "bg-blue-50 text-blue-600" },
  checked_in: { label: "체크인완료", cls: "bg-green-50 text-green-600" },
  cancelled:  { label: "취소",       cls: "bg-gray-100 text-gray-400" },
  no_show:    { label: "노쇼",       cls: "bg-red-50 text-red-500" },
};

const TABS = [
  { key: "", label: "전체" },
  { key: "paid", label: "예약확정" },
  { key: "checked_in", label: "체크인완료" },
  { key: "cancelled", label: "취소" },
  { key: "no_show", label: "노쇼" },
];

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function md(iso: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}(${WEEK[new Date(y, m - 1, d).getDay()]})`;
}
function hotelRoom(name: string | null) {
  if (!name) return "-";
  const parts = name.split(" · ");
  return parts.length >= 3 ? `${parts[0]} · ${parts[parts.length - 1]}` : name;
}
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ReservationsClient() {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");

  useEffect(() => {
    fetch("/api/admin/reservations")
      .then((r) => r.json())
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const stats = useMemo(() => {
    const today = todayISO();
    let confirmed = 0, upcoming = 0, cancelled = 0;
    for (const r of rows) {
      if (r.status === "paid") { confirmed++; if (r.stay_check_in && r.stay_check_in >= today) upcoming++; }
      if (r.status === "cancelled") cancelled++;
    }
    return { confirmed, upcoming, cancelled };
  }, [rows]);

  const visible = useMemo(
    () => (tab ? rows.filter((r) => r.status === tab) : rows),
    [rows, tab]
  );

  async function updateStatus(id: string, status: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    await fetch("/api/admin/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  const cards = [
    { label: "예약 확정", value: stats.confirmed },
    { label: "체크인 예정", value: stats.upcoming },
    { label: "취소", value: stats.cancelled },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">호텔 예약 관리</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-sm text-gray-400">{c.label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">
              {c.value}<span className="text-base font-medium text-gray-400 ml-0.5">건</span>
            </p>
          </div>
        ))}
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 bg-white rounded-full border border-gray-100 p-1 mb-3 w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === t.key ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 예약 테이블 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1.4fr_1.6fr_1fr_0.8fr_0.7fr] gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-400">
          <span>예약번호</span><span>예약자</span><span>호텔 · 객실</span><span>투숙기간</span><span className="text-right">금액</span><span className="text-center">상태</span>
        </div>
        {loading ? (
          <div className="p-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : visible.length === 0 ? (
          <div className="p-16 text-center text-sm text-gray-400">예약이 없습니다</div>
        ) : (
          visible.map((r) => {
            const st = STATUS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-500" };
            return (
              <div key={r.id} className="grid grid-cols-[1.4fr_1.4fr_1.6fr_1fr_0.8fr_0.7fr] gap-3 px-6 py-4 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50/60 transition-colors">
                <span className="font-mono text-xs font-semibold" style={{ color: "var(--accent)" }}>{r.order_number}</span>
                <div className="text-sm text-gray-700">
                  <div className="font-medium text-gray-800">{r.buyer_name}</div>
                  <div className="text-xs text-gray-400">{r.buyer_phone}</div>
                </div>
                <span className="text-sm text-gray-700">{hotelRoom(r.product_name)}</span>
                <span className="text-xs text-gray-500 tnum">{md(r.stay_check_in)} ~ {md(r.stay_check_out)}</span>
                <span className="text-sm font-semibold text-gray-800 text-right tnum">{Number(r.total_amount).toLocaleString()}원</span>
                <select
                  value={r.status}
                  onChange={(e) => updateStatus(r.id, e.target.value)}
                  className={`justify-self-center text-xs font-semibold rounded-full px-2 py-1 cursor-pointer border-0 focus:outline-none ${st.cls}`}
                  style={{ appearance: "auto" }}
                  title="상태 변경"
                >
                  <option value="paid">예약확정</option>
                  <option value="checked_in">체크인완료</option>
                  <option value="cancelled">취소</option>
                  <option value="no_show">노쇼</option>
                </select>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
