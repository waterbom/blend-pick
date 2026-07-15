"use client";

import { useEffect, useMemo, useState } from "react";
import { BOOKABLE_FROM, BOOKABLE_TO, refundRateFor, PACKAGES, ROOM_META, type PkgKey, type RoomType } from "@/lib/hotel";

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
  paid_at_kst: string | null;
  product_name: string | null;
}

interface Inv {
  date: string;
  room_type: string;
  allocated: number;
  booked: number;
  remaining: number;
}

// 체크인/노쇼는 호텔이 관리 — 우리는 예약확정/취소만 다룸 (레거시 상태는 표시만)
const STATUS: Record<string, { label: string; cls: string }> = {
  paid:       { label: "예약확정",   cls: "bg-blue-50 text-blue-600" },
  checked_in: { label: "체크인완료", cls: "bg-green-50 text-green-600" },
  cancelled:  { label: "취소",       cls: "bg-gray-100 text-gray-400" },
  no_show:    { label: "노쇼",       cls: "bg-red-50 text-red-500" },
};

const TABS = [
  { key: "", label: "전체" },
  { key: "paid", label: "예약확정" },
  { key: "cancelled", label: "취소" },
];

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function md(iso: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}(${WEEK[new Date(y, m - 1, d).getDay()]})`;
}
// product_name "여수 UTOP 마리나 · 3인 패키지 · 패밀리 트윈" → 인원·침대 정보
function stayMeta(name: string | null) {
  if (!name) return null;
  const parts = name.split(" · ");
  if (parts.length < 3) return null;
  const pkg: PkgKey = name.includes("3인") ? "p3" : name.includes("4인") ? "p4" : "p2";
  const room = parts[parts.length - 1] as RoomType;
  const meta = ROOM_META[room];
  if (!meta) return null;
  return { pkgLabel: PACKAGES[pkg].label, people: PACKAGES[pkg].people, room, bed: meta.bed, capacity: meta.capacity };
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
  const header = ["예약번호", "예약자", "연락처", "패키지", "객실", "요청사항", "체크인", "체크아웃", "박수", "상태", "결제금액", "결제시간", "예약일"];
  const rows = list.map((r) => {
    const parts = (r.product_name || "").split(" · ");
    const pkg = parts[1] || "";
    const room = parts[2] || parts[0] || "";
    const st = (STATUS[r.status] ?? { label: r.status }).label;
    return [
      r.order_number, r.buyer_name, r.buyer_phone, pkg, room, requestMemo(r.addr_memo),
      r.stay_check_in || "", r.stay_check_out || "", nightsOf(r.stay_check_in, r.stay_check_out),
      st, Number(r.total_amount).toLocaleString(), r.paid_at_kst || "", new Date(r.created_at).toLocaleDateString("ko-KR"),
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
  const [invMonth, setInvMonth] = useState<string>(""); // "2026-07" 형식, "" = 전체
  const [invFilter, setInvFilter] = useState<"all" | "booked" | "tight">("all");

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
  const [newPkg, setNewPkg] = useState<PkgKey>("p2");
  const [newRoom, setNewRoom] = useState<RoomType>("패밀리 트윈");
  const [datePreview, setDatePreview] = useState<{ diff: number; oldTotal: number; newTotal: number; nights: number; pkgLabel: string; room: string; available: boolean; minRemaining: number; soldOutDates: string[]; payLink: string | null } | null>(null);
  const [dateResult, setDateResult] = useState<{ diff: number; refunded: number; needRepay: boolean; payLink: string | null } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // 날짜 고르는 동안 대상 기간 잔여 객실 자동 확인 (본인 예약 반납분 포함해서 계산)
  const [avail, setAvail] = useState<{ checking: boolean; available?: boolean; minRemaining?: number; soldOutDates?: string[] } | null>(null);

  useEffect(() => {
    if (!dateEdit || !newIn || !newOut || newOut <= newIn) { setAvail(null); return; }
    setAvail({ checking: true });
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/reservations/change-date", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: dateEdit.id, checkIn: newIn, checkOut: newOut, pkg: newPkg, room: newRoom, preview: true }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.ok) setAvail({ checking: false, available: d.available, minRemaining: d.minRemaining, soldOutDates: d.soldOutDates });
        else setAvail(null);
      } catch { setAvail(null); }
    }, 400);
    return () => clearTimeout(t);
  }, [dateEdit, newIn, newOut, newPkg, newRoom]);

  function openDateModal(r: Reservation) {
    setDateEdit(r);
    setNewIn(r.stay_check_in || "");
    setNewOut(r.stay_check_out || "");
    const m = stayMeta(r.product_name);
    setNewPkg(r.product_name?.includes("3인") ? "p3" : r.product_name?.includes("4인") ? "p4" : "p2");
    setNewRoom((m?.room as RoomType) || "패밀리 트윈");
    setDatePreview(null);
    setDateResult(null);
    setAvail(null);
    setLinkCopied(false);
  }

  // 패키지 변경 시 객실 자동 보정 — 3·4인은 패밀리 트윈만 가능
  function pickPkg(p: PkgKey) {
    setNewPkg(p);
    if (p !== "p2") setNewRoom("패밀리 트윈");
  }

  async function copyPayLink(link: string) {
    try { await navigator.clipboard.writeText(link); setLinkCopied(true); }
    catch { prompt("아래 링크를 복사하세요:", link); }
  }

  // 1단계: 차액 미리보기 (DB 변경 없음)
  async function previewDateChange() {
    if (!dateEdit) return;
    if (!newIn || !newOut || newOut <= newIn) { alert("체크아웃은 체크인 이후 날짜여야 해요."); return; }
    setChanging(true);
    try {
      const res = await fetch("/api/admin/reservations/change-date", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dateEdit.id, checkIn: newIn, checkOut: newOut, pkg: newPkg, room: newRoom, preview: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { alert(d.error || "요금 계산에 실패했습니다."); return; }
      setLinkCopied(false);
      setDatePreview({ diff: d.diff, oldTotal: d.oldTotal, newTotal: d.newTotal, nights: d.nights, pkgLabel: d.pkgLabel, room: d.room, available: d.available, minRemaining: d.minRemaining, soldOutDates: d.soldOutDates ?? [], payLink: d.payLink ?? null });
    } finally {
      setChanging(false);
    }
  }

  // 2단계: 확인 후 실제 변경 실행 (재고 스왑 + 환불/링크)
  async function confirmDateChange() {
    if (!dateEdit) return;
    setChanging(true);
    try {
      const res = await fetch("/api/admin/reservations/change-date", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dateEdit.id, checkIn: newIn, checkOut: newOut, pkg: newPkg, room: newRoom }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { alert(d.error || "예약 변경에 실패했습니다."); return; }
      // 미리보기 상태를 지워야 완료 화면으로 전환됨 (화면 분기가 미리보기 우선이라 안 지우면 그대로 떠있음)
      setDatePreview(null);
      setLinkCopied(false);
      setDateResult({ diff: d.diff, refunded: d.refunded, needRepay: d.needRepay, payLink: d.payLink ?? null });
      const rr = await fetch("/api/admin/reservations").then((r) => r.json());
      setRows(Array.isArray(rr) ? rr : []);
    } finally {
      setChanging(false);
    }
  }

  const stats = useMemo(() => {
    let confirmed = 0, cancelled = 0, revenue = 0;
    for (const r of rows) {
      if (r.status === "paid") { confirmed++; revenue += Number(r.total_amount) || 0; }
      if (r.status === "cancelled") cancelled++;
    }
    return { confirmed, cancelled, revenue };
  }, [rows]);

  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    let list = tab ? rows.filter((r) => r.status === tab) : rows;
    const q = query.trim().toLowerCase();
    if (q) {
      const qDigits = q.replace(/[^0-9]/g, "");
      list = list.filter((r) =>
        (r.order_number ?? "").toLowerCase().includes(q) ||
        (r.buyer_name ?? "").toLowerCase().includes(q) ||
        (qDigits.length >= 3 && (r.buyer_phone ?? "").replace(/[^0-9]/g, "").includes(qDigits))
      );
    }
    return list;
  }, [rows, tab, query]);

  // 페이지네이션 — 탭/검색이 바뀌면 1페이지로 (명단 다운로드는 전체 visible 기준 유지)
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [tab, query]);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visible, safePage]
  );
  // 페이지 번호 버튼 (현재 페이지 주변 5개)
  const pageNums = useMemo(() => {
    const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  }, [safePage, totalPages]);

  async function updateStatus(id: string, status: string) {
    let fullRefund = false;
    if (status === "cancelled") {
      // 환불 규정 미리보기 (최종 계산은 서버가 다시 함)
      const row = rows.find((r) => r.id === id);
      const total = Number(row?.total_amount ?? 0);
      const policy = row?.stay_check_in ? refundRateFor(row.stay_check_in) : null;
      const policyAmount = policy ? Math.round((total * policy.rate) / 100) : total;
      const policyMsg = policy
        ? `환불 규정 적용: ${policy.label}\n환불 예정액: ${policyAmount.toLocaleString()}원 (결제 ${total.toLocaleString()}원)`
        : `환불 예정액: ${total.toLocaleString()}원`;

      if (confirm(`${policyMsg}\n\n규정대로 환불하고 취소할까요? (되돌릴 수 없어요)\n\n[취소]를 누르면 전액 환불 옵션을 물어봅니다.`)) {
        fullRefund = false;
      } else if (
        policy && policy.rate < 100 &&
        confirm(`규정과 무관하게 전액(${total.toLocaleString()}원) 환불로 취소할까요?\n(호텔 귀책·특별 배려 시에만 사용)`)
      ) {
        fullRefund = true;
      } else {
        return; // 중단
      }
    }
    const prev = rows;
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    const res = await fetch("/api/admin/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, fullRefund }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "처리에 실패했습니다.");
      setRows(prev); // 롤백
    } else if (status === "cancelled") {
      const d = await res.json().catch(() => ({}));
      const refundMsg = d.refundAmount != null
        ? `${Number(d.refundAmount).toLocaleString()}원 환불 (${d.refundNote ?? "규정 적용"})`
        : "환불 처리";
      alert(`취소 완료 — ${refundMsg}${d.smsSent ? " + 취소 문자 발송" : " (취소 문자는 발송되지 않았어요)"}`);
    }
  }

  const cards = [
    { label: "예약 확정", value: `${stats.confirmed}건` },
    { label: "확정 매출", value: `${stats.revenue.toLocaleString()}원` },
    { label: "취소", value: `${stats.cancelled}건` },
  ];

  // 재고 피벗 (날짜 × 객실타입) — 월별 탭 + 필터 + 요약
  const invView = useMemo(() => {
    const rooms = Array.from(new Set(inv.map((i) => i.room_type)));
    const byDate = new Map<string, Record<string, Inv>>();
    for (const i of inv) {
      if (!byDate.has(i.date)) byDate.set(i.date, {});
      byDate.get(i.date)![i.room_type] = i;
    }
    const allDates = Array.from(byDate.keys()).sort();
    const months = Array.from(new Set(allDates.map((d) => d.slice(0, 7)))).sort();

    let dates = invMonth ? allDates.filter((d) => d.startsWith(invMonth)) : allDates;
    if (invFilter === "booked") dates = dates.filter((d) => rooms.some((rm) => (byDate.get(d)![rm]?.booked ?? 0) > 0));
    if (invFilter === "tight") dates = dates.filter((d) => rooms.some((rm) => {
      const c = byDate.get(d)![rm];
      return c && c.allocated > 0 && c.remaining <= 2;
    }));

    // 현재 보이는 범위 기준 요약 (객실별 잔여 합 / 마감 일수 / 임박 일수)
    const totals: Record<string, { remaining: number; soldOutDays: number; tightDays: number }> = {};
    for (const d of dates) {
      for (const rm of rooms) {
        const c = byDate.get(d)![rm];
        if (!c) continue;
        const t = (totals[rm] ??= { remaining: 0, soldOutDays: 0, tightDays: 0 });
        t.remaining += c.remaining;
        if (c.allocated > 0 && c.remaining <= 0) t.soldOutDays++;
        else if (c.allocated > 0 && c.remaining <= 2) t.tightDays++;
      }
    }
    return { rooms, byDate, dates, months, totals };
  }, [inv, invMonth, invFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">호텔 예약 관리</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-sm text-gray-400">{c.label}</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800 mt-2 tnum">{c.value}</p>
          </div>
        ))}
      </div>

      {/* 필터 탭 + 명단 내보내기 */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
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
          {/* 예약 검색 */}
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예약번호 · 예약자 · 연락처 검색"
              className="w-56 sm:w-64 border border-gray-200 rounded-full pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white"
            />
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
            {query && (
              <button onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm leading-none">
                ✕
              </button>
            )}
          </div>
          {query && (
            <span className="text-xs text-gray-400">{visible.length}건 검색됨</span>
          )}
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
      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <div className="grid grid-cols-[1.4fr_1.4fr_1.6fr_1fr_0.8fr_0.7fr] gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-400 min-w-[760px]">
          <span>예약번호</span><span>예약자</span><span>호텔 · 객실</span><span>투숙기간</span><span className="text-right">금액</span><span className="text-center">상태</span>
        </div>
        {loading ? (
          <div className="p-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : visible.length === 0 ? (
          <div className="p-16 text-center text-sm text-gray-400">예약이 없습니다</div>
        ) : (
          paged.map((r) => {
            const st = STATUS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-500" };
            return (
              <div key={r.id} className="grid grid-cols-[1.4fr_1.4fr_1.6fr_1fr_0.8fr_0.7fr] gap-3 px-6 py-4 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50/60 transition-colors min-w-[760px]">
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
                    <button onClick={() => openDateModal(r)} className="text-[11px] text-blue-500 hover:underline mt-0.5">📅 예약변경</button>
                  )}
                </div>
                <div className="text-right tnum">
                  <div className="text-sm font-semibold text-gray-800">{Number(r.total_amount).toLocaleString()}원</div>
                  {r.paid_at_kst && <div className="text-[11px] text-gray-400 mt-0.5">💳 {r.paid_at_kst}</div>}
                </div>
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
                    <option value="cancelled">취소</option>
                  </select>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 페이지네이션 */}
      {visible.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
            className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-500 text-sm disabled:opacity-30 hover:bg-gray-50">
            ‹
          </button>
          {pageNums.map((n) => (
            <button key={n} onClick={() => setPage(n)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                n === safePage ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              {n}
            </button>
          ))}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
            className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-500 text-sm disabled:opacity-30 hover:bg-gray-50">
            ›
          </button>
          <span className="text-xs text-gray-400 ml-2 tnum">
            {safePage} / {totalPages} 페이지 · 총 {visible.length}건
          </span>
        </div>
      )}

      {/* 객실 재고 현황 — 월별 탭 + 필터 + 요약 */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-gray-800">🛏 객실 재고 현황</h2>
          <div className="flex gap-2 items-center flex-wrap">
            {/* 필터 칩 */}
            {([["all", "전체 날짜"], ["booked", "예약 있는 날"], ["tight", "마감·임박만"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setInvFilter(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  invFilter === k ? "bg-gray-800 text-white border-gray-800" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 월 탭 */}
        <div className="flex gap-1 mb-3 bg-white rounded-xl border border-gray-100 p-1 w-fit flex-wrap">
          <button onClick={() => setInvMonth("")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !invMonth ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            전체
          </button>
          {invView.months.map((m) => (
            <button key={m} onClick={() => setInvMonth(m)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                invMonth === m ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {Number(m.slice(5))}월
            </button>
          ))}
        </div>

        {/* 보이는 범위 요약 */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {invView.rooms.map((rm) => {
            const t = invView.totals[rm];
            if (!t) return null;
            return (
              <div key={rm} className="bg-white rounded-xl border border-gray-100 px-4 py-2.5 text-xs text-gray-500 flex items-center gap-3">
                <b className="text-gray-800">{rm}</b>
                <span>잔여 <b className="text-gray-800 tnum">{t.remaining}</b>실</span>
                <span style={{ color: "#dc2626" }}>마감 <b className="tnum">{t.soldOutDays}</b>일</span>
                <span style={{ color: "#ea580c" }}>임박(1~2) <b className="tnum">{t.tightDays}</b>일</span>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-400" style={{ gridTemplateColumns: `1.2fr repeat(${invView.rooms.length}, 1fr)` }}>
            <span>투숙일</span>
            {invView.rooms.map((rm) => <span key={rm} className="text-center">{rm} (남음/배정)</span>)}
          </div>
          <div className="max-h-[32rem] overflow-auto">
            {inv.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">재고 데이터가 없습니다</div>
            ) : invView.dates.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">조건에 맞는 날짜가 없습니다 — 필터를 바꿔보세요</div>
            ) : (
              invView.dates.map((d) => {
                const dow = new Date(d).getDay(); // 0=일, 6=토
                return (
                  <div key={d} className={`grid px-6 py-2.5 border-b border-gray-50 last:border-0 items-center text-sm ${dow === 0 || dow === 6 ? "bg-amber-50/40" : ""}`}
                    style={{ gridTemplateColumns: `1.2fr repeat(${invView.rooms.length}, 1fr)` }}>
                    <span className="tnum font-medium" style={{ color: dow === 0 ? "#dc2626" : dow === 6 ? "#2563eb" : "#4b5563" }}>
                      {md(d)}
                    </span>
                    {invView.rooms.map((rm) => {
                      const c = invView.byDate.get(d)?.[rm];
                      if (!c || c.allocated === 0) return <span key={rm} className="text-center text-gray-300">배정 없음</span>;
                      const soldOut = c.remaining <= 0;
                      const low = c.remaining > 0 && c.remaining <= 2;
                      return (
                        <span key={rm} className="text-center tnum font-semibold" style={{ color: soldOut ? "#dc2626" : low ? "#ea580c" : "#374151" }}>
                          {soldOut ? "마감" : `${c.remaining}실`}
                          <span className="text-gray-300 font-normal"> / {c.allocated}</span>
                          {c.booked > 0 && <span className="text-gray-400 font-normal text-xs"> (예약 {c.booked})</span>}
                        </span>
                      );
                    })}
                  </div>
                );
              })
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
              <p className="text-sm font-bold text-gray-800">📅 예약 변경 — 날짜 · 인원 · 객실</p>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">{dateEdit.order_number} · {dateEdit.buyer_name} · {hotelRoom(dateEdit.product_name)}</p>
              {(() => {
                const m = stayMeta(dateEdit.product_name);
                return m ? (
                  <p className="text-xs text-gray-500 mt-1.5">
                    🛏 <b>{m.room}</b> — {m.bed} · {m.capacity} · <b>{m.pkgLabel}</b> ({m.people})
                  </p>
                ) : null;
              })()}
            </div>

            {/* 화면 분기: 완료 > 미리보기 > 입력 순으로 우선 (완료되면 무조건 완료 화면) */}
            {dateResult ? (
              <div className="p-5 space-y-3">
                <p className="text-sm font-bold text-gray-800">✅ 예약 변경 완료</p>
                {dateResult.refunded > 0 && (
                  <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                    차액 <b>{dateResult.refunded.toLocaleString()}원</b> 자동 환불 완료
                  </div>
                )}
                {dateResult.diff === 0 && (
                  <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">요금 차이 없음</div>
                )}
                {dateResult.needRepay && (
                  <div className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-700 space-y-2">
                    <p><b>⚠️ 추가 차액 {dateResult.diff.toLocaleString()}원</b> — 아래 결제링크를 고객에게 보내주세요. 카드로 바로 결제할 수 있어요.</p>
                    {dateResult.payLink && (
                      <div className="flex gap-1.5">
                        <input readOnly value={dateResult.payLink}
                          className="flex-1 min-w-0 text-[11px] font-mono bg-white border border-orange-200 rounded-lg px-2 py-2 text-gray-600"
                          onFocus={(e) => e.target.select()} />
                        <button onClick={() => copyPayLink(dateResult.payLink!)}
                          className={`shrink-0 px-3 py-2 text-xs font-bold rounded-lg ${linkCopied ? "bg-green-600 text-white" : "bg-orange-600 hover:bg-orange-700 text-white"}`}>
                          {linkCopied ? "✓ 복사됨" : "🔗 링크 복사"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => setDateEdit(null)} className="w-full py-2.5 bg-gray-900 text-white text-sm font-bold rounded-lg">완료</button>
              </div>
            ) : !datePreview ? (
              <div className="p-5 space-y-3">
                {/* 인원(패키지) 선택 */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">인원 (패키지)</label>
                  <div className="flex gap-1.5">
                    {(["p2", "p3", "p4"] as PkgKey[]).map((p) => (
                      <button key={p} onClick={() => pickPkg(p)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border ${newPkg === p ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                        {PACKAGES[p].label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 객실(침대) 선택 — 2인 패키지만 더블 선택 가능 */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">객실 (침대)</label>
                  <div className="flex gap-1.5">
                    {(["디럭스 더블", "패밀리 트윈"] as RoomType[]).map((rm) => {
                      const disabled = newPkg !== "p2" && rm === "디럭스 더블";
                      return (
                        <button key={rm} onClick={() => !disabled && setNewRoom(rm)} disabled={disabled}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg border ${newRoom === rm ? "bg-blue-600 text-white border-blue-600" : disabled ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                          {rm} <span className="font-normal">· {ROOM_META[rm].bed}</span>
                        </button>
                      );
                    })}
                  </div>
                  {newPkg !== "p2" && (
                    <p className="text-[11px] text-gray-400 mt-1">3·4인 패키지는 패밀리 트윈만 가능해요.</p>
                  )}
                </div>
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
                {/* 대상 기간 잔여 객실 즉시 확인 */}
                {avail && (
                  avail.checking ? (
                    <p className="text-xs text-gray-400">잔여 객실 확인 중…</p>
                  ) : avail.available ? (
                    <div className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                      ✅ 변경 가능 — 해당 기간 잔여 <b>최소 {avail.minRemaining}실</b>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                      ⛔ 변경 불가 — 마감된 날짜: <b>{(avail.soldOutDates ?? []).map((d) => md(d)).join(", ")}</b>
                    </div>
                  )
                )}
                <p className="text-xs text-gray-400">현재: {md(dateEdit.stay_check_in)} ~ {md(dateEdit.stay_check_out)} · 요금 차이는 자동 환불(저렴)/차액 링크(비쌈)로 처리돼요.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={previewDateChange} disabled={changing || avail?.available === false}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg">
                    {changing ? "계산 중…" : "차액 확인"}
                  </button>
                  <button onClick={() => setDateEdit(null)} disabled={changing}
                    className="px-4 py-2.5 text-sm text-gray-400 border border-gray-200 rounded-lg hover:text-gray-600">닫기</button>
                </div>
              </div>
            ) : datePreview ? (
              <div className="p-5 space-y-3">
                <div className="rounded-lg bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3 text-gray-500">
                    <span className="shrink-0">변경 전</span>
                    <span className="text-right">{(() => { const m = stayMeta(dateEdit.product_name); return m ? `${m.pkgLabel} · ${m.room}` : hotelRoom(dateEdit.product_name); })()}<br />{md(dateEdit.stay_check_in)} ~ {md(dateEdit.stay_check_out)} · {datePreview.oldTotal.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between gap-3 font-medium text-gray-800">
                    <span className="shrink-0">변경 후</span>
                    <span className="text-right">{datePreview.pkgLabel} · {datePreview.room}<br />{md(newIn)} ~ {md(newOut)} ({datePreview.nights}박) · {datePreview.newTotal.toLocaleString()}원</span>
                  </div>
                </div>
                {datePreview.available ? (
                  <div className="rounded-lg bg-green-50 px-4 py-2.5 text-xs text-green-700">
                    ✅ 해당 기간 예약 가능 — 잔여 최소 <b>{datePreview.minRemaining}실</b>
                  </div>
                ) : (
                  <div className="rounded-lg bg-red-50 px-4 py-2.5 text-xs text-red-600">
                    ⛔ 변경 불가 — 마감된 날짜: <b>{datePreview.soldOutDates.map((d) => md(d)).join(", ")}</b>
                  </div>
                )}
                {datePreview.diff > 0 ? (
                  <div className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-700 space-y-2">
                    <p>추가 차액 <b>{datePreview.diff.toLocaleString()}원</b> 발생 — 아래 결제링크를 <b>확정 전에 미리</b> 고객에게 보내 결제받아도 돼요.</p>
                    {datePreview.payLink && (
                      <div className="flex gap-1.5">
                        <input readOnly value={datePreview.payLink}
                          className="flex-1 min-w-0 text-[11px] font-mono bg-white border border-orange-200 rounded-lg px-2 py-2 text-gray-600"
                          onFocus={(e) => e.target.select()} />
                        <button onClick={() => copyPayLink(datePreview.payLink!)}
                          className={`shrink-0 px-3 py-2 text-xs font-bold rounded-lg ${linkCopied ? "bg-green-600 text-white" : "bg-orange-600 hover:bg-orange-700 text-white"}`}>
                          {linkCopied ? "✓ 복사됨" : "🔗 링크 복사"}
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-orange-500">💡 결제 확인(주문 목록에 차액 주문 생성) 후 아래 [변경 확정]을 눌러야 예약이 실제로 바뀌어요. 먼저 확정해도 링크는 동일하게 유효해요.</p>
                  </div>
                ) : datePreview.diff < 0 ? (
                  <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                    <b>{(-datePreview.diff).toLocaleString()}원</b> 저렴 → 확정 시 <b>자동 환불</b>됩니다.
                  </div>
                ) : (
                  <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">요금 차이 없음 — 날짜만 변경됩니다.</div>
                )}
                <p className="text-xs text-gray-400">정말 이대로 변경할까요? 확정하면 재고와 결제가 즉시 처리됩니다.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={confirmDateChange} disabled={changing || !datePreview.available}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg">
                    {changing ? "변경 중…" : datePreview.available ? "변경 확정" : "잔여 객실 없음"}
                  </button>
                  <button onClick={() => setDatePreview(null)} disabled={changing}
                    className="px-4 py-2.5 text-sm text-gray-400 border border-gray-200 rounded-lg hover:text-gray-600">뒤로</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
