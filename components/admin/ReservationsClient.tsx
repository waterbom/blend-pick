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

function nightsOf(ci: string | null, co: string | null) {
  if (!ci || !co) return "";
  const [ay, am, ad] = ci.split("-").map(Number);
  const [by, bm, bd] = co.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// 호텔 전달용 예약자 명단 CSV
function toCSV(list: Reservation[]) {
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["예약번호", "예약자", "연락처", "패키지", "객실", "체크인", "체크아웃", "박수", "상태", "결제금액", "예약일"];
  const rows = list.map((r) => {
    const parts = (r.product_name || "").split(" · ");
    const pkg = parts[1] || "";
    const room = parts[2] || parts[0] || "";
    const st = (STATUS[r.status] ?? { label: r.status }).label;
    return [
      r.order_number, r.buyer_name, r.buyer_phone, pkg, room,
      r.stay_check_in || "", r.stay_check_out || "", nightsOf(r.stay_check_in, r.stay_check_out),
      st, Number(r.total_amount).toLocaleString(), new Date(r.created_at).toLocaleDateString("ko-KR"),
    ].map(esc).join(",");
  });
  return "﻿" + [header.map(esc).join(","), ...rows].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReservationsClient() {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/admin/reservations")
      .then((r) => r.json())
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); });
    fetch("/api/admin/reservations/notify")
      .then((r) => r.json())
      .then((d) => setPending(typeof d.pending === "number" ? d.pending : null))
      .catch(() => {});
  }, []);

  async function sendAlimtalk() {
    if (!confirm(`미발송 예약 ${pending ?? 0}건에 예약확인 문자를 일괄 발송할까요?`)) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/reservations/notify", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) {
        alert(d.error || "발송에 실패했습니다.");
      } else {
        setPending(0);
        let msg = `발송 완료 — 성공 ${d.sent}건 / 실패 ${d.failed}건 (대상 ${d.total}건)`;
        if (d.errors?.length) msg += `\n\n실패 예시:\n${d.errors.join("\n")}`;
        alert(msg);
      }
    } finally {
      setSending(false);
    }
  }

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
    if (status === "cancelled" && !confirm("이 예약을 취소하고 결제를 환불할까요? (되돌릴 수 없어요)")) return;
    const prev = rows;
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    const res = await fetch("/api/admin/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "처리에 실패했습니다.");
      setRows(prev); // 롤백
    } else if (status === "cancelled") {
      alert("취소·환불 완료되었어요.");
    }
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

      {/* 필터 탭 + 명단 내보내기 */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-full border border-gray-100 p-1 w-fit">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tab === t.key ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sendAlimtalk}
            disabled={sending || pending === 0}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
            title="공구 마감 후 예약확인 문자 일괄발송"
          >
            📩 {sending ? "발송 중…" : `예약확인 문자 일괄발송${pending != null ? ` (${pending})` : ""}`}
          </button>
          <button
            onClick={() => downloadCSV(toCSV(visible), `호텔예약명단_${todayISO().replace(/-/g, "")}.csv`)}
            disabled={visible.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
            title="호텔에 전달할 예약자 명단 다운로드"
          >
            📋 예약자 명단 다운로드 ({visible.length})
          </button>
        </div>
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
