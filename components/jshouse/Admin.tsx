"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

// JS하우스 예약 관리 — 예약 신청 확정/거절, 날짜 닫기·요금 지정, 직접 예약 등록, 기본 설정.
// 손님 화면(/hotel/jshouse)의 달력·요금·주소·입실 시간은 모두 여기서 넣은 값으로 바뀐다.

type Booking = {
  id: string; code: string; status: "requested" | "confirmed" | "declined" | "cancelled";
  check_in: string; check_out: string; guests: number; guest_name: string; guest_phone: string; memo: string;
  estimate: { total?: number | null }; admin_note: string; cancel_requested: boolean; created_at: string;
};
type DayRow = { day: string; closed: boolean; price: number | null; note: string };
type Config = {
  open: boolean; minLeadDays: number; maxNights: number; windowDays: number; maxGuests: number;
  weekdayPrice: number | null; weekendPrice: number | null; checkInTime: string; checkOutTime: string;
  address: string; walkNote: string; parkingNote: string; mapUrl: string; notice: string; rules: string; notifyPhone: string;
};
type Data = { today: string; config: Config; days: DayRow[]; bookings: Booking[]; events: { id: number; action: string; detail: { kind?: string; note?: string }; created_at: string; code: string | null }[]; smsConfigured: boolean };

const STATUS: Record<Booking["status"], string> = { requested: "확인 대기", confirmed: "예약 확정", declined: "거절", cancelled: "취소" };
const TONE: Record<Booking["status"], string> = { requested: "bg-amber-100 text-amber-900", confirmed: "bg-green-100 text-green-900", declined: "bg-gray-100 text-gray-600", cancelled: "bg-gray-100 text-gray-600" };
const EVENT: Record<string, string> = {
  requested: "예약 신청 접수", confirmed: "예약 확정", declined: "예약 거절", cancelled: "예약 취소", guest_cancelled: "손님이 신청 취소", guest_cancel_requested: "손님이 취소 요청",
  admin_created: "직접 예약 등록", settings_changed: "기본 설정 변경", days_changed: "날짜 설정 변경", days_cleared: "날짜 설정 초기화", sms_sent: "문자 발송", sms_failed: "문자 발송 실패",
};
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const won = (n: unknown) => `${Number(n || 0).toLocaleString("ko-KR")}원`;
const DAY = 86400000;
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);
const nightsOf = (b: Booking) => Math.round((Date.parse(b.check_out) - Date.parse(b.check_in)) / DAY);
const stamp = (value: string) => new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const input = "block w-full border p-2 mt-1 rounded";

export default function JsHouseAdmin() {
  const [data, setData] = useState<Data | null>(null), [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"requested" | "confirmed" | "all">("requested"), [notify, setNotify] = useState(true);
  const [month, setMonth] = useState(0), [range, setRange] = useState({ start: "", end: "" }), [dayPrice, setDayPrice] = useState(""), [dayNote, setDayNote] = useState("");

  const load = useCallback(() => fetch("/api/admin/jshouse", { cache: "no-store" }).then(async response => {
    const body = await response.json();
    if (!response.ok) throw Error(body.error || "불러오지 못했습니다.");
    setData(body); setConfig(body.config);
  }), []);
  useEffect(() => { load().catch(e => setError((e as Error).message)); }, [load]);

  async function post(body: object, done = "저장했습니다.") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/jshouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    if (decision === "confirm" && !window.confirm(`${b.guest_name}님 ${b.check_in} ~ ${b.check_out} 예약을 확정할까요?${notify && data?.smsConfigured ? "\n손님에게 확정 문자가 발송됩니다." : ""}`)) return;
    void post({ action: "decide", id: b.id, decision, note, notify }, `${b.guest_name}님 예약을 ${label}했습니다.`);
  }
  const field = <K extends keyof Config>(key: K, value: Config[K]) => setConfig(c => (c ? { ...c, [key]: value } : c));
  const numberField = (key: "weekdayPrice" | "weekendPrice", raw: string) => field(key, raw === "" ? null : Number(raw));

  // 날짜 → 상태 (달력 색칠용)
  const dayInfo = useMemo(() => {
    const map = new Map<string, { booking?: Booking; row?: DayRow }>();
    for (const row of data?.days ?? []) map.set(row.day, { row });
    for (const b of data?.bookings ?? []) {
      if (b.status !== "requested" && b.status !== "confirmed") continue;
      for (let day = b.check_in; day < b.check_out; day = addDays(day, 1)) map.set(day, { ...map.get(day), booking: b });
    }
    return map;
  }, [data]);
  function pickDay(day: string) {
    setRange(r => (!r.start || (r.start && r.end) ? { start: day, end: "" } : day < r.start ? { start: day, end: r.start } : { start: r.start, end: day }));
  }
  const rangeEnd = range.end || range.start;

  if (!data || !config) return <div className="commerce-reservation-workspace max-w-6xl mx-auto space-y-6"><h1 className="text-2xl font-bold">JS하우스 예약</h1>{error ? <p role="alert" className="p-3 bg-red-50 text-red-800">{error}</p> : <p className="text-sm text-gray-600">불러오는 중…</p>}</div>;

  const waiting = data.bookings.filter(b => b.status === "requested"), upcoming = data.bookings.filter(b => b.status === "confirmed" && b.check_out >= data.today);
  const cancelAsks = data.bookings.filter(b => b.status === "confirmed" && b.cancel_requested);
  const shown = data.bookings.filter(b => filter === "all" || b.status === filter);
  const base = new Date(`${data.today.slice(0, 7)}-01T00:00:00Z`); base.setUTCMonth(base.getUTCMonth() + month);
  const months = [0, 1].map(offset => { const d = new Date(base); d.setUTCMonth(d.getUTCMonth() + offset); return d; });

  return <div className="commerce-reservation-workspace max-w-6xl mx-auto space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold">JS하우스 예약</h1><p className="text-sm text-gray-600 mt-1">연남동 JS하우스의 예약 신청, 날짜, 요금, 안내 문구를 관리합니다. 단궁·유탑 예약과 따로 집계됩니다.</p></div>
      <a className="text-sm underline" href="/hotel/jshouse" target="_blank" rel="noopener noreferrer">손님 화면 열기 ↗</a>
    </div>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-800">{error}</p>}
    {notice && <p role="status" className="p-3 bg-green-50 text-green-900">{notice}</p>}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[["확인 대기", `${waiting.length}건`], ["다가오는 확정 예약", `${upcoming.length}건`], ["예약 신청 받기", config.open ? "받는 중" : "중지"], ["문자 발송", data.smsConfigured ? "설정됨" : "설정 필요"]].map(([k, v]) => <div key={k} className="border rounded-xl p-4"><p className="text-sm">{k}</p><b>{v}</b></div>)}
    </div>
    {cancelAsks.length > 0 && <p className="p-3 bg-amber-50 text-amber-900 text-sm">확정 예약 {cancelAsks.length}건에 손님의 취소 요청이 있습니다. 아래 목록에서 ‘취소 요청’ 표시를 확인해 주세요.</p>}

    <section className="border rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-lg">1. 예약 신청 관리</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {([["requested", `확인 대기 ${waiting.length}`], ["confirmed", "확정"], ["all", "전체"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-full border ${filter === key ? "bg-gray-900 text-white border-gray-900" : ""}`}>{label}</button>)}
          <button type="button" disabled={busy} onClick={() => load().catch(e => setError((e as Error).message))}>새로고침 ↻</button>
        </div>
      </div>
      <p className="text-sm text-gray-600 my-2">신청이 들어오면 그 날짜는 바로 마감으로 표시됩니다. 확정하면 유지되고, 거절·취소하면 날짜가 다시 열립니다. 결제는 온라인으로 받지 않으므로 확정 후 손님에게 따로 안내해 주세요.</p>
      <label className="flex items-center gap-2 text-sm my-3"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />처리 결과를 손님에게 문자로 알리기{!data.smsConfigured && <span className="text-gray-500">(문자 설정이 없어 발송되지 않습니다)</span>}</label>
      <div className="overflow-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead><tr>{["예약번호", "입실 → 퇴실", "예약자", "인원", "예상 요금", "상태", "처리"].map(t => <th className="p-2 text-left" key={t}>{t}</th>)}</tr></thead>
          <tbody>
            {shown.map(b => <tr className="border-t align-top" key={b.id}>
              <td className="p-2"><b>{b.code}</b><br /><span className="text-gray-500">{stamp(b.created_at)} 신청</span></td>
              <td className="p-2">{b.check_in} → {b.check_out}<br /><span className="text-gray-500">{nightsOf(b)}박</span></td>
              <td className="p-2">{b.guest_name}<br />{b.guest_phone ? <a className="underline" href={`tel:${b.guest_phone}`}>{b.guest_phone}</a> : <span className="text-gray-500">연락처 없음</span>}
                {b.memo && <p className="max-w-xs whitespace-pre-wrap text-gray-600 mt-1">요청: {b.memo}</p>}
                {b.admin_note && <p className="max-w-xs whitespace-pre-wrap text-gray-500 mt-1">메모: {b.admin_note}</p>}</td>
              <td className="p-2">{b.guests}명</td>
              <td className="p-2">{typeof b.estimate?.total === "number" ? won(b.estimate.total) : "요금 미설정"}</td>
              <td className="p-2"><span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${TONE[b.status]}`}>{STATUS[b.status]}</span>{b.cancel_requested && <span className="block mt-1 text-xs font-bold text-red-700">취소 요청</span>}</td>
              <td className="p-2 space-x-2">
                {b.status === "requested" && <><button type="button" disabled={busy} className="bg-green-800 text-white px-3 py-1.5 rounded" onClick={() => decide(b, "confirm")}>확정</button><button type="button" disabled={busy} className="border px-3 py-1.5 rounded" onClick={() => decide(b, "decline")}>거절</button></>}
                {b.status === "confirmed" && <button type="button" disabled={busy} className="border border-red-300 text-red-800 px-3 py-1.5 rounded" onClick={() => decide(b, "cancel")}>예약 취소</button>}
              </td>
            </tr>)}
          </tbody>
        </table>
        {!shown.length && <p className="py-6 text-center text-gray-500">{filter === "requested" ? "확인을 기다리는 신청이 없습니다." : "해당하는 예약이 없습니다."}</p>}
      </div>
    </section>

    <section className="border rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-lg">2. 달력 · 날짜별 설정</h2>
        <div className="flex gap-2 text-sm"><button type="button" className="border px-3 py-1.5 rounded" disabled={month === 0} onClick={() => setMonth(m => m - 1)}>← 이전 달</button><button type="button" className="border px-3 py-1.5 rounded" disabled={month >= 11} onClick={() => setMonth(m => m + 1)}>다음 달 →</button></div></div>
      <p className="text-sm text-gray-600">날짜를 눌러 시작일과 종료일을 고른 뒤 아래에서 닫거나 요금을 지정하세요. 다른 곳(전화·타 플랫폼)에서 예약이 잡힌 날은 닫아 두면 손님 달력에 마감으로 보입니다.</p>
      <div className="grid md:grid-cols-2 gap-6">
        {months.map(m => {
          const year = m.getUTCFullYear(), mo = m.getUTCMonth(), ym = `${year}-${String(mo + 1).padStart(2, "0")}`;
          const count = new Date(Date.UTC(year, mo + 1, 0)).getUTCDate();
          return <div key={ym}>
            <h3 className="font-bold mb-2">{year}년 {mo + 1}월</h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {WEEK.map(w => <span key={w} className="text-gray-500 py-1">{w}</span>)}
              {Array.from({ length: m.getUTCDay() }, (_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: count }, (_, i) => {
                const day = `${ym}-${String(i + 1).padStart(2, "0")}`, info = dayInfo.get(day), past = day < data.today;
                const selected = !!range.start && day >= range.start && day <= rangeEnd;
                const tone = info?.booking ? (info.booking.status === "confirmed" ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900") : info?.row?.closed ? "bg-gray-200 text-gray-500 line-through" : past ? "text-gray-300" : "bg-white";
                return <button key={day} type="button" onClick={() => pickDay(day)} title={info?.booking ? `${info.booking.guest_name} (${STATUS[info.booking.status]})` : info?.row?.note || ""}
                  className={`border rounded p-1 min-h-[52px] flex flex-col items-center justify-start ${tone} ${selected ? "ring-2 ring-gray-900" : ""}`}>
                  <b>{i + 1}</b>
                  <span className="truncate w-full">{info?.booking ? info.booking.guest_name : info?.row?.closed ? "닫힘" : info?.row?.price ? `${Math.round(info.row.price / 1000) / 10}만` : ""}</span>
                </button>;
              })}
            </div>
          </div>;
        })}
      </div>
      <p className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1"><span><i className="inline-block w-3 h-3 rounded bg-amber-100 border mr-1 align-middle" />확인 대기</span><span><i className="inline-block w-3 h-3 rounded bg-green-100 border mr-1 align-middle" />확정</span><span><i className="inline-block w-3 h-3 rounded bg-gray-200 border mr-1 align-middle" />닫힘</span><span>숫자(만) = 그날만의 요금</span></p>
      <fieldset disabled={busy} className="grid sm:grid-cols-4 gap-3 items-end">
        <label className="text-sm">시작일<input className={input} type="date" value={range.start} onChange={e => setRange(r => ({ ...r, start: e.target.value }))} /></label>
        <label className="text-sm">종료일 (포함)<input className={input} type="date" value={range.end} min={range.start} onChange={e => setRange(r => ({ ...r, end: e.target.value }))} /></label>
        <label className="text-sm">그날만의 1박 요금 <span className="text-gray-500">(선택)</span><input className={input} type="number" min={1} step={1000} value={dayPrice} onChange={e => setDayPrice(e.target.value)} placeholder="비우면 기본 요금" /></label>
        <label className="text-sm">메모 <span className="text-gray-500">(선택)</span><input className={input} maxLength={80} value={dayNote} onChange={e => setDayNote(e.target.value)} placeholder="예: 타 플랫폼 예약" /></label>
      </fieldset>
      <div className="flex flex-wrap gap-2 text-sm">
        <button type="button" disabled={busy || !range.start} className="bg-gray-900 text-white px-4 py-2 rounded" onClick={() => void post({ action: "days", start: range.start, end: rangeEnd, closed: true, price: dayPrice === "" ? null : Number(dayPrice), note: dayNote }, "선택한 날짜를 닫았습니다.")}>예약 닫기</button>
        <button type="button" disabled={busy || !range.start || dayPrice === ""} className="border px-4 py-2 rounded" onClick={() => void post({ action: "days", start: range.start, end: rangeEnd, closed: false, price: Number(dayPrice), note: dayNote }, "선택한 날짜의 요금을 지정했습니다.")}>이 요금으로 열어 두기</button>
        <button type="button" disabled={busy || !range.start} className="border px-4 py-2 rounded" onClick={() => void post({ action: "days", start: range.start, end: rangeEnd, clear: true }, "선택한 날짜를 기본 설정으로 되돌렸습니다.")}>기본 설정으로 되돌리기</button>
      </div>
    </section>

    <form className="border rounded-xl p-5 space-y-4" onSubmit={async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget, f = new FormData(form);
      if (await post({ action: "create", checkIn: f.get("checkIn"), checkOut: f.get("checkOut"), guests: Number(f.get("guests")), guestName: f.get("guestName"), guestPhone: f.get("guestPhone"), memo: f.get("memo") }, "예약을 등록했습니다.")) form.reset();
    }}>
      <h2 className="font-bold text-lg">3. 예약 직접 등록</h2>
      <p className="text-sm text-gray-600">전화나 다른 경로로 받은 예약을 넣으면 바로 확정으로 저장되고 그 날짜가 마감됩니다. 손님에게 문자는 보내지 않습니다.</p>
      <fieldset disabled={busy} className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm">입실일<input className={input} name="checkIn" type="date" required /></label>
        <label className="text-sm">퇴실일<input className={input} name="checkOut" type="date" required /></label>
        <label className="text-sm">인원<input className={input} name="guests" type="number" min={1} max={20} defaultValue={2} required /></label>
        <label className="text-sm">예약자 이름<input className={input} name="guestName" maxLength={40} required /></label>
        <label className="text-sm">휴대폰 번호 <span className="text-gray-500">(선택)</span><input className={input} name="guestPhone" inputMode="tel" placeholder="01012345678" /></label>
        <label className="text-sm">메모 <span className="text-gray-500">(선택)</span><input className={input} name="memo" maxLength={300} /></label>
      </fieldset>
      <button disabled={busy} className="bg-gray-900 text-white px-4 py-2 rounded">예약 등록</button>
    </form>

    <form className="border rounded-xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); void post({ action: "config", config }, "기본 설정을 저장했습니다. 손님 화면에 바로 반영됩니다."); }}>
      <h2 className="font-bold text-lg">4. 기본 설정</h2>
      <p className="text-sm text-gray-600">비워 둔 항목은 손님 화면에서 ‘예약 확정 시 안내’로 표시됩니다. 요금을 넣으면 달력 칸과 예상 금액에 나타납니다.</p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={config.open} onChange={e => field("open", e.target.checked)} />예약 신청 받기</label>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">일~목 1박 요금 (원)<input className={input} type="number" min={1} step={1000} value={config.weekdayPrice ?? ""} onChange={e => numberField("weekdayPrice", e.target.value)} placeholder="비우면 요금 미표시" /></label>
          <label className="text-sm">금·토 1박 요금 (원)<input className={input} type="number" min={1} step={1000} value={config.weekendPrice ?? ""} onChange={e => numberField("weekendPrice", e.target.value)} placeholder="비우면 주중과 동일" /></label>
          <label className="text-sm">최대 인원<input className={input} type="number" min={1} max={20} value={config.maxGuests} onChange={e => field("maxGuests", Number(e.target.value))} /></label>
          <label className="text-sm">체크인 시간<input className={input} type="time" value={config.checkInTime} onChange={e => field("checkInTime", e.target.value)} /></label>
          <label className="text-sm">체크아웃 시간<input className={input} type="time" value={config.checkOutTime} onChange={e => field("checkOutTime", e.target.value)} /></label>
          <label className="text-sm">새 신청 알림 받을 휴대폰<input className={input} inputMode="tel" value={config.notifyPhone} onChange={e => field("notifyPhone", e.target.value)} placeholder="01012345678" /></label>
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
        <label className="block text-sm">예약 영역 공지 한 줄<input className={input} maxLength={200} value={config.notice} onChange={e => field("notice", e.target.value)} /></label>
        <label className="block text-sm">이용 안내 <span className="text-gray-500">(한 줄에 하나씩 · 손님 화면 ‘머무는 동안 지켜 주세요’에 표시)</span><textarea className={`${input} min-h-28`} maxLength={2000} value={config.rules} onChange={e => field("rules", e.target.value)} placeholder={"예: 실내 전 구역 금연\n예: 밤 10시 이후에는 조용히"} /></label>
      </fieldset>
      <button disabled={busy} className="bg-gray-900 text-white px-4 py-2 rounded">기본 설정 저장</button>
    </form>

    <details className="border rounded-xl p-5">
      <summary className="font-bold cursor-pointer">최근 처리 기록 ({data.events.length})</summary>
      <ul className="mt-3 space-y-1 text-sm">
        {data.events.map(e => <li key={e.id} className="flex flex-wrap gap-x-3 border-t py-1.5"><span className="text-gray-500">{stamp(e.created_at)}</span><b>{EVENT[e.action] || e.action}</b>{e.code && <span>{e.code}</span>}{e.detail?.kind && <span className="text-gray-500">{e.detail.kind.startsWith("operator") ? "운영자에게" : "손님에게"}</span>}{e.detail?.note && <span className="text-gray-600">메모: {e.detail.note}</span>}</li>)}
      </ul>
    </details>
  </div>;
}
