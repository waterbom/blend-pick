"use client";
import { apiErrorMessage, readApiJson } from '@/lib/api-error-message';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOOKABLE_FROM, BOOKABLE_TO, refundRateFor, PACKAGES, ROOM_META, type PkgKey, type RoomType } from "@/lib/hotel";
import { downloadXlsx } from "@/lib/xlsx-download";
import RoomInventoryClient from "./RoomInventoryClient";
import { STAY_FILTERS, stayOfProduct, type StayKey } from "@/lib/stay-admin";

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
  extra_paid: number; // 예약 변경 차액 등 이 예약번호로 들어온 추가 결제 합계
  influencer_name: string | null; // 어느 인플루언서 링크로 들어온 예약인지 (null = 직접 유입)
  stay_changed: boolean; // 예약 변경(날짜 이동·재결제 정정 등) 이력 표시
  repaid_after_cancel: boolean; // 같은 연락처로 먼저 취소된 예약이 있는 재결제 건
  created_at: string;
  paid_at_kst: string | null;
  cancelled_at_kst: string | null; // 취소 요청이 처리된 시각 (KST)
  product_name: string | null;
  // 호텔 전달 상태 — 도장 시각 (원본은 비교용, kst는 표시용)
  hotel_sent_at: string | null;
  hotel_confirmed_at: string | null;
  stay_changed_at: string | null;
  cancelled_at: string | null;
  hotel_sent_kst: string | null;
  hotel_confirmed_kst: string | null;
  last_change: string | null; // 최근 변경 이력 "8/10~8/11 → 8/20~8/21 (07/29 14:00, 관리자)"
}

// 호텔 전달 상태 — hotel_sent_at(호텔이 아는 마지막 시점) 기준으로 미전달분을 계산
type DeliveryState = "new_pending" | "change_pending" | "cancel_pending" | "await_confirm" | "confirmed" | null;
function deliveryState(r: Reservation): DeliveryState {
  const sent = r.hotel_sent_at ? Date.parse(r.hotel_sent_at) : null;
  if (r.status === "cancelled") {
    if (!sent) return null; // 전달 전에 취소 → 호텔은 몰라도 되는 예약
    return r.cancelled_at && Date.parse(r.cancelled_at) > sent ? "cancel_pending" : "confirmed";
  }
  if (r.status === "awaiting") return null; // 승인 전 — 호텔 전달 대상 아님
  if (!sent) return "new_pending";
  if (r.stay_changed_at && Date.parse(r.stay_changed_at) > sent) return "change_pending";
  if (!r.hotel_confirmed_at || Date.parse(r.hotel_confirmed_at) < sent) return "await_confirm";
  return "confirmed";
}
const DELIVERY_BADGE: Record<Exclude<DeliveryState, null>, { label: string; cls: string }> = {
  new_pending:    { label: "신규 미전달", cls: "bg-red-50 text-red-500" },
  change_pending: { label: "변경 미전달", cls: "bg-amber-50 text-amber-600" },
  cancel_pending: { label: "취소 미전달", cls: "bg-red-50 text-red-500" },
  await_confirm:  { label: "호텔 확인 대기", cls: "bg-blue-50 text-blue-500" },
  confirmed:      { label: "호텔 확인 완료", cls: "bg-green-50 text-green-600" },
};

// 체크인/노쇼는 호텔이 관리 — 우리는 예약확정/취소만 다룸 (레거시 상태는 표시만)
const STATUS: Record<string, { label: string; cls: string }> = {
  awaiting:   { label: "예약대기",   cls: "bg-amber-50 text-amber-600" },
  paid:       { label: "예약확정",   cls: "bg-blue-50 text-blue-600" },
  checked_in: { label: "체크인완료", cls: "bg-green-50 text-green-600" },
  cancelled:  { label: "취소",       cls: "bg-gray-100 text-gray-400" },
  no_show:    { label: "노쇼",       cls: "bg-red-50 text-red-500" },
};

const TABS = [
  { key: "", label: "전체" },
  { key: "awaiting", label: "예약대기" },
  { key: "paid", label: "예약확정" },
  { key: "checked_in", label: "체크인완료" },
  { key: "cancelled", label: "취소" },
  { key: "no_show", label: "노쇼" },
  { key: "changed", label: "변경" }, // 날짜 변경 이력 or 취소 후 재결제 건만 모아보기
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
const todayISO = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

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

// 호텔 전달용 예약자 명단 — 엑셀(.xlsx) 다운로드 (금액은 숫자 셀 → 바로 SUM 가능)
const ROSTER_HEADER = ["예약번호", "예약자", "연락처", "패키지", "객실", "요청사항", "체크인", "체크아웃", "박수", "상태", "변경/취소", "결제금액", "추가결제", "인플루언서", "결제시간", "취소시간", "예약일"];
// 변경/취소 열: 날짜 변경 이력 → "변경", 취소 후 재결제 → "취소", 둘 다면 "변경·취소"
function changeMark(r: Reservation) {
  return [r.stay_changed ? "변경" : "", r.repaid_after_cancel ? "취소" : ""].filter(Boolean).join("·");
}
function toRosterRows(list: Reservation[]): (string | number)[][] {
  return list.map((r) => {
    const parts = (r.product_name || "").split(" · ");
    const pkg = parts[1] || "";
    const room = parts[2] || parts[0] || "";
    const st = (STATUS[r.status] ?? { label: r.status }).label;
    return [
      r.order_number, r.buyer_name, r.buyer_phone, pkg, room, requestMemo(r.addr_memo),
      r.stay_check_in || "", r.stay_check_out || "", nightsOf(r.stay_check_in, r.stay_check_out),
      st, changeMark(r), Number(r.total_amount), Number(r.extra_paid || 0) > 0 ? Number(r.extra_paid) : "", r.influencer_name || "직접 유입", r.paid_at_kst || "", r.cancelled_at_kst || "", new Date(r.created_at).toLocaleDateString("ko-KR"),
    ];
  });
}

export default function ReservationsClient() {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [error, setError] = useState("");
  const [notifyError, setNotifyError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const acting = useRef(false), loadRequest = useRef(0); // 상단 섹션 탭 — 예약 목록 / 객실 재고
  const [stay, setStay] = useState<"" | StayKey>(""); // 숙소 필터 — 전체 / UTOP / 단궁 (목록·재고 공통)

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true); setError("");
    try {
      const data = await readApiJson(await fetch("/api/admin/reservations"), "예약을 불러오지 못했습니다.");
      if (request === loadRequest.current) setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      if (request === loadRequest.current) { setRows([]); setError(apiErrorMessage(error)); }
    } finally { if (request === loadRequest.current) setLoading(false); }
  }, []);
  const loadPending = useCallback(async () => {
    setNotifyError("");
    try {
      const d = await readApiJson(await fetch("/api/admin/reservations/notify"), "문자 발송 대기 건수를 불러오지 못했습니다.");
      setPending(typeof d.pending === "number" ? d.pending : null);
    } catch (error) { setPending(null); setNotifyError(apiErrorMessage(error)); }
  }, []);
  useEffect(() => { load(); loadPending(); return () => { ++loadRequest.current; }; }, [load, loadPending]);

  async function sendAlimtalk() {
    if (acting.current || pending == null || pending === 0) return;
    if (!confirm(`미발송 예약 ${pending ?? 0}건에 예약확인 문자를 일괄 발송할까요?`)) return;
    acting.current = true; setSending(true);
    try {
      const res = await fetch("/api/admin/reservations/notify", { method: "POST" });
      const d = await readApiJson(res);
      if (!res.ok || d.ok === false) {
        alert(apiErrorMessage(d, "발송에 실패했습니다."));
      } else {
        await loadPending();
        let msg = `발송 완료 — 성공 ${d.sent}건 / 실패 ${d.failed}건 (대상 ${d.total}건)`;
        if (d.errors?.length) msg += `\n\n실패 예시:\n${d.errors.join("\n")}`;
        alert(msg);
      }
    } catch (error) { alert(apiErrorMessage(error)); } finally {
      acting.current = false; setSending(false);
    }
  }

  // 날짜 변경 모달
  const [dateEdit, setDateEdit] = useState<Reservation | null>(null);
  const [newIn, setNewIn] = useState("");
  const [newOut, setNewOut] = useState("");
  const [changing, setChanging] = useState(false);
  const dateChanging = useRef(false);
  const [newPkg, setNewPkg] = useState<PkgKey>("p2");
  const [newRoom, setNewRoom] = useState<RoomType>("패밀리 트윈");
  const [datePreview, setDatePreview] = useState<{ diff: number; priceDiff?: number; penalty?: number; penaltyRate?: number; policyDays?: number; oldTotal: number; newTotal: number; nights: number; pkgLabel: string; room: string; available: boolean; minRemaining: number; soldOutDates: string[]; payLink: string | null } | null>(null);
  const [dateResult, setDateResult] = useState<{ diff: number; refunded: number; needRepay: boolean; payLink: string | null } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // 날짜 고르는 동안 대상 기간 잔여 객실 자동 확인 (본인 예약 반납분 포함해서 계산)
  const [avail, setAvail] = useState<{ checking: boolean; error?: string; available?: boolean; minRemaining?: number; soldOutDates?: string[] } | null>(null);

  useEffect(() => {
    if (!dateEdit || !newIn || !newOut || newOut <= newIn) { setAvail(null); return; }
    let cancelled = false;
    setAvail({ checking: true });
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/reservations/change-date", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: dateEdit.id, checkIn: newIn, checkOut: newOut, pkg: newPkg, room: newRoom, preview: true }),
        });
        const d = await readApiJson(res);
        if (cancelled) return;
        if (res.ok && d.ok) setAvail({ checking: false, available: d.available, minRemaining: d.minRemaining, soldOutDates: d.soldOutDates });
        else setAvail({ checking: false, error: apiErrorMessage(d, "객실 재고를 확인하지 못했습니다.") });
      } catch (error) { if (!cancelled) setAvail({ checking: false, error: apiErrorMessage(error) }); }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
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
    if (!dateEdit || dateChanging.current) return;
    if (!newIn || !newOut || newOut <= newIn) { alert("체크아웃은 체크인 이후 날짜여야 해요."); return; }
    dateChanging.current = true; setChanging(true);
    try {
      const res = await fetch("/api/admin/reservations/change-date", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dateEdit.id, checkIn: newIn, checkOut: newOut, pkg: newPkg, room: newRoom, preview: true }),
      });
      const d = await readApiJson(res);
      if (!res.ok || !d.ok) { alert(apiErrorMessage(d, "요금 계산에 실패했습니다.")); return; }
      setLinkCopied(false);
      setDatePreview({ diff: d.diff, priceDiff: d.priceDiff, penalty: d.penalty, penaltyRate: d.penaltyRate, policyDays: d.policyDays, oldTotal: d.oldTotal, newTotal: d.newTotal, nights: d.nights, pkgLabel: d.pkgLabel, room: d.room, available: d.available, minRemaining: d.minRemaining, soldOutDates: d.soldOutDates ?? [], payLink: d.payLink ?? null });
    } catch (error) { alert(apiErrorMessage(error)); } finally {
      dateChanging.current = false; setChanging(false);
    }
  }

  // 2단계: 확인 후 실제 변경 실행 (재고 스왑 + 환불/링크)
  async function confirmDateChange() {
    if (!dateEdit || !datePreview?.available || dateChanging.current) return;
    dateChanging.current = true; setChanging(true);
    try {
      const res = await fetch("/api/admin/reservations/change-date", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dateEdit.id, checkIn: newIn, checkOut: newOut, pkg: newPkg, room: newRoom }),
      });
      const d = await readApiJson(res);
      if (!res.ok || !d.ok) { alert(apiErrorMessage(d, "예약 변경에 실패했습니다.")); return; }
      // 미리보기 상태를 지워야 완료 화면으로 전환됨 (화면 분기가 미리보기 우선이라 안 지우면 그대로 떠있음)
      setDatePreview(null);
      setLinkCopied(false);
      setDateResult({ diff: d.diff, refunded: d.refunded, needRepay: d.needRepay, payLink: d.payLink ?? null });
      await load();
    } catch (error) { alert(apiErrorMessage(error)); } finally {
      dateChanging.current = false; setChanging(false);
    }
  }

  // 선택 숙소의 예약만 — 통계·필터·목록 전부 이 기준으로
  const stayRows = useMemo(
    () => (stay ? rows.filter((r) => stayOfProduct(r.product_name) === stay) : rows),
    [rows, stay]
  );
  // 숙소 탭 라벨용 건수
  const stayCounts = useMemo(() => {
    const c: Record<string, number> = { "": rows.length, utop: 0, dangung: 0 };
    rows.forEach((r) => { c[stayOfProduct(r.product_name)]++; });
    return c;
  }, [rows]);

  const stats = useMemo(() => {
    let confirmed = 0, checkedIn = 0, cancelled = 0, revenue = 0;
    for (const r of stayRows) {
      if (r.status === "paid") confirmed++;
      if (r.status === "checked_in") checkedIn++;
      if (r.status === "cancelled") cancelled++;
      // 확정 매출 = 취소·승인 전 제외 전부 — 자동 체크인으로 상태가 넘어가도 매출은 그대로 누적
      if (r.status !== "cancelled" && r.status !== "awaiting") {
        revenue += (Number(r.total_amount) || 0) + (Number(r.extra_paid) || 0);
      }
    }
    let dNew = 0, dChange = 0, dCancel = 0, dAwait = 0;
    for (const r of stayRows) {
      const ds = deliveryState(r);
      if (ds === "new_pending") dNew++;
      else if (ds === "change_pending") dChange++;
      else if (ds === "cancel_pending") dCancel++;
      else if (ds === "await_confirm") dAwait++;
    }
    return { confirmed, checkedIn, cancelled, revenue, dNew, dChange, dCancel, dAwait };
  }, [stayRows]);

  const [query, setQuery] = useState("");
  const [infSel, setInfSel] = useState(""); // "" 전체 / 인플루언서 이름
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryState | "" | "pending">(""); // 전달 카운터 클릭 필터

  // 필터 옵션 — 예약 데이터에 등장하는 인플루언서 목록
  const influencerOptions = useMemo(() => {
    const s = new Set<string>();
    stayRows.forEach((r) => { if (r.influencer_name) s.add(r.influencer_name); });
    return [...s].sort();
  }, [stayRows]);

  const visible = useMemo(() => {
    let list =
      tab === "changed"
        ? stayRows.filter((r) => r.stay_changed || r.repaid_after_cancel)
        : tab
          ? stayRows.filter((r) => r.status === tab)
          : stayRows;
    if (infSel) list = list.filter((r) => r.influencer_name === infSel);
    if (deliveryFilter) list = list.filter(r => deliveryFilter === "pending"
      ? ["new_pending", "change_pending", "cancel_pending"].includes(deliveryState(r) ?? "")
      : deliveryState(r) === deliveryFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      const qDigits = q.replace(/[^0-9]/g, "");
      list = list.filter((r) =>
        (r.order_number ?? "").toLowerCase().includes(q) ||
        (r.buyer_name ?? "").toLowerCase().includes(q) ||
        (r.product_name ?? "").toLowerCase().includes(q) ||
        (qDigits.length >= 3 && (r.buyer_phone ?? "").replace(/[^0-9]/g, "").includes(qDigits))
      );
    }
    return list;
  }, [stayRows, tab, query, infSel, deliveryFilter]);

  // 페이지네이션 — 탭/검색이 바뀌면 1페이지로 (명단 다운로드는 전체 visible 기준 유지)
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [tab, query, infSel, deliveryFilter, stay]);
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
    if (acting.current) return;
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
    acting.current = true; setActingId(id);
    const prev = rows;
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, fullRefund }),
      });
      const d = await readApiJson(res, "처리에 실패했습니다.");
      await load();
      await loadPending();
      if (status === "cancelled") {
        const refundMsg = d.refundAmount != null
          ? `${Number(d.refundAmount).toLocaleString()}원 환불 (${d.refundNote ?? "규정 적용"})`
          : "환불 처리";
        alert(`취소 완료 — ${refundMsg}${d.smsSent ? " + 취소 문자 발송" : " (취소 문자는 발송되지 않았어요)"}`);
      } else if (status === "paid" && prev.find((r) => r.id === id)?.status === "awaiting") {
        alert(`승인 완료 — 예약확정${d.smsSent ? " + 확정 문자 발송" : " (문자는 발송되지 않았어요 — 문자 설정 확인)"}`);
      }
    } catch (error) {
      alert(apiErrorMessage(error));
    } finally { acting.current = false; setActingId(null); }
  }

  // 호텔 전달/확인 도장 — 도장 후 목록 새로고침
  async function markDelivery(id: string, action: "sent" | "confirmed") {
    if (acting.current) return;
    acting.current = true; setActingId(id);
    try {
      const res = await fetch("/api/admin/reservations/delivery", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], action }),
      });
      await readApiJson(res, "처리에 실패했어요.");
      await load();
    } catch (error) { alert(apiErrorMessage(error)); }
    finally { acting.current = false; setActingId(null); }
  }

  // 전달 배지 + 도장 버튼 — 데스크톱 행/모바일 카드 공용
  function renderDelivery(r: Reservation) {
    const ds = deliveryState(r);
    if (!ds) return null;
    const b = DELIVERY_BADGE[ds];
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className={`text-[10.5px] font-semibold rounded-full px-2 py-0.5 ${b.cls}`}
          title={`${r.hotel_sent_kst ? `전달 ${r.hotel_sent_kst}` : "아직 전달 안 됨"}${r.hotel_confirmed_kst ? ` · 확인 ${r.hotel_confirmed_kst}` : ""}`}>
          {b.label}
        </span>
        {(ds === "new_pending" || ds === "change_pending" || ds === "cancel_pending") && (
          <button disabled={!!actingId || sending} onClick={() => markDelivery(r.id, "sent")}
            className="text-[10.5px] text-blue-500 hover:underline" title="호텔에 전달했음을 기록 (전달 일시 도장)">
            📨 전달 완료
          </button>
        )}
        {ds === "await_confirm" && (
          <button disabled={!!actingId || sending} onClick={() => markDelivery(r.id, "confirmed")}
            className="text-[10.5px] text-green-600 hover:underline" title="호텔이 확인했음을 기록">
            ✔ 호텔 확인
          </button>
        )}
      </div>
    );
  }

  // 상태 셀렉트/취소 배지 — 공용 (center: 데스크톱 그리드 셀에서 가운데 정렬)
  function renderStatus(r: Reservation, center = true) {
    const st = STATUS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-500" };
    if (r.status === "cancelled") {
      return (
        <span className={`${center ? "justify-self-center " : ""}text-xs font-semibold rounded-full px-3 py-1 ${st.cls}`}
          title="환불 완료된 예약은 되돌릴 수 없습니다">
          취소
        </span>
      );
    }
    return (
      <select
        value={r.status}
        disabled={!!actingId || sending}
        aria-label={`${r.order_number} 상태 변경`}
        onChange={(e) => updateStatus(r.id, e.target.value)}
        className={`${center ? "justify-self-center " : ""}text-xs font-semibold rounded-full px-2 py-1 cursor-pointer border-0 focus:outline-none ${st.cls}`}
        style={{ appearance: "auto" }}
        title="상태 변경"
      >
        {r.status === "awaiting" && <option value="awaiting">예약대기</option>}
        <option value="paid">{r.status === "awaiting" ? "✅ 승인 (예약확정)" : "예약확정"}</option>
        {r.status !== "awaiting" && <option value="checked_in">체크인완료</option>}
        {r.status !== "awaiting" && <option value="no_show">노쇼</option>}
        <option value="cancelled">취소</option>
      </select>
    );
  }

  function focusDelivery(value: "pending" | "await_confirm") {
    setDeliveryFilter(deliveryFilter === value ? "" : value); setTab(""); setQuery(""); setInfSel("");
  }
  const clearFilters = () => { setTab(""); setDeliveryFilter(""); setQuery(""); setInfSel(""); };

  return (
    <div className="ops-workspace">
      <header className="ops-page-heading"><div><h1>숙박 예약 관리</h1><p>예약·호텔 전달·투숙일을 한 목록에서 확인하세요.</p></div><div className="ops-heading-actions">
        <button className="ops-button" aria-expanded={inventoryOpen} aria-controls="room-inventory" onClick={() => setInventoryOpen(!inventoryOpen)}>{inventoryOpen ? "재고 닫기" : "객실 재고"}</button>
        <button className="ops-button" disabled={loading || !!actingId || sending} onClick={() => { load(); loadPending(); }}>새로고침</button>
      </div></header>
      <section className="ops-reservation-scope"><label htmlFor="reservation-stay">숙소</label><select id="reservation-stay" value={stay} onChange={e => { setStay(e.target.value as "" | StayKey); setInfSel(""); }}>
        {STAY_FILTERS.map(s => <option key={s.key} value={s.key}>{s.label}{!loading && !error ? ` (${stayCounts[s.key] ?? 0}건)` : ""}</option>)}
      </select><span>아래 요약·예약 목록·객실 재고에 함께 적용</span></section>
      {!loading && !error && <div className="ops-summary-grid">
        <button aria-pressed={deliveryFilter === "pending"} onClick={() => focusDelivery("pending")}><span>호텔 미전달</span><strong>{stats.dNew + stats.dChange + stats.dCancel}<small>건</small></strong><small>신규 {stats.dNew} · 변경 {stats.dChange} · 취소 {stats.dCancel}</small></button>
        <button aria-pressed={deliveryFilter === "await_confirm"} onClick={() => focusDelivery("await_confirm")}><span>호텔 확인 대기</span><strong>{stats.dAwait}<small>건</small></strong><small>전달 후 확인이 필요한 예약 →</small></button>
        <button aria-pressed={tab === "paid"} onClick={() => { clearFilters(); setTab(tab === "paid" ? "" : "paid"); }}><span>예약 확정</span><strong>{stats.confirmed}<small>건</small></strong><small>체크인 완료 {stats.checkedIn} · 취소 {stats.cancelled}</small></button>
        <div><span>확정 예약 금액</span><strong>{stats.revenue.toLocaleString()}<small>원</small></strong><small>선택 숙소 전체 · 추가 결제 포함 · 대기·취소 제외</small></div>
      </div>}
      {inventoryOpen && <section id="room-inventory" className="ops-inventory-panel"><div className="ops-section-heading"><h2>객실 재고</h2><span>예약 목록을 유지한 채 선택 숙소의 재고를 확인합니다.</span></div><RoomInventoryClient stay={stay} /></section>}
      <section className="ops-list-panel" aria-label="숙박 예약 목록">
        <div className="ops-toolbar">
          <input className="ops-search" aria-label="예약 검색" value={query} onChange={e => setQuery(e.target.value)} placeholder="예약번호·예약자·연락처·객실 검색" />
          <select aria-label="예약 상태 필터" value={tab} onChange={e => setTab(e.target.value)}>{TABS.map(t => <option key={t.key} value={t.key}>{t.key ? t.label : "예약 상태 전체"}</option>)}</select>
          <select aria-label="호텔 전달 필터" value={deliveryFilter ?? ""} onChange={e => setDeliveryFilter(e.target.value as DeliveryState | "" | "pending")}><option value="">전달 상태 전체</option><option value="pending">미전달 전체</option>{Object.entries(DELIVERY_BADGE).map(([key, b]) => <option key={key} value={key}>{b.label}</option>)}</select>
          <select aria-label="예약 유입 필터" value={infSel} onChange={e => setInfSel(e.target.value)}><option value="">유입 전체</option>{influencerOptions.map(n => <option key={n} value={n}>@{n}</option>)}</select>
          {(query || tab || deliveryFilter || infSel) && <button className="ops-text-button" onClick={clearFilters}>필터 초기화</button>}
        </div>
        <div className="ops-reservation-tools"><span>{loading || error ? "예약 조회 중" : `검색 결과 ${visible.length}건 · 최신순`}</span><div>
          <button className="ops-button" onClick={sendAlimtalk} disabled={sending || pending == null || pending === 0 || loading || !!error || !!actingId} title="숙소·검색 필터와 무관하게 미발송 예약 전체에 발송">{sending ? "발송 중…" : `예약확인 문자 일괄발송${pending != null ? ` (${pending})` : ""}`}</button>
          <button className="ops-button ops-button-primary" onClick={() => downloadXlsx(`호텔예약명단_${todayISO().replace(/-/g, "")}.xlsx`, ROSTER_HEADER, toRosterRows(visible), "예약명단")} disabled={loading || !!error || visible.length === 0}>예약자 명단 다운로드 ({loading || error ? "—" : visible.length})</button>
        </div><small>명단은 검색 결과 전체 · 문자는 검색 필터와 무관한 미발송 전체 예약에 발송</small></div>
        {notifyError && <div className="ops-error" role="alert">문자 대기 건수 확인 실패: {notifyError} <button className="ops-button" onClick={loadPending}>문자 건수 다시 조회</button></div>}
        {loading ? <p className="ops-empty" role="status">예약 불러오는 중…</p> : error ? <div className="ops-error" role="alert">{error} <button className="ops-button" onClick={load}>다시 조회</button></div> : visible.length === 0 ? <p className="ops-empty">조건에 맞는 예약이 없습니다</p> : <div className="ops-table-scroll"><table className="ops-table ops-reservations-table">
          <thead><tr>{["예약자 · 예약번호", "숙소 · 객실", "투숙일 · 변경", "결제금액", "호텔 전달", "상태 · 처리"].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
          <tbody>{paged.map(r => <tr key={r.id}>
            <td data-label="예약자"><strong>{r.buyer_name}</strong><span className="ops-meta">{r.buyer_phone}</span><span className="ops-meta">{r.order_number}</span><span className="ops-meta">{r.influencer_name ? `@${r.influencer_name}` : "직접 유입"}</span></td>
            <td data-label="숙소 · 객실"><strong>{hotelRoom(r.product_name)}</strong>{requestMemo(r.addr_memo) && <p className="ops-meta ops-reservation-memo">요청: {requestMemo(r.addr_memo)}</p>}</td>
            <td data-label="투숙일"><span className="ops-nowrap">{md(r.stay_check_in)} ~ {md(r.stay_check_out)}</span><span className="ops-meta">{nightsOf(r.stay_check_in, r.stay_check_out)}박</span>{changeMark(r) && <span className="ops-status ops-status-preparing">{changeMark(r)}</span>}{r.last_change && <span className="ops-meta">변경: {r.last_change}</span>}</td>
            <td data-label="결제금액"><strong className="ops-nowrap">{(Number(r.total_amount) + Number(r.extra_paid || 0)).toLocaleString()}원</strong>{Number(r.extra_paid) > 0 && <span className="ops-meta">차액 +{Number(r.extra_paid).toLocaleString()}원 포함</span>}{r.paid_at_kst && <span className="ops-meta">결제 {r.paid_at_kst}</span>}{r.status === "cancelled" && r.cancelled_at_kst && <span className="ops-meta ops-warning">취소 {r.cancelled_at_kst}</span>}</td>
            <td data-label="호텔 전달">{renderDelivery(r) || <span className="ops-meta">전달 대상 아님</span>}{r.hotel_sent_kst && <span className="ops-meta">전달 {r.hotel_sent_kst}</span>}{r.hotel_confirmed_kst && <span className="ops-meta">확인 {r.hotel_confirmed_kst}</span>}</td>
            <td data-label="상태 · 처리">{renderStatus(r, false)}{r.status === "paid" && <button className="ops-text-button ops-account-toggle" disabled={!!actingId || sending} onClick={() => openDateModal(r)}>예약변경</button>}</td>
          </tr>)}</tbody>
        </table></div>}
        {!loading && !error && visible.length > PAGE_SIZE && <nav className="ops-pagination" aria-label="예약 페이지"><button className="ops-button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>이전</button>{pageNums.map(n => <button key={n} className="ops-filter-chip" aria-current={n === safePage ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>)}<button className="ops-button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>다음</button><span>{safePage} / {totalPages} 페이지 · 총 {visible.length}건</span></nav>}
      </section>
      <p className="ops-meta">호텔 전달 표시는 실제 전달·확인이 끝난 뒤 기록하세요. 작업지시서를 발행하면 포함된 예약에 전달 도장이 자동으로 기록됩니다.</p>

      {/* 날짜 변경 모달 */}
      {dateEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !changing && setDateEdit(null)}>
          <div role="dialog" aria-modal="true" aria-label="예약 변경" className="bg-white rounded-none w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                  <div className="rounded-none bg-green-50 px-4 py-3 text-sm text-green-700">
                    차액 <b>{dateResult.refunded.toLocaleString()}원</b> 자동 환불 완료
                  </div>
                )}
                {dateResult.diff === 0 && (
                  <div className="rounded-none bg-gray-50 px-4 py-3 text-sm text-gray-600">요금 차이 없음</div>
                )}
                {dateResult.needRepay && (
                  <div className="rounded-none bg-[#EAF0E6] px-4 py-3 text-sm text-[#244B1F] space-y-2">
                    <p><b>⚠️ 추가 차액 {dateResult.diff.toLocaleString()}원</b> — 아래 결제링크를 고객에게 보내주세요. 카드로 바로 결제할 수 있어요.</p>
                    {dateResult.payLink && (
                      <div className="flex gap-1.5">
                        <input readOnly value={dateResult.payLink}
                          className="flex-1 min-w-0 text-[11px] font-mono bg-white border border-[#C7D6C0] rounded-none px-2 py-2 text-gray-600"
                          onFocus={(e) => e.target.select()} />
                        <button onClick={() => copyPayLink(dateResult.payLink!)}
                          className={`shrink-0 px-3 py-2 text-xs font-bold rounded-none ${linkCopied ? "bg-green-600 text-white" : "bg-[#244B1F] hover:bg-orange-700 text-white"}`}>
                          {linkCopied ? "✓ 복사됨" : "🔗 링크 복사"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => setDateEdit(null)} className="w-full py-2.5 bg-gray-900 text-white text-sm font-bold rounded-none">완료</button>
              </div>
            ) : !datePreview ? (
              <div className="p-5 space-y-3">
                {/* 인원(패키지) 선택 */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">인원 (패키지)</label>
                  <div className="flex gap-1.5">
                    {(["p2", "p3", "p4"] as PkgKey[]).map((p) => (
                      <button key={p} disabled={changing} onClick={() => pickPkg(p)}
                        className={`flex-1 py-2 text-xs font-bold rounded-none border ${newPkg === p ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
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
                        <button key={rm} onClick={() => !disabled && setNewRoom(rm)} disabled={disabled || changing}
                          className={`flex-1 py-2 text-xs font-bold rounded-none border ${newRoom === rm ? "bg-blue-600 text-white border-blue-600" : disabled ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
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
                    <input type="date" disabled={changing} value={newIn} min={BOOKABLE_FROM} max={BOOKABLE_TO}
                      onChange={(e) => setNewIn(e.target.value)}
                      className="w-full border border-gray-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">체크아웃</label>
                    <input type="date" disabled={changing} value={newOut} min={newIn || BOOKABLE_FROM} max={BOOKABLE_TO}
                      onChange={(e) => setNewOut(e.target.value)}
                      className="w-full border border-gray-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                {/* 대상 기간 잔여 객실 즉시 확인 */}
                {avail && (
                  avail.checking ? (
                    <p className="text-xs text-gray-400">잔여 객실 확인 중…</p>
                  ) : avail.error ? (
                    <p role="alert" className="text-sm text-red-600">{avail.error}</p>
                  ) : avail.available ? (
                    <div className="rounded-none bg-green-50 px-3 py-2 text-xs text-green-700">
                      ✅ 변경 가능 — 해당 기간 잔여 <b>최소 {avail.minRemaining}실</b>
                    </div>
                  ) : (
                    <div className="rounded-none bg-red-50 px-3 py-2 text-xs text-red-600">
                      ⛔ 변경 불가 — 마감된 날짜: <b>{(avail.soldOutDates ?? []).map((d) => md(d)).join(", ")}</b>
                    </div>
                  )
                )}
                <p className="text-xs text-gray-400">현재: {md(dateEdit.stay_check_in)} ~ {md(dateEdit.stay_check_out)} · 요금 차이는 자동 환불(저렴)/차액 링크(비쌈)로 처리돼요.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={previewDateChange} disabled={changing || avail?.available === false}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-none">
                    {changing ? "계산 중…" : "차액 확인"}
                  </button>
                  <button onClick={() => setDateEdit(null)} disabled={changing}
                    className="px-4 py-2.5 text-sm text-gray-400 border border-gray-200 rounded-none hover:text-gray-600">닫기</button>
                </div>
              </div>
            ) : datePreview ? (
              <div className="p-5 space-y-3">
                <div className="rounded-none bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
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
                  <div className="rounded-none bg-green-50 px-4 py-2.5 text-xs text-green-700">
                    ✅ 해당 기간 예약 가능 — 잔여 최소 <b>{datePreview.minRemaining}실</b>
                  </div>
                ) : (
                  <div className="rounded-none bg-red-50 px-4 py-2.5 text-xs text-red-600">
                    ⛔ 변경 불가 — 마감된 날짜: <b>{datePreview.soldOutDates.map((d) => md(d)).join(", ")}</b>
                  </div>
                )}
                {(datePreview.penalty ?? 0) > 0 && (
                  <div className="rounded-none bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
                    ⚠️ 체크인 {datePreview.policyDays}일 전 변경 — <b>위약금 {datePreview.penaltyRate}% ({datePreview.penalty!.toLocaleString()}원)</b>가 아래 금액에 포함됐어요
                    {datePreview.priceDiff != null && <> (요금 차액 {datePreview.priceDiff >= 0 ? "+" : ""}{datePreview.priceDiff.toLocaleString()}원 + 위약금)</>}
                  </div>
                )}
                {datePreview.diff > 0 ? (
                  <div className="rounded-none bg-[#EAF0E6] px-4 py-3 text-sm text-[#244B1F] space-y-2">
                    <p>추가 차액 <b>{datePreview.diff.toLocaleString()}원</b> 발생 — 아래 결제링크를 <b>확정 전에 미리</b> 고객에게 보내 결제받아도 돼요.</p>
                    {datePreview.payLink && (
                      <div className="flex gap-1.5">
                        <input readOnly value={datePreview.payLink}
                          className="flex-1 min-w-0 text-[11px] font-mono bg-white border border-[#C7D6C0] rounded-none px-2 py-2 text-gray-600"
                          onFocus={(e) => e.target.select()} />
                        <button onClick={() => copyPayLink(datePreview.payLink!)}
                          className={`shrink-0 px-3 py-2 text-xs font-bold rounded-none ${linkCopied ? "bg-green-600 text-white" : "bg-[#244B1F] hover:bg-orange-700 text-white"}`}>
                          {linkCopied ? "✓ 복사됨" : "🔗 링크 복사"}
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-[#2D5A27]">💡 결제 확인(주문 목록에 차액 주문 생성) 후 아래 [변경 확정]을 눌러야 예약이 실제로 바뀌어요. 먼저 확정해도 링크는 동일하게 유효해요.</p>
                  </div>
                ) : datePreview.diff < 0 ? (
                  <div className="rounded-none bg-green-50 px-4 py-3 text-sm text-green-700">
                    <b>{(-datePreview.diff).toLocaleString()}원</b> 저렴 → 확정 시 <b>자동 환불</b>됩니다.
                  </div>
                ) : (
                  <div className="rounded-none bg-gray-50 px-4 py-3 text-sm text-gray-600">요금 차이 없음 — 날짜만 변경됩니다.</div>
                )}
                <p className="text-xs text-gray-400">정말 이대로 변경할까요? 확정하면 재고와 결제가 즉시 처리됩니다.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={confirmDateChange} disabled={changing || !datePreview.available}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-none">
                    {changing ? "변경 중…" : datePreview.available ? "변경 확정" : "잔여 객실 없음"}
                  </button>
                  <button onClick={() => setDatePreview(null)} disabled={changing}
                    className="px-4 py-2.5 text-sm text-gray-400 border border-gray-200 rounded-none hover:text-gray-600">뒤로</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
