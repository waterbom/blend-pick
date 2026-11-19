"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

// LIMEN 예약 관리 — 예약 확정/거절, 카드 결제 예약 환불 취소, 블럭표(객실×날짜 예약 현황)와 날짜별 설정,
// 직접 예약 등록, 객실 요금표·기본 설정.
// 손님 화면(/hotel/limen)의 달력·요금·주소·입실 시간은 모두 여기서 넣은 값으로 바뀐다.

type RoomKey = "one" | "two";
type RateKey = "weekday" | "friday" | "saturday" | "shoulder" | "peak";
type Season = "" | "shoulder" | "peak";
type RoomRates = { open: boolean; guests: number } & Record<RateKey, number | null>;
type Booking = {
  id: string; code: string; status: "requested" | "pending" | "confirming" | "confirmed" | "cancelling" | "cancelled" | "declined" | "expired";
  room: RoomKey; check_in: string; check_out: string; guests: number; guest_name: string; guest_phone: string; memo: string;
  estimate: { total?: number | null; refundTerms?: string }; admin_note: string; cancel_requested: boolean; created_at: string;
  // 카드 결제 예약일 때만 값이 있다
  amount: number | null; paid_at: string | null; refund_amount: number | null; cancel_reason: string | null; receipt_url: string | null;
};
type DayRow = { room: RoomKey; day: string; closed: boolean; price: number | null; season: Season; note: string };
type Config = {
  open: boolean; minLeadDays: number; maxNights: number; windowDays: number; rooms: Record<RoomKey, RoomRates>;
  checkInTime: string; checkOutTime: string;
  address: string; walkNote: string; parkingNote: string; mapUrl: string; notice: string; rules: string; notifyPhone: string;
  payOnline: boolean; refundTerms: string;
};
type Data = {
  today: string; config: Config; days: DayRow[]; bookings: Booking[];
  events: { id: number; action: string; detail: { kind?: string; note?: string; amount?: number; refundAmount?: number; reason?: string }; created_at: string; code: string | null }[];
  smsConfigured: boolean;
  pay: boolean;            // 지금 손님 화면에서 카드 결제가 열려 있는지
  termsReady: boolean;     // 취소·환불 규정이 입력되어 있는지
  paymentReady: boolean;   // 서버에 실결제 키가 있는지
  refundTemplate: string;  // 단궁 예약에 쓰는 환불 규정 (불러와서 고쳐 쓰는 참고용)
};

const ROOMS: { key: RoomKey; name: string }[] = [{ key: "one", name: "원룸" }, { key: "two", name: "투룸" }];
const ROOM_NAME: Record<RoomKey, string> = { one: "원룸", two: "투룸" };
const RATES: { key: RateKey; label: string }[] = [
  { key: "weekday", label: "주중 (일–목)" }, { key: "friday", label: "금요일" }, { key: "saturday", label: "토요일" }, { key: "shoulder", label: "준성수기" }, { key: "peak", label: "극성수기" },
];
const SEASON_NAME: Record<Exclude<Season, "">, string> = { shoulder: "준성수기", peak: "극성수기" };
const STATUS: Record<Booking["status"], string> = {
  requested: "확인 대기", pending: "결제 대기", confirming: "결제 확인 중", confirmed: "예약 확정",
  cancelling: "환불 확인 중", cancelled: "취소", declined: "거절", expired: "결제 미완료",
};
const QUIET = "bg-gray-100 text-gray-600", WAIT = "bg-amber-100 text-amber-900";
const TONE: Record<Booking["status"], string> = {
  requested: WAIT, pending: WAIT, confirming: WAIT, cancelling: WAIT, confirmed: "bg-green-100 text-green-900", declined: QUIET, cancelled: QUIET, expired: QUIET,
};
// 날짜를 잡고 있는 상태
const HOLDING: Booking["status"][] = ["requested", "pending", "confirming", "confirmed", "cancelling"];
const EVENT: Record<string, string> = {
  requested: "예약 신청 접수", confirmed: "예약 확정", declined: "예약 거절", cancelled: "예약 취소", guest_cancelled: "손님이 신청 취소", guest_cancel_requested: "손님이 취소 요청",
  pay_started: "결제 시작", confirming: "결제 승인 요청", paid: "카드 결제 완료", pay_failed: "결제 승인 실패", pay_abandoned: "결제 중단",
  cancelling: "환불 요청", refunded: "환불 완료", cancelled_without_refund: "환불 없이 취소",
  admin_created: "직접 예약 등록", settings_changed: "기본 설정 변경", days_changed: "날짜 설정 변경", days_cleared: "날짜 설정 초기화", sms_sent: "문자 발송", sms_failed: "문자 발송 실패",
};
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const won = (n: unknown) => `${Number(n || 0).toLocaleString("ko-KR")}원`;
const man = (n: number) => `${Math.round(n / 1000) / 10}`;
const DAY = 86400000;
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);
const weekdayOf = (day: string) => new Date(day + "T00:00:00Z").getUTCDay();
const nightsOf = (b: Booking) => Math.round((Date.parse(b.check_out) - Date.parse(b.check_in)) / DAY);
const stamp = (value: string) => new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const input = "block w-full border p-2 mt-1 rounded";
// 그 밤의 요금 (서버 lib/limen-core.cjs 의 priceOf 와 같은 순서: 지정 요금 → 시즌 → 요일)
function priceOf(day: string, rates: RoomRates, row?: DayRow) {
  if (row?.price != null) return row.price;
  if (row?.season) return rates[row.season];
  const weekday = weekdayOf(day);
  return weekday === 5 ? rates.friday : weekday === 6 ? rates.saturday : rates.weekday;
}

export default function LimenAdmin() {
  const [data, setData] = useState<Data | null>(null), [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"requested" | "confirmed" | "all">("requested"), [notify, setNotify] = useState(true);
  const [month, setMonth] = useState(0), [range, setRange] = useState({ start: "", end: "" }), [targets, setTargets] = useState<RoomKey[]>(["one", "two"]);
  const [dayPrice, setDayPrice] = useState(""), [dayNote, setDayNote] = useState("");

  const load = useCallback(() => fetch("/api/admin/limen", { cache: "no-store" }).then(async response => {
    const body = await response.json();
    if (!response.ok) throw Error(body.error || "불러오지 못했습니다.");
    setData(body); setConfig(body.config);
  }), []);
  useEffect(() => { load().catch(e => setError((e as Error).message)); }, [load]);

  async function post(body: object, done = "저장했습니다.") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/limen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "처리하지 못했습니다.");
      await load(); setNotice(done);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function decide(b: Booking, decision: "confirm" | "decline" | "cancel") {
    const label = { confirm: "확정", decline: "거절", cancel: "취소" }[decision];
    const note = decision === "confirm" ? "" : window.prompt(`${b.guest_name}님 예약을 ${label}합니다. 내부 메모를 남기려면 적어 주세요. (손님에게는 보이지 않습니다)`, "");
    if (note === null) return;
    if (decision === "confirm" && !window.confirm(`${b.guest_name}님 ${ROOM_NAME[b.room]} ${b.check_in} ~ ${b.check_out} 예약을 확정할까요?${notify && data?.smsConfigured ? "\n손님에게 확정 문자가 발송됩니다." : ""}`)) return;
    void post({ action: "decide", id: b.id, decision, note, notify }, `${b.guest_name}님 예약을 ${label}했습니다.`);
  }
  // 카드 결제 예약 취소 — 손님이 동의한 규정을 보고 환불 금액을 정한다 (0 = 환불 없이 취소)
  function refund(b: Booking) {
    if (b.amount === null) return;
    const raw = window.prompt(`${b.guest_name}님 예약(${ROOM_NAME[b.room]} ${b.check_in} ~ ${b.check_out})을 취소합니다.\n결제금액은 ${won(b.amount)}입니다. 환불할 금액을 숫자로 입력해 주세요. (0 = 환불 없이 취소)\n손님이 동의한 취소·환불 규정을 먼저 확인하세요.`, String(b.amount));
    if (raw === null) return;
    const amount = Number(raw.replace(/[^0-9]/g, ""));
    if (raw.trim() === "" || !Number.isSafeInteger(amount) || amount > b.amount) { setError(`환불 금액은 0원부터 ${won(b.amount)} 사이로 입력해 주세요.`); return; }
    const reason = window.prompt("취소 사유를 적어 주세요. (카드사 취소 내역에 남습니다)", b.cancel_requested ? "고객 요청 취소" : "");
    if (reason === null) return;
    if (reason.trim().length < 2) { setError("취소 사유를 2자 이상 입력해 주세요."); return; }
    if (!window.confirm(`${won(amount)}을 카드로 환불하고 예약을 취소할까요?\n취소하면 되돌릴 수 없고, 날짜가 다시 열립니다.`)) return;
    void post({ action: "refund", id: b.id, amount, reason: reason.trim(), notify }, `${b.guest_name}님 예약을 취소하고 ${won(amount)}을 환불했습니다.`);
  }
  const field = <K extends keyof Config>(key: K, value: Config[K]) => setConfig(c => (c ? { ...c, [key]: value } : c));
  const roomField = <K extends keyof RoomRates>(room: RoomKey, key: K, value: RoomRates[K]) =>
    setConfig(c => (c ? { ...c, rooms: { ...c.rooms, [room]: { ...c.rooms[room], [key]: value } } } : c));

  // 객실 → 날짜 → 상태 (블럭표 색칠용)
  const dayInfo = useMemo(() => {
    const map: Record<RoomKey, Map<string, { booking?: Booking; row?: DayRow }>> = { one: new Map(), two: new Map() };
    for (const row of data?.days ?? []) map[row.room]?.set(row.day, { row });
    for (const b of data?.bookings ?? []) {
      if (!HOLDING.includes(b.status) || !map[b.room]) continue;
      for (let day = b.check_in; day < b.check_out; day = addDays(day, 1)) map[b.room].set(day, { ...map[b.room].get(day), booking: b });
    }
    return map;
  }, [data]);
  // 블럭표의 칸을 누르면 그 객실의 날짜 범위를 고른다 (첫 번째 누름 = 시작일, 두 번째 = 종료일)
  function pickCell(room: RoomKey, day: string) {
    const fresh = !range.start || !!range.end || targets.length !== 1 || targets[0] !== room;
    if (fresh) { setTargets([room]); setRange({ start: day, end: "" }); }
    else setRange(day < range.start ? { start: day, end: range.start } : { start: range.start, end: day });
  }
  const rangeEnd = range.end || range.start;
  const days = (patch: object, done: string) => void post({ action: "days", rooms: targets, start: range.start, end: rangeEnd, ...patch }, done);

  if (!data || !config) return <div className="commerce-reservation-workspace max-w-6xl mx-auto space-y-6"><h1 className="text-2xl font-bold">LIMEN 예약</h1>{error ? <p role="alert" className="p-3 bg-red-50 text-red-800">{error}</p> : <p className="text-sm text-gray-600">불러오는 중…</p>}</div>;

  const waiting = data.bookings.filter(b => b.status === "requested"), upcoming = data.bookings.filter(b => b.status === "confirmed" && b.check_out >= data.today);
  const cancelAsks = data.bookings.filter(b => b.status === "confirmed" && b.cancel_requested);
  const unsettled = data.bookings.filter(b => b.status === "confirming" || b.status === "cancelling");
  // 카드 결제가 꺼져 있는 이유 (모두 해결되면 요금이 정해진 날짜부터 결제로 받는다)
  const payBlocks = [
    !config.payOnline && "기본 설정의 ‘카드 결제 받기’가 꺼져 있습니다.",
    !data.termsReady && "취소·환불 규정이 비어 있습니다. 기본 설정에서 입력해 주세요.",
    !data.paymentReady && "서버에 토스 실결제 키가 설정되어 있지 않습니다.",
  ].filter((v): v is string => !!v);
  const shown = data.bookings.filter(b => filter === "all" || b.status === filter);
  const base = new Date(`${data.today.slice(0, 7)}-01T00:00:00Z`); base.setUTCMonth(base.getUTCMonth() + month);
  const year = base.getUTCFullYear(), mo = base.getUTCMonth(), ym = `${year}-${String(mo + 1).padStart(2, "0")}`;
  const monthDays = Array.from({ length: new Date(Date.UTC(year, mo + 1, 0)).getUTCDate() }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
  const ready = !busy && !!range.start && targets.length > 0;
  const action = "border px-3 py-2 rounded bg-white disabled:opacity-40";

  return <div className="commerce-reservation-workspace max-w-6xl mx-auto space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold">LIMEN 예약</h1><p className="text-sm text-gray-600 mt-1">연남동 LIMEN(리멘)의 예약·결제, 객실 요금, 날짜, 안내 문구를 관리합니다. 단궁·유탑 예약과 따로 집계됩니다.</p></div>
      <a className="text-sm underline" href="/hotel/limen" target="_blank" rel="noopener noreferrer">손님 화면 열기 ↗</a>
    </div>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-800">{error}</p>}
    {notice && <p role="status" className="p-3 bg-green-50 text-green-900">{notice}</p>}

    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {[["확인 대기", `${waiting.length}건`], ["다가오는 확정 예약", `${upcoming.length}건`], ["예약 받기", config.open ? ROOMS.filter(r => config.rooms[r.key].open).map(r => r.name).join(" · ") || "객실 모두 중지" : "중지"], ["카드 결제", data.pay ? "받는 중" : "꺼짐"], ["문자 발송", data.smsConfigured ? "설정됨" : "설정 필요"]].map(([k, v]) => <div key={k} className="border rounded-xl p-4"><p className="text-sm">{k}</p><b>{v}</b></div>)}
    </div>
    {data.pay
      ? <p className="p-3 bg-green-50 text-green-900 text-sm">카드 결제를 받고 있습니다. 요금이 모두 정해진 일정은 손님이 토스 결제창에서 결제하면 바로 확정됩니다. 요금이 비어 있는 날짜는 결제 없이 신청으로 받습니다.</p>
      : <div className="p-3 bg-amber-50 text-amber-900 text-sm"><b>카드 결제가 꺼져 있어 모든 예약을 ‘신청 → 확정’으로 받고 있습니다.</b><ul className="list-disc pl-5 mt-1">{payBlocks.map(line => <li key={line}>{line}</li>)}</ul></div>}
    {unsettled.length > 0 && <p className="p-3 bg-amber-50 text-amber-900 text-sm">결제·환불 확인 중인 예약이 {unsettled.length}건 있습니다. 목록에서 ‘결제 상태 다시 확인’을 눌러 주세요. 확인 중인 날짜는 자동으로 열리지 않습니다.</p>}
    {cancelAsks.length > 0 && <p className="p-3 bg-amber-50 text-amber-900 text-sm">확정 예약 {cancelAsks.length}건에 손님의 취소 요청이 있습니다. 아래 목록에서 ‘취소 요청’ 표시를 확인해 주세요.</p>}

    <section className="border rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-lg">1. 예약 관리</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {([["requested", `확인 대기 ${waiting.length}`], ["confirmed", "확정"], ["all", "전체"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-full border ${filter === key ? "bg-gray-900 text-white border-gray-900" : ""}`}>{label}</button>)}
          <button type="button" disabled={busy} onClick={() => load().catch(e => setError((e as Error).message))}>새로고침 ↻</button>
        </div>
      </div>
      <p className="text-sm text-gray-600 my-2">카드로 결제한 예약은 결제와 동시에 확정됩니다. 취소할 때는 ‘환불 취소’로 환불 금액을 정해 주세요. 결제 없이 들어온 신청은 그 객실의 날짜가 바로 마감으로 표시되고, 확정하면 유지되며 거절·취소하면 다시 열립니다.</p>
      <label className="flex items-center gap-2 text-sm my-3"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />처리 결과를 손님에게 문자로 알리기{!data.smsConfigured && <span className="text-gray-500">(문자 설정이 없어 발송되지 않습니다)</span>}</label>
      <div className="overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead><tr>{["예약번호", "객실", "입실 → 퇴실", "예약자", "인원", "요금·결제", "상태", "처리"].map(t => <th className="p-2 text-left" key={t}>{t}</th>)}</tr></thead>
          <tbody>
            {shown.map(b => <tr className="border-t align-top" key={b.id}>
              <td className="p-2"><b>{b.code}</b><br /><span className="text-gray-500">{stamp(b.created_at)} 신청</span></td>
              <td className="p-2"><b>{ROOM_NAME[b.room] || b.room}</b></td>
              <td className="p-2">{b.check_in} → {b.check_out}<br /><span className="text-gray-500">{nightsOf(b)}박</span></td>
              <td className="p-2">{b.guest_name}<br />{b.guest_phone ? <a className="underline" href={`tel:${b.guest_phone}`}>{b.guest_phone}</a> : <span className="text-gray-500">연락처 없음</span>}
                {b.memo && <p className="max-w-xs whitespace-pre-wrap text-gray-600 mt-1">요청: {b.memo}</p>}
                {b.admin_note && <p className="max-w-xs whitespace-pre-wrap text-gray-500 mt-1">메모: {b.admin_note}</p>}</td>
              <td className="p-2">{b.guests}명</td>
              <td className="p-2">{b.amount !== null
                ? <>{b.paid_at ? <b>카드 결제 {won(b.amount)}</b> : <span className="text-gray-600">결제 예정 {won(b.amount)}</span>}
                  {b.refund_amount !== null && <span className="block text-gray-600">환불 {won(b.refund_amount)}{b.cancel_reason ? ` · ${b.cancel_reason}` : ""}</span>}
                  {b.receipt_url && <a className="block underline" href={b.receipt_url} target="_blank" rel="noopener noreferrer">영수증 ↗</a>}
                  {b.estimate?.refundTerms && <details className="mt-1"><summary className="cursor-pointer text-gray-600">동의한 환불 규정</summary><p className="max-w-sm whitespace-pre-wrap text-gray-600 mt-1">{b.estimate.refundTerms}</p></details>}</>
                : typeof b.estimate?.total === "number" ? <>예상 {won(b.estimate.total)}<span className="block text-gray-500">결제 없음</span></> : "요금 미설정"}</td>
              <td className="p-2"><span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${TONE[b.status]}`}>{STATUS[b.status]}</span>{b.cancel_requested && <span className="block mt-1 text-xs font-bold text-red-700">취소 요청</span>}</td>
              <td className="p-2 space-x-2">
                {b.status === "requested" && <><button type="button" disabled={busy} className="bg-green-800 text-white px-3 py-1.5 rounded" onClick={() => decide(b, "confirm")}>확정</button><button type="button" disabled={busy} className="border px-3 py-1.5 rounded" onClick={() => decide(b, "decline")}>거절</button></>}
                {b.status === "confirmed" && (b.paid_at
                  ? <button type="button" disabled={busy} className="border border-red-300 text-red-800 px-3 py-1.5 rounded" onClick={() => refund(b)}>환불 취소</button>
                  : <button type="button" disabled={busy} className="border border-red-300 text-red-800 px-3 py-1.5 rounded" onClick={() => decide(b, "cancel")}>예약 취소</button>)}
                {(b.status === "confirming" || b.status === "cancelling") && <button type="button" disabled={busy} className="border px-3 py-1.5 rounded" onClick={() => void post({ action: "reconcile", id: b.id }, "결제 기록을 다시 확인했습니다.")}>결제 상태 다시 확인</button>}
              </td>
            </tr>)}
          </tbody>
        </table>
        {!shown.length && <p className="py-6 text-center text-gray-500">{filter === "requested" ? "확인을 기다리는 신청이 없습니다." : "해당하는 예약이 없습니다."}</p>}
      </div>
    </section>

    <section className="border rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-lg">2. 블럭표 · 날짜별 설정</h2>
        <div className="flex items-center gap-2 text-sm"><button type="button" className="border px-3 py-1.5 rounded" disabled={month === 0} onClick={() => setMonth(m => m - 1)}>← 이전 달</button><b className="px-2">{year}년 {mo + 1}월</b><button type="button" className="border px-3 py-1.5 rounded" disabled={month >= 11} onClick={() => setMonth(m => m + 1)}>다음 달 →</button></div></div>
      <p className="text-sm text-gray-600">객실별 예약 현황과 그날의 1박 요금(만원)입니다. 칸을 눌러 시작일과 종료일을 고른 뒤 아래에서 닫거나 시즌·요금을 지정하세요. 다른 곳(전화·타 플랫폼)에서 예약이 잡힌 날은 닫아 두면 손님 달력에 마감으로 보입니다.</p>
      <div className="overflow-x-auto">
        <table className="text-xs text-center border-separate" style={{ borderSpacing: 2 }} aria-label={`${year}년 ${mo + 1}월 블럭표`}>
          <thead><tr><th className="sticky left-0 bg-white px-2 text-left min-w-[52px]">객실</th>
            {monthDays.map(day => { const weekday = weekdayOf(day); return <th key={day} className={`font-normal min-w-[38px] ${weekday === 5 || weekday === 6 ? "text-amber-800" : "text-gray-500"}`}>{Number(day.slice(8))}<br />{WEEK[weekday]}</th>; })}</tr></thead>
          <tbody>
            {ROOMS.map(room => <tr key={room.key}>
              <th className="sticky left-0 bg-white px-2 text-left font-bold">{room.name}{!config.rooms[room.key].open && <span className="block font-normal text-gray-500">중지</span>}</th>
              {monthDays.map(day => {
                const info = dayInfo[room.key].get(day), past = day < data.today, price = priceOf(day, config.rooms[room.key], info?.row);
                const selected = targets.includes(room.key) && !!range.start && day >= range.start && day <= rangeEnd;
                const tone = info?.booking ? (info.booking.status === "confirmed" ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900")
                  : info?.row?.closed ? "bg-gray-200 text-gray-500"
                  : past ? "bg-white text-gray-300"
                  : info?.row?.season === "peak" ? "bg-rose-50" : info?.row?.season === "shoulder" ? "bg-orange-50" : "bg-white";
                const title = `${room.name} ${day}${info?.booking ? ` · ${info.booking.guest_name} (${STATUS[info.booking.status]})` : info?.row?.closed ? " · 닫힘" : ""}${info?.row?.season ? ` · ${SEASON_NAME[info.row.season]}` : ""}${info?.row?.note ? ` · ${info.row.note}` : ""}`;
                return <td key={day} className="p-0">
                  <button type="button" title={title} aria-label={title} aria-pressed={selected} onClick={() => pickCell(room.key, day)}
                    className={`block w-full min-w-[38px] h-12 border rounded leading-tight ${tone} ${selected ? "ring-2 ring-gray-900" : ""}`}>
                    <span className="block truncate px-0.5">{info?.booking ? info.booking.guest_name.slice(0, 3) : info?.row?.closed ? "닫힘" : price !== null ? man(price) : "–"}</span>
                    {info?.row?.price != null && !info.booking && !info.row.closed && <span className="block text-[10px] text-gray-500">지정</span>}
                  </button>
                </td>;
              })}
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
        {[["#FEF3C7", "신청·결제 진행 중"], ["#DCFCE7", "확정"], ["#E5E7EB", "닫힘"], ["#FFF7ED", "준성수기"], ["#FFF1F2", "극성수기"]].map(([color, label]) =>
          <span key={label} className="inline-flex items-center gap-1"><span aria-hidden="true" style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, border: "1px solid #9CA3AF", background: color }} />{label}</span>)}
        <span>숫자 = 그날의 1박 요금(만원) · ‘지정’ = 그날만 따로 넣은 요금</span>
      </p>
      <fieldset disabled={busy} className="grid sm:grid-cols-4 gap-3 items-end">
        <div className="text-sm">적용할 객실
          <div className="flex gap-4 mt-2">{ROOMS.map(room => <label key={room.key} className="flex items-center gap-2"><input type="checkbox" checked={targets.includes(room.key)} onChange={e => setTargets(list => (e.target.checked ? [...list, room.key] : list.filter(k => k !== room.key)))} />{room.name}</label>)}</div>
        </div>
        <label className="text-sm">시작일<input className={input} type="date" value={range.start} onChange={e => setRange(r => ({ ...r, start: e.target.value }))} /></label>
        <label className="text-sm">종료일 (포함)<input className={input} type="date" value={range.end} min={range.start} onChange={e => setRange(r => ({ ...r, end: e.target.value }))} /></label>
        <label className="text-sm">메모 <span className="text-gray-500">(선택 · 닫을 때 함께 저장)</span><input className={input} maxLength={80} value={dayNote} onChange={e => setDayNote(e.target.value)} placeholder="예: 타 플랫폼 예약" /></label>
      </fieldset>
      <div className="grid gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><b className="w-20">예약</b>
          <button type="button" disabled={!ready} className="bg-gray-900 text-white px-3 py-2 rounded disabled:opacity-40" onClick={() => days({ closed: true, note: dayNote }, "선택한 날짜를 닫았습니다.")}>예약 닫기</button>
          <button type="button" disabled={!ready} className={action} onClick={() => days({ closed: false }, "선택한 날짜를 다시 열었습니다.")}>다시 열기</button>
        </div>
        <div className="flex flex-wrap items-center gap-2"><b className="w-20">시즌</b>
          <button type="button" disabled={!ready} className={action} onClick={() => days({ season: "shoulder" }, "준성수기로 지정했습니다.")}>준성수기로 지정</button>
          <button type="button" disabled={!ready} className={action} onClick={() => days({ season: "peak" }, "극성수기로 지정했습니다.")}>극성수기로 지정</button>
          <button type="button" disabled={!ready} className={action} onClick={() => days({ season: "" }, "시즌 지정을 풀었습니다.")}>시즌 해제</button>
        </div>
        <div className="flex flex-wrap items-center gap-2"><b className="w-20">그날만의 요금</b>
          <input className="border p-2 rounded w-40" type="number" min={1} value={dayPrice} onChange={e => setDayPrice(e.target.value)} placeholder="1박 요금 (원)" aria-label="그날만의 1박 요금" />
          <button type="button" disabled={!ready || dayPrice === ""} className={action} onClick={() => days({ price: Number(dayPrice) }, "선택한 날짜의 요금을 지정했습니다.")}>이 요금으로 지정</button>
          <button type="button" disabled={!ready} className={action} onClick={() => days({ price: null }, "지정 요금을 지웠습니다. 요금표를 따릅니다.")}>지정 요금 지우기</button>
          <span className="text-gray-500">프로모션·공동구매 요금처럼 요금표와 다른 날에 씁니다.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2"><b className="w-20">초기화</b>
          <button type="button" disabled={!ready} className={action} onClick={() => days({ clear: true }, "선택한 날짜를 요금표 기본으로 되돌렸습니다.")}>닫기·시즌·지정 요금 모두 지우기</button>
        </div>
      </div>
    </section>

    <form className="border rounded-xl p-5 space-y-4" onSubmit={async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget, f = new FormData(form);
      if (await post({ action: "create", room: f.get("room"), checkIn: f.get("checkIn"), checkOut: f.get("checkOut"), guests: Number(f.get("guests")), guestName: f.get("guestName"), guestPhone: f.get("guestPhone"), memo: f.get("memo") }, "예약을 등록했습니다.")) form.reset();
    }}>
      <h2 className="font-bold text-lg">3. 예약 직접 등록</h2>
      <p className="text-sm text-gray-600">전화·다른 채널로 받은 예약을 넣으면 바로 확정으로 등록되고 그 객실의 날짜가 마감됩니다.</p>
      <fieldset disabled={busy} className="grid sm:grid-cols-4 gap-3">
        <label className="text-sm">객실<select className={input} name="room" defaultValue="two" required>{ROOMS.map(room => <option key={room.key} value={room.key}>{room.name} (최대 {config.rooms[room.key].guests}인)</option>)}</select></label>
        <label className="text-sm">입실일<input className={input} name="checkIn" type="date" required /></label>
        <label className="text-sm">퇴실일<input className={input} name="checkOut" type="date" required /></label>
        <label className="text-sm">인원<input className={input} name="guests" type="number" min={1} max={20} defaultValue={2} required /></label>
        <label className="text-sm">예약자 이름<input className={input} name="guestName" maxLength={40} required /></label>
        <label className="text-sm">휴대폰 번호 <span className="text-gray-500">(선택)</span><input className={input} name="guestPhone" inputMode="tel" placeholder="01012345678" /></label>
        <label className="text-sm sm:col-span-2">메모 <span className="text-gray-500">(선택)</span><input className={input} name="memo" maxLength={300} /></label>
      </fieldset>
      <button disabled={busy} className="bg-gray-900 text-white px-4 py-2 rounded">예약 등록</button>
    </form>

    <form className="border rounded-xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); void post({ action: "config", config }, "기본 설정을 저장했습니다. 손님 화면에 바로 반영됩니다."); }}>
      <h2 className="font-bold text-lg">4. 객실 요금표 · 기본 설정</h2>
      <p className="text-sm text-gray-600">요금표는 손님 화면의 ‘객실과 요금’과 달력에 그대로 표시됩니다. 요금 칸을 비우면 그 요일·시즌은 요금 없이 신청으로만 받습니다. 주소·시간처럼 비워 둔 항목은 ‘예약 확정 시 안내’로 표시됩니다.</p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={config.open} onChange={e => field("open", e.target.checked)} />예약 받기 <span className="font-normal text-sm text-gray-600">(끄면 두 객실 모두 예약을 받지 않습니다)</span></label>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead><tr><th className="p-2 text-left">객실</th><th className="p-2 text-left">예약 받기</th><th className="p-2 text-left">최대 인원</th>{RATES.map(rate => <th key={rate.key} className="p-2 text-left">{rate.label} (원)</th>)}</tr></thead>
            <tbody>
              {ROOMS.map(room => <tr key={room.key} className="border-t">
                <th className="p-2 text-left">{room.name}</th>
                <td className="p-2"><input type="checkbox" aria-label={`${room.name} 예약 받기`} checked={config.rooms[room.key].open} onChange={e => roomField(room.key, "open", e.target.checked)} /></td>
                <td className="p-2"><input className="border p-2 rounded w-20" type="number" min={1} max={20} aria-label={`${room.name} 최대 인원`} value={config.rooms[room.key].guests} onChange={e => roomField(room.key, "guests", Number(e.target.value))} /></td>
                {RATES.map(rate => <td key={rate.key} className="p-2"><input className="border p-2 rounded w-28" type="number" min={1} aria-label={`${room.name} ${rate.label} 요금`} value={config.rooms[room.key][rate.key] ?? ""} onChange={e => roomField(room.key, rate.key, e.target.value === "" ? null : Number(e.target.value))} placeholder="비움" /></td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600">준성수기·극성수기 요금은 위 ‘블럭표’에서 날짜를 그 시즌으로 지정한 날에 적용됩니다. 기준 인원이 곧 최대 인원이며 인원 추가는 받지 않습니다.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">체크인 시간<input className={input} type="time" value={config.checkInTime} onChange={e => field("checkInTime", e.target.value)} /></label>
          <label className="text-sm">체크아웃 시간<input className={input} type="time" value={config.checkOutTime} onChange={e => field("checkOutTime", e.target.value)} /></label>
          <label className="text-sm">신청·결제 알림 받을 휴대폰<input className={input} inputMode="tel" value={config.notifyPhone} onChange={e => field("notifyPhone", e.target.value)} placeholder="01012345678" /></label>
          <label className="text-sm">예약 준비일 <span className="text-gray-500">(0 = 당일 가능)</span><input className={input} type="number" min={0} max={60} value={config.minLeadDays} onChange={e => field("minLeadDays", Number(e.target.value))} /></label>
          <label className="text-sm">최대 숙박일<input className={input} type="number" min={1} max={30} value={config.maxNights} onChange={e => field("maxNights", Number(e.target.value))} /></label>
          <label className="text-sm">달력 공개 기간 (일)<input className={input} type="number" min={14} max={365} value={config.windowDays} onChange={e => field("windowDays", Number(e.target.value))} /></label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">주소 <span className="text-gray-500">(공개됩니다)</span><input className={input} maxLength={120} value={config.address} onChange={e => field("address", e.target.value)} placeholder="비우면 ‘상세 주소는 예약 확정 후 안내’" /></label>
          <label className="text-sm">지도 링크<input className={input} type="url" maxLength={300} value={config.mapUrl} onChange={e => field("mapUrl", e.target.value)} placeholder="https://naver.me/…" /></label>
          <label className="text-sm">오시는 길 한 줄<input className={input} maxLength={80} value={config.walkNote} onChange={e => field("walkNote", e.target.value)} placeholder="예: 홍대입구역 3번 출구에서 걸어서 8분" /></label>
          <label className="text-sm">주차 안내<input className={input} maxLength={80} value={config.parkingNote} onChange={e => field("parkingNote", e.target.value)} placeholder="예: 주차 불가 · 인근 공영주차장 이용" /></label>
        </div>
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={config.payOnline} onChange={e => field("payOnline", e.target.checked)} />카드 결제 받기 <span className="font-normal text-sm text-gray-600">(블랜드픽과 같은 토스 결제 · 결제 즉시 예약 확정)</span></label>
          <p className="text-sm text-gray-600">요금이 모두 정해진 일정만 카드로 결제받습니다. 아래 취소·환불 규정이 20자 이상 입력되어 있어야 결제가 열리고, 손님은 결제 전에 이 규정에 동의합니다. 동의한 내용은 예약마다 그대로 저장됩니다.</p>
          <label className="block text-sm">취소·환불 규정 <span className="text-gray-500">(손님 화면에 그대로 표시됩니다)</span>
            <textarea className={`${input} min-h-44`} maxLength={4000} value={config.refundTerms} onChange={e => field("refundTerms", e.target.value)} placeholder={"예: 이용일 7일 전까지 전액 환불\n예: 이용일 3~6일 전 50% 환불\n예: 이용일 2일 전부터 환불 불가"} /></label>
          <button type="button" className="border px-3 py-1.5 rounded text-sm bg-white" onClick={() => { if (!config.refundTerms.trim() || window.confirm("지금 적힌 규정을 지우고 단궁 예약의 환불 규정으로 바꿀까요? 불러온 뒤 LIMEN에 맞게 고쳐서 저장하세요.")) field("refundTerms", data.refundTemplate); }}>단궁 예약의 환불 규정 불러오기</button>
        </div>
        <label className="block text-sm">예약 영역 공지 한 줄<input className={input} maxLength={200} value={config.notice} onChange={e => field("notice", e.target.value)} /></label>
        <label className="block text-sm">이용 안내 <span className="text-gray-500">(한 줄에 하나씩 · 손님 화면 ‘머무는 동안 지켜 주세요’에 표시)</span><textarea className={`${input} min-h-28`} maxLength={2000} value={config.rules} onChange={e => field("rules", e.target.value)} placeholder={"예: 실내 전 구역 금연\n예: 밤 10시 이후에는 조용히"} /></label>
      </fieldset>
      <button disabled={busy} className="bg-gray-900 text-white px-4 py-2 rounded">기본 설정 저장</button>
    </form>

    <details className="border rounded-xl p-5">
      <summary className="font-bold cursor-pointer">최근 처리 기록 ({data.events.length})</summary>
      <ul className="mt-3 space-y-1 text-sm">
        {data.events.map(e => <li key={e.id} className="flex flex-wrap gap-x-3 border-t py-1.5"><span className="text-gray-500">{stamp(e.created_at)}</span><b>{EVENT[e.action] || e.action}</b>{e.code && <span>{e.code}</span>}{e.detail?.kind && <span className="text-gray-500">{e.detail.kind.startsWith("operator") ? "운영자에게" : "손님에게"}</span>}{e.detail?.note && <span className="text-gray-600">메모: {e.detail.note}</span>}{typeof e.detail?.amount === "number" && <span className="text-gray-600">{won(e.detail.amount)}</span>}{typeof e.detail?.refundAmount === "number" && <span className="text-gray-600">환불 {won(e.detail.refundAmount)}</span>}{e.detail?.reason && <span className="text-gray-600">사유: {e.detail.reason}</span>}</li>)}
      </ul>
    </details>
  </div>;
}
