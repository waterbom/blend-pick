"use client";

import { useEffect, useMemo, useState } from "react";
import { BOOKABLE_FROM, BOOKABLE_TO } from "@/lib/hotel";

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

interface Inv {
  date: string;
  room_type: string;
  allocated: number;
  booked: number;
  remaining: number;
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

// addr_memo("투숙 … · 요청: OOO")에서 고객 요청사항만 추출
function requestMemo(memo: string | null) {
  if (!memo) return "";
  const i = memo.indexOf("요청: ");
  return i >= 0 ? memo.slice(i + "요청: ".length).trim() : "";
}

// 호텔 전달용 예약자 명단 CSV
function toCSV(list: Reservation[]) {
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["예약번호", "예약자", "연락처", "패키지", "객실", "요청사항", "체크인", "체크아웃", "박수", "상태", "결제금액", "예약일"];
  const rows = list.map((r) => {
    const parts = (r.product_name || "").split(" · ");
    const pkg = parts[1] || "";
    const room = parts[2] || parts[0] || "";
    const st = (STATUS[r.status] ?? { label: r.status }).label;
    return [
      r.order_number, r.buyer_name, r.buyer_phone, pkg, room, requestMemo(r.addr_memo),
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
  const [inv, setInv] = useState<Inv[]>([]);
  const [invAll, setInvAll] = useState(false);

  useEffect(() => {
    fetch("/api/admin/reservations")
      .then((r) => r.json())
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); });
    fetch("/api/admin/reservations/notify")
      .then((r) => r.json())
      .then((d) => setPending(typeof d.pending === "number" ? d.pending : null))
      .catch(() => {});
    fetch("/api/admin/reservations/inventory")
      .then((r) => r.json())
      .then((d) => setInv(Array.isArray(d) ? d : []))
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

  // 날짜 변경 모달
  const [dateEdit, setDateEdit] = useState<Reservation | null>(null);
  const [newIn, setNewIn] = useState("");
  const [newOut, setNewOut] = useState("");
  const [changing, setChanging] = useState(false);
  const [dateResult, setDateResult] = useState<{ diff: number; refunded: number; payLink: string | null } | null>(null);

  function openDateModal(r: Reservation) {
    setDateEdit(r);
    setNewIn(r.stay_check_in || "");
    setNewOut(r.stay_check_out || "");
    setDateResult(null);
  }

  async function submitDateChange() {
    if (!dateEdit) return;
    if (!newIn || !newOut || newOut <= newIn) { alert("체크아웃은 체크인 이후 날짜여야 해요."); return; }
    setChanging(true);
    try {
      const res = await fetch("/api/admin/reservations/change-date", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dateEdit.id, checkIn: newIn, checkOut: newOut }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { alert(d.error || "날짜 변경에 실패했습니다."); return; }
      setDateResult({ diff: d.diff, refunded: d.refunded, payLink: d.payLink });
      const rr = await fetch("/api/admin/reservations").then((r) => r.json());
      setRows(Array.isArray(rr) ? rr : []);
    } finally {
      setChanging(false);
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

  // 재고 피벗 (날짜 × 객실타입)
  const invView = useMemo(() => {
    const rooms = Array.from(new Set(inv.map((i) => i.room_type)));
    const byDate = new Map<string, Record<string, Inv>>();
    const totals: Record<string, { allocated: number; booked: number; remaining: number }> = {};
    for (const i of inv) {
      if (!byDate.has(i.date)) byDate.set(i.date, {});
      byDate.get(i.date)![i.room_type] = i;
      const t = (totals[i.room_type] ??= { allocated: 0, booked: 0, remaining: 0 });
      t.allocated += i.allocated; t.booked += i.booked; t.remaining += i.remaining;
    }
    let dates = Array.from(byDate.keys()).sort();
    if (!invAll) dates = dates.filter((d) => rooms.some((rm) => (byDate.get(d)![rm]?.booked ?? 0) > 0));
    return { rooms, byDate, dates, totals };
  }, [inv, invAll]);

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
                <div className="text-sm text-gray-700 min-w-0">
                  <div>{hotelRoom(r.product_name)}</div>
                  {requestMemo(r.addr_memo) && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: "#c2410c" }} title={requestMemo(r.addr_memo)}>
                      📝 요청: {requestMemo(r.addr_memo)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 tnum">
                  <div>{md(r.stay_check_in)} ~ {md(r.stay_check_out)}</div>
                  {r.status === "paid" && (
                    <button onClick={() => openDateModal(r)} className="text-[11px] text-blue-500 hover:underline mt-0.5">📅 날짜변경</button>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-800 text-right tnum">{Number(r.total_amount).toLocaleString()}원</span>
                {r.status === "cancelled" ? (
                  <span className={`justify-self-center text-xs font-semibold rounded-full px-3 py-1 ${st.cls}`} title="환불 완료된 예약은 되돌릴 수 없습니다">
                    취소
                  </span>
                ) : (
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
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 객실 재고 현황 */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-gray-800">🛏 객실 재고 현황</h2>
          <div className="flex gap-3 items-center text-xs text-gray-500 flex-wrap">
            {invView.rooms.map((rm) => {
              const t = invView.totals[rm];
              return t ? (
                <span key={rm}>{rm} · 예약 <b className="text-gray-800">{t.booked}</b> / 배정 {t.allocated} · 남음 <b className="text-gray-800">{t.remaining}</b></span>
              ) : null;
            })}
            <button onClick={() => setInvAll((v) => !v)} className="px-3 py-1.5 rounded-full border border-gray-200 font-medium hover:bg-gray-50">
              {invAll ? "예약 있는 날짜만" : "전체 날짜 보기"}
            </button>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-400" style={{ gridTemplateColumns: `1.2fr repeat(${invView.rooms.length}, 1fr)` }}>
            <span>투숙일</span>
            {invView.rooms.map((rm) => <span key={rm} className="text-center">{rm} (남음/배정)</span>)}
          </div>
          <div className="max-h-96 overflow-auto">
            {inv.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">재고 데이터가 없습니다</div>
            ) : invView.dates.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">예약된 객실이 없습니다 — “전체 날짜 보기”로 전체 재고 확인</div>
            ) : (
              invView.dates.map((d) => (
                <div key={d} className="grid px-6 py-2.5 border-b border-gray-50 last:border-0 items-center text-sm" style={{ gridTemplateColumns: `1.2fr repeat(${invView.rooms.length}, 1fr)` }}>
                  <span className="text-gray-600 tnum">{md(d)}</span>
                  {invView.rooms.map((rm) => {
                    const c = invView.byDate.get(d)?.[rm];
                    if (!c) return <span key={rm} className="text-center text-gray-300">-</span>;
                    const soldOut = c.remaining <= 0;
                    const low = c.remaining > 0 && c.remaining <= 2;
                    return (
                      <span key={rm} className="text-center tnum font-semibold" style={{ color: soldOut ? "#dc2626" : low ? "#ea580c" : "#374151" }}>
                        {soldOut ? "마감" : c.remaining}
                        <span className="text-gray-300 font-normal"> / {c.allocated}</span>
                        {c.booked > 0 && <span className="text-gray-400 font-normal text-xs"> (−{c.booked})</span>}
                      </span>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 날짜 변경 모달 */}
      {dateEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !changing && setDateEdit(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-800">📅 예약 날짜 변경</p>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">{dateEdit.order_number} · {dateEdit.buyer_name} · {hotelRoom(dateEdit.product_name)}</p>
            </div>

            {!dateResult ? (
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">체크인</label>
                    <input type="date" value={newIn} min={BOOKABLE_FROM} max={BOOKABLE_TO}
                      onChange={(e) => setNewIn(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">체크아웃</label>
                    <input type="date" value={newOut} min={newIn || BOOKABLE_FROM} max={BOOKABLE_TO}
                      onChange={(e) => setNewOut(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <p className="text-xs text-gray-400">현재: {md(dateEdit.stay_check_in)} ~ {md(dateEdit.stay_check_out)} · 요금 차이는 자동 환불(저렴)/차액 링크(비쌈)로 처리돼요.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={submitDateChange} disabled={changing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg">
                    {changing ? "변경 중…" : "날짜 변경"}
                  </button>
                  <button onClick={() => setDateEdit(null)} disabled={changing}
                    className="px-4 py-2.5 text-sm text-gray-400 border border-gray-200 rounded-lg hover:text-gray-600">닫기</button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <p className="text-sm font-bold text-gray-800">✅ 날짜 변경 완료</p>
                {dateResult.refunded > 0 && (
                  <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                    차액 <b>{dateResult.refunded.toLocaleString()}원</b> 자동 환불 완료
                  </div>
                )}
                {dateResult.diff === 0 && (
                  <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">요금 차이 없음</div>
                )}
                {dateResult.payLink && (
                  <div className="rounded-lg bg-blue-50 px-4 py-3 space-y-2">
                    <p className="text-sm text-blue-700">추가 차액 <b>{dateResult.diff.toLocaleString()}원</b> 발생 — 아래 링크를 고객에게 보내주세요</p>
                    <div className="flex gap-2">
                      <input readOnly value={dateResult.payLink} className="flex-1 border border-blue-200 rounded-lg px-2 py-1.5 text-xs font-mono bg-white" onFocus={(e) => e.target.select()} />
                      <button onClick={() => { navigator.clipboard?.writeText(dateResult.payLink!); alert("링크 복사됨"); }}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg whitespace-nowrap">복사</button>
                    </div>
                  </div>
                )}
                <button onClick={() => setDateEdit(null)} className="w-full py-2.5 bg-gray-900 text-white text-sm font-bold rounded-lg">완료</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
