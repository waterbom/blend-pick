"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { fbqTrack } from "@/lib/analytics";
import { useMetaEvent } from "@/lib/use-meta-event";
import type { StayConfig } from "@/components/jshouse/content";

// JS하우스 달력 예약 — 날짜 선택 → 인원 → 예약 신청(이름·휴대폰) → 접수 완료.
// 히어로의 빠른 예약 바, 본문 달력, 모바일 하단 바가 같은 선택 상태를 함께 쓴다 (StayProvider).
// 요금은 관리자에서 1박 요금을 넣었을 때만 달력 칸과 합계에 표시된다.

const DAY = 86400000;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);
const weekdayOf = (day: string) => new Date(day + "T00:00:00Z").getUTCDay();
const shortDate = (day: string) => `${Number(day.slice(5, 7))}.${Number(day.slice(8, 10))} (${WEEK[weekdayOf(day)]})`;
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
// 달력 칸용 짧은 요금 — 180,000 → 18만, 185,000 → 18.5만
const manwon = (n: number) => `${(Math.round(n / 1000) / 10).toLocaleString("ko-KR")}만`;

export type StayBooking = {
  code: string; status: "requested" | "confirmed" | "declined" | "cancelled";
  checkIn: string; checkOut: string; nights: number; guests: number; guestName: string;
  estimate: { nightly?: { day: string; price: number | null }[]; total?: number | null };
  cancelRequested: boolean; createdAt: string;
};
type Calendar = {
  today: string; lastDay: string; config: StayConfig;
  closed: string[]; prices: Record<string, number>; taken: string[];
  mine: StayBooking[]; phoneVerify: boolean;
};
const STATUS: Record<StayBooking["status"], string> = { requested: "일정 확인 중", confirmed: "예약 확정", declined: "예약 불가", cancelled: "취소됨" };

async function api(input: object): Promise<StayBooking> {
  const response = await fetch("/api/jshouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
  return data;
}

type Stay = {
  calendar: Calendar | null; config: StayConfig; loadError: string; refresh: () => Promise<void>;
  checkIn: string; checkOut: string; guests: number; nights: number; hint: string;
  setGuests: (n: number) => void; choose: (day: string) => void; reset: () => void;
  selectable: (day: string) => boolean; canCheckout: (day: string) => boolean; priceOf: (day: string) => number | null;
  quote: { nightly: { day: string; price: number | null }[]; total: number | null } | null;
  fromPrice: number | null; dialogOpen: boolean; setDialogOpen: (open: boolean) => void;
};
const StayContext = createContext<Stay | null>(null);
export function useStay() {
  const value = useContext(StayContext);
  if (!value) throw Error("StayProvider is required");
  return value;
}

export function StayProvider({ initialConfig, children }: { initialConfig: StayConfig; children: ReactNode }) {
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [loadError, setLoadError] = useState("");
  const [checkIn, setIn] = useState(""), [checkOut, setOut] = useState(""), [guestCount, setGuestCount] = useState(2), [hint, setHint] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const serial = useRef(0), picked = useRef({ checkIn: "", checkOut: "" });
  // 가장 마지막에 보낸 요청의 응답만 화면에 반영한다 (serial)
  const refresh = useCallback((): Promise<void> => {
    const current = ++serial.current;
    return fetch("/api/jshouse", { cache: "no-store" }).then(async response => {
      const data: Calendar = await response.json();
      if (!response.ok) throw Error("load failed");
      if (current !== serial.current) return;
      setCalendar(data); setLoadError("");
      // 새 달력에서 고른 날짜가 막혔으면(다른 예약이 먼저 잡힘) 선택을 비운다
      const { checkIn: start, checkOut: end } = picked.current;
      if (start) {
        const blocked = new Set([...data.closed, ...data.taken]), first = addDays(data.today, data.config.minLeadDays);
        const count = (Date.parse(end || addDays(start, 1)) - Date.parse(start)) / DAY;
        const free = data.config.open && Array.from({ length: count }, (_, i) => addDays(start, i)).every(day => day >= first && day < data.lastDay && !blocked.has(day));
        if (!free) { setIn(""); setOut(""); setHint("고르신 날짜가 방금 마감됐어요. 다시 골라 주세요."); }
      }
    }).catch(() => {
      if (current === serial.current) setLoadError("예약 달력을 불러오지 못했어요.");
    });
  }, []);
  useEffect(() => { picked.current = { checkIn, checkOut }; }, [checkIn, checkOut]);
  useEffect(() => {
    const counter = serial;
    void refresh();
    // 다른 사람이 먼저 잡은 날짜가 오래 열려 보이지 않게, 화면으로 돌아올 때 다시 확인
    const onFocus = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => { counter.current++; document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh]);
  useMetaEvent("ViewContent", "hotel-jshouse", { content_type: "product", content_ids: ["hotel-jshouse"] });

  const config = calendar?.config ?? initialConfig;
  const guests = Math.min(guestCount, config.maxGuests);
  const sets = useMemo(() => ({ closed: new Set(calendar?.closed), taken: new Set(calendar?.taken) }), [calendar]);
  const first = calendar ? addDays(calendar.today, config.minLeadDays) : "";
  const selectable = useCallback((day: string) =>
    !!calendar && config.open && day >= first && day < calendar.lastDay && !sets.closed.has(day) && !sets.taken.has(day),
  [calendar, config.open, first, sets]);
  // 퇴실일은 그날 밤을 쓰지 않으므로, 다른 예약의 입실일이어도 고를 수 있다
  const canCheckout = useCallback((day: string) => {
    if (!checkIn || !calendar || day <= checkIn || day > calendar.lastDay) return false;
    const count = (Date.parse(day) - Date.parse(checkIn)) / DAY;
    return count <= config.maxNights && Array.from({ length: count }, (_, i) => addDays(checkIn, i)).every(selectable);
  }, [calendar, checkIn, config.maxNights, selectable]);
  const priceOf = useCallback((day: string) => {
    const override = calendar?.prices[day];
    if (override !== undefined) return override;
    if (config.weekdayPrice === null) return null;
    return [5, 6].includes(weekdayOf(day)) ? (config.weekendPrice ?? config.weekdayPrice) : config.weekdayPrice;
  }, [calendar, config.weekdayPrice, config.weekendPrice]);

  const choose = useCallback((day: string) => {
    setHint("");
    if (checkIn && !checkOut && day > checkIn) {
      if (canCheckout(day)) { setOut(day); return; }
      if (!selectable(day)) { setHint((Date.parse(day) - Date.parse(checkIn)) / DAY > config.maxNights ? `한 번에 최대 ${config.maxNights}박까지 신청할 수 있어요.` : "사이에 마감된 날짜가 있어요. 다른 날짜를 골라 주세요."); return; }
    }
    if (!selectable(day)) return;
    // 마감일을 건너뛴 날짜를 누르면 그날부터 체크인을 새로 잡는다
    if (checkIn && !checkOut && day > checkIn) setHint("사이에 마감된 날짜가 있어 체크인을 다시 잡았어요. 체크아웃을 골라 주세요.");
    setIn(day); setOut("");
  }, [checkIn, checkOut, canCheckout, selectable, config.maxNights]);
  const reset = useCallback(() => { setIn(""); setOut(""); setHint(""); }, []);
  const setGuests = useCallback((n: number) => setGuestCount(Math.max(1, Math.min(config.maxGuests, n))), [config.maxGuests]);

  const nights = checkIn && checkOut ? (Date.parse(checkOut) - Date.parse(checkIn)) / DAY : 0;
  const quote = useMemo(() => {
    if (!nights) return null;
    const nightly = Array.from({ length: nights }, (_, i) => { const day = addDays(checkIn, i); return { day, price: priceOf(day) }; });
    return { nightly, total: nightly.every(n => n.price !== null) ? nightly.reduce((sum, n) => sum + (n.price as number), 0) : null };
  }, [nights, checkIn, priceOf]);
  const fromPrice = useMemo(() => {
    if (!calendar || config.weekdayPrice === null) return null;
    const prices: number[] = [];
    for (let day = first; day < calendar.lastDay; day = addDays(day, 1)) { if (selectable(day)) { const p = priceOf(day); if (p !== null) prices.push(p); } }
    return prices.length ? Math.min(...prices) : null;
  }, [calendar, config.weekdayPrice, first, selectable, priceOf]);

  const value: Stay = { calendar, config, loadError, refresh, checkIn, checkOut, guests, nights, hint, setGuests, choose, reset, selectable, canCheckout, priceOf, quote, fromPrice, dialogOpen, setDialogOpen };
  return <StayContext.Provider value={value}>{children}</StayContext.Provider>;
}

const goReserve = () => document.getElementById("reserve")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

// 히어로 안의 빠른 예약 바
export function QuickBar() {
  const { checkIn, checkOut, guests, nights, fromPrice, config } = useStay();
  return <button type="button" className="jsh-quick" onClick={goReserve} aria-label="예약 달력으로 이동">
    <span><small>체크인</small><b key={checkIn} className="jsh-flip">{checkIn ? shortDate(checkIn) : "날짜 선택"}</b></span>
    <i aria-hidden="true" />
    <span><small>체크아웃</small><b key={checkOut} className="jsh-flip">{checkOut ? shortDate(checkOut) : "날짜 선택"}</b></span>
    <i aria-hidden="true" />
    <span><small>인원</small><b>{guests}명</b></span>
    <strong>{nights ? `${nights}박 신청` : config.open ? "날짜 보기" : "달력 보기"}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></strong>
    {fromPrice !== null && <em>1박 {won(fromPrice)}부터</em>}
  </button>;
}

// 숫자가 바뀔 때 부드럽게 따라가는 금액
function Tween({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 420;
    const start = performance.now(), begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(begin + (value - begin) * eased);
      from.current = next; setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{won(shown)}</>;
}

function Month({ ym, hover, onHover }: { ym: string; hover: string; onHover: (day: string) => void }) {
  const { calendar, checkIn, checkOut, choose, selectable, canCheckout, priceOf } = useStay();
  const year = Number(ym.slice(0, 4)), month = Number(ym.slice(5, 7));
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate(), leading = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const picking = !!checkIn && !checkOut;
  const previewEnd = picking && hover > checkIn && canCheckout(hover) ? hover : "";
  return <div className="jsh-month">
    <h4>{year}. {String(month).padStart(2, "0")}<span>{month}월</span></h4>
    <div className="jsh-week" aria-hidden="true">{WEEK.map((d, i) => <span key={d} data-weekend={i === 5 || i === 6 || undefined}>{d}</span>)}</div>
    <div className="jsh-days" role="group" aria-label={`${year}년 ${month}월`}>
      {Array.from({ length: leading }, (_, i) => <span key={`e${i}`} aria-hidden="true" />)}
      {Array.from({ length: count }, (_, i) => {
        const day = `${ym}-${String(i + 1).padStart(2, "0")}`;
        const open = selectable(day), out = picking && day > checkIn && canCheckout(day);
        const start = day === checkIn, end = day === checkOut;
        const inside = !!checkIn && !!checkOut && day > checkIn && day < checkOut;
        const preview = !!previewEnd && day > checkIn && day <= previewEnd;
        const past = !!calendar && day < calendar.today, taken = !!calendar?.taken.includes(day) || !!calendar?.closed.includes(day);
        const price = open ? priceOf(day) : null;
        const state = start ? "start" : end ? "end" : inside ? "inside" : open ? "open" : out ? "out" : past ? "past" : "off";
        const label = `${month}월 ${i + 1}일 ${WEEK[weekdayOf(day)]}요일${start ? ", 체크인" : end ? ", 체크아웃" : ""}${open ? (price !== null ? `, 1박 ${won(price)}` : ", 예약 가능") : out ? ", 체크아웃 가능" : past ? ", 지난 날짜" : ", 예약 마감"}`;
        return <button key={day} type="button" className="jsh-day" data-state={state} data-preview={preview || undefined} data-today={day === calendar?.today || undefined}
          data-weekend={[5, 6].includes(weekdayOf(day)) || undefined} disabled={!calendar || (!open && !out)} aria-pressed={start || end || inside} aria-label={label}
          onClick={() => choose(day)} onMouseEnter={() => onHover(day)} onFocus={() => onHover(day)}>
          <b>{i + 1}</b>
          <small>{start ? "체크인" : end ? "체크아웃" : open ? (price !== null ? manwon(price) : "") : out ? "퇴실" : !past && taken ? "마감" : ""}</small>
        </button>;
      })}
    </div>
  </div>;
}

function CalendarCard() {
  const { calendar, config, loadError, refresh, checkIn, checkOut, nights, hint, reset } = useStay();
  const [index, setIndex] = useState(0), [direction, setDirection] = useState(1), [hover, setHover] = useState("");
  const months = useMemo(() => {
    if (!calendar) return [] as string[];
    const list: string[] = [], last = calendar.lastDay.slice(0, 7);
    for (let ym = calendar.today.slice(0, 7); ym <= last;) {
      list.push(ym);
      const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
      ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    }
    return list;
  }, [calendar]);
  const move = (delta: number) => { setDirection(delta); setIndex(i => Math.max(0, Math.min(months.length - 1, i + delta))); };
  const touch = useRef<{ x: number; y: number } | null>(null);
  const status = !calendar ? (loadError || "달력을 불러오는 중이에요…")
    : !config.open ? "지금은 예약 신청을 받지 않고 있어요."
    : hint ? hint
    : nights ? `${nights}박 ${nights + 1}일 · ${shortDate(checkIn)} → ${shortDate(checkOut)}`
    : checkIn ? `${shortDate(checkIn)} 체크인 · 이제 체크아웃 날짜를 골라 주세요`
    : "체크인 날짜를 먼저 골라 주세요";
  return <div className="jsh-cal" data-picking={(!!checkIn && !checkOut) || undefined}>
    <div className="jsh-cal-top">
      <p className="jsh-cal-status" role="status" aria-live="polite" data-tone={hint ? "warn" : nights ? "done" : undefined}><i aria-hidden="true" />{status}{loadError && !calendar && <button type="button" onClick={() => void refresh()}>다시 불러오기</button>}</p>
      <div className="jsh-cal-nav">
        <button type="button" aria-label="이전 달" disabled={index === 0} onClick={() => move(-1)}>←</button>
        <button type="button" aria-label="다음 달" disabled={index >= months.length - 1} onClick={() => move(1)}>→</button>
      </div>
    </div>
    <div className="jsh-months" key={index} data-dir={direction > 0 ? "next" : "prev"} onMouseLeave={() => setHover("")}
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={e => {
        const from = touch.current; touch.current = null;
        if (!from) return;
        const dx = e.changedTouches[0].clientX - from.x, dy = e.changedTouches[0].clientY - from.y;
        if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) move(dx < 0 ? 1 : -1);
      }}>
      {months.length ? <>
        <Month ym={months[index]} hover={hover} onHover={setHover} />
        {months[index + 1] && <div className="jsh-month-second"><Month ym={months[index + 1]} hover={hover} onHover={setHover} /></div>}
      </> : <div className="jsh-cal-skeleton" aria-hidden="true">{Array.from({ length: 35 }, (_, i) => <span key={i} style={{ ["--i" as string]: i }} />)}</div>}
    </div>
    <div className="jsh-cal-foot">
      <ul className="jsh-legend" aria-label="달력 표시 안내"><li data-k="open">예약 가능</li><li data-k="pick">선택</li><li data-k="off">마감</li></ul>
      <button type="button" className="jsh-reset" disabled={!checkIn} onClick={reset}>다시 고르기 ↺</button>
    </div>
  </div>;
}

function Summary() {
  const { calendar, config, checkIn, checkOut, guests, setGuests, nights, quote, fromPrice, setDialogOpen } = useStay();
  const ready = !!nights && !!calendar && config.open;
  return <aside className="jsh-summary" aria-label="예약 요약">
    <div className="jsh-summary-head">
      <span>YOUR STAY</span>
      {fromPrice !== null ? <strong>{won(fromPrice)}<small> 부터 / 1박</small></strong> : <strong className="jsh-summary-soft">요금은 일정 확인 후 안내</strong>}
    </div>
    <div className="jsh-dates">
      <div data-on={!!checkIn || undefined}><small>체크인{config.checkInTime && <i>{config.checkInTime}</i>}</small><b key={checkIn} className="jsh-flip">{checkIn ? shortDate(checkIn) : "날짜 선택"}</b></div>
      <span aria-hidden="true">{nights ? `${nights}박` : "→"}</span>
      <div data-on={!!checkOut || undefined}><small>체크아웃{config.checkOutTime && <i>{config.checkOutTime}</i>}</small><b key={checkOut} className="jsh-flip">{checkOut ? shortDate(checkOut) : "날짜 선택"}</b></div>
    </div>
    <div className="jsh-stepper">
      <span>인원<small>최대 {config.maxGuests}명</small></span>
      <div>
        <button type="button" aria-label="인원 줄이기" disabled={guests <= 1} onClick={() => setGuests(guests - 1)}>−</button>
        <output aria-live="polite" key={guests} className="jsh-flip">{guests}</output>
        <button type="button" aria-label="인원 늘리기" disabled={guests >= config.maxGuests} onClick={() => setGuests(guests + 1)}>+</button>
      </div>
    </div>
    {quote && <div className="jsh-price" aria-live="polite">
      {quote.total !== null ? <>
        <ul>{quote.nightly.slice(0, 4).map(n => <li key={n.day}><span>{shortDate(n.day)}</span><span>{won(n.price as number)}</span></li>)}
          {quote.nightly.length > 4 && <li><span>외 {quote.nightly.length - 4}박</span><span>{won(quote.nightly.slice(4).reduce((s, n) => s + (n.price as number), 0))}</span></li>}</ul>
        <p><span>예상 숙박요금 · {nights}박</span><strong><Tween value={quote.total} /></strong></p>
      </> : <p className="jsh-price-note">{nights}박 일정의 요금은 예약 확인 연락 때 함께 안내드려요.</p>}
    </div>}
    <button type="button" className="jsh-btn jsh-btn-dark jsh-btn-block" disabled={!ready} onClick={() => setDialogOpen(true)} data-magnetic>
      {!calendar ? "달력 확인 중…" : !config.open ? "예약 신청 준비 중" : nights ? "예약 신청하기" : checkIn ? "체크아웃 날짜를 골라 주세요" : "날짜를 먼저 골라 주세요"}
    </button>
    <ul className="jsh-trust"><li>신청 단계에서는 결제하지 않아요</li><li>일정 확인 후 확정 문자를 보내드려요</li></ul>
  </aside>;
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="jsh-consent">
    <label><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span><b>[필수]</b> 개인정보 수집·이용에 동의합니다.</span></label>
    <details><summary>내용 보기</summary>
      <p><b>수집 항목</b> 이름, 휴대폰 번호, 요청사항</p>
      <p><b>이용 목적</b> 예약 신청 확인, 일정·결제 안내, 문의 응대</p>
      <p><b>보유 기간</b> 전자상거래 등에서의 소비자보호에 관한 법률에 따라 계약·청약철회 등에 관한 기록 5년 보관 후 파기</p>
      <p>동의를 거부할 수 있으며, 거부하면 예약 신청이 제한됩니다.</p>
    </details>
  </div>;
}

function StatusCard({ booking, onCancel, busy }: { booking: StayBooking; onCancel?: () => void; busy?: boolean }) {
  const [asking, setAsking] = useState(false);
  const canCancel = !!onCancel && (booking.status === "requested" || (booking.status === "confirmed" && !booking.cancelRequested));
  return <div className="jsh-status" data-status={booking.status}>
    <div><span className="jsh-status-chip">{STATUS[booking.status]}</span><code>{booking.code}</code></div>
    <strong>{shortDate(booking.checkIn)} → {shortDate(booking.checkOut)}<small>{booking.nights}박 · {booking.guests}명</small></strong>
    {typeof booking.estimate?.total === "number" && <p>예상 숙박요금 {won(booking.estimate.total)}</p>}
    {booking.status === "requested" && <p>일정을 확인하고 있어요. 확정되면 문자로 알려드릴게요.</p>}
    {booking.status === "declined" && <p>죄송해요, 이 일정은 예약이 어려워요. 다른 날짜로 다시 신청해 주세요.</p>}
    {booking.cancelRequested && <p>취소 요청이 접수됐어요. 확인 후 연락드릴게요.</p>}
    {canCancel && (asking
      ? <div className="jsh-status-ask"><span>{booking.status === "confirmed" ? "취소를 요청할까요?" : "신청을 취소할까요?"}</span><button type="button" disabled={busy} onClick={onCancel}>네, 취소할게요</button><button type="button" onClick={() => setAsking(false)}>아니요</button></div>
      : <button type="button" className="jsh-status-cancel" onClick={() => setAsking(true)}>{booking.status === "confirmed" ? "취소 요청하기" : "신청 취소하기"}</button>)}
  </div>;
}

// 예약 신청 창 — 휴대폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 가운데 창
function RequestDialog() {
  const { calendar, checkIn, checkOut, guests, nights, quote, dialogOpen, setDialogOpen, refresh, reset } = useStay();
  const dialog = useRef<HTMLDialogElement>(null), requestId = useRef(""), sending = useRef(false);
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [memo, setMemo] = useState(""), [agree, setAgree] = useState(false);
  const [code, setCode] = useState(""), [verified, setVerified] = useState(""), [notice, setNotice] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [done, setDone] = useState<StayBooking | null>(null), [copied, setCopied] = useState(false);
  const digits = phone.replace(/[^0-9]/g, ""), needVerify = !!calendar?.phoneVerify, isVerified = !needVerify || verified === digits;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (dialogOpen && !el.open) el.showModal();
    if (!dialogOpen && el.open) el.close();
  }, [dialogOpen]);
  const close = () => {
    setDialogOpen(false); setError(""); setNotice("");
    if (done) { setDone(null); setCopied(false); reset(); requestId.current = ""; }
  };

  async function verify(action: "send" | "confirm") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(action === "send" ? "/api/verify/phone" : "/api/verify/phone/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: digits, code }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.error || "인증을 진행하지 못했어요.");
      if (action === "confirm") setVerified(digits);
      setNotice(action === "send" ? "인증번호를 보냈어요. 문자를 확인해 주세요." : "휴대폰 인증이 끝났어요.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    if (!isVerified) { setError("휴대폰 인증을 먼저 완료해 주세요."); return; }
    sending.current = true; setBusy(true); setError("");
    try {
      requestId.current ||= crypto.randomUUID();
      const booking = await api({ action: "request", requestId: requestId.current, checkIn, checkOut, guests, guestName: name, guestPhone: digits, memo, agreed: agree });
      setDone(booking);
      fbqTrack("Lead", { content_name: "JS하우스 예약 신청", content_ids: ["hotel-jshouse"], value: booking.estimate?.total ?? 0, currency: "KRW" });
      await refresh();
    } catch (err) {
      requestId.current = "";
      setError((err as Error).message);
      await refresh();
    } finally {
      sending.current = false; setBusy(false);
    }
  }

  return <dialog ref={dialog} className="jsh-dialog" aria-labelledby="jsh-dialog-title" onClose={close}
    onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="jsh-sheet">
      <span className="jsh-sheet-grip" aria-hidden="true" />
      <button type="button" className="jsh-sheet-close" aria-label="닫기" onClick={close}>×</button>
      {done ? <div className="jsh-done">
        <svg className="jsh-done-mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" /><path d="m20 33 9 9 16-19" /></svg>
        <h3 id="jsh-dialog-title">예약 신청이 접수됐어요</h3>
        <p>일정을 확인한 뒤 확정 여부와 결제 방법을 문자로 안내드릴게요.<br />아직 예약이 확정된 것은 아니에요.</p>
        <div className="jsh-done-code">
          <small>예약번호</small><strong>{done.code}</strong>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(done.code).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "복사했어요" : "번호 복사"}</button>
        </div>
        <dl><div><dt>일정</dt><dd>{shortDate(done.checkIn)} → {shortDate(done.checkOut)} · {done.nights}박</dd></div><div><dt>인원</dt><dd>{done.guests}명</dd></div>
          {typeof done.estimate?.total === "number" && <div><dt>예상 숙박요금</dt><dd>{won(done.estimate.total)}</dd></div>}</dl>
        <p className="jsh-done-note">예약번호와 휴대폰 번호로 이 페이지의 ‘예약 조회’에서 언제든 확인하고 취소할 수 있어요.</p>
        <button type="button" className="jsh-btn jsh-btn-dark jsh-btn-block" onClick={close}>확인</button>
      </div> : <form onSubmit={submit}>
        <p className="jsh-label">RESERVE<span>예약 신청</span></p>
        <h3 id="jsh-dialog-title">누가 머무시나요?</h3>
        <div className="jsh-sheet-stay">
          <span>{checkIn && shortDate(checkIn)} → {checkOut && shortDate(checkOut)}</span><span>{nights}박 · {guests}명</span>
          {quote && typeof quote.total === "number" && <strong>{won(quote.total)}</strong>}
        </div>
        <fieldset disabled={busy}>
          <label className="jsh-field">예약자 이름<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={40} autoComplete="name" placeholder="홍길동" /></label>
          <label className="jsh-field">휴대폰 번호
            <span className="jsh-field-row">
              <input value={phone} onChange={e => { setPhone(e.target.value); setNotice(""); }} required inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" pattern="01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}" />
              {needVerify && <button type="button" className="jsh-btn jsh-btn-line" disabled={digits.length < 10 || isVerified} onClick={() => void verify("send")}>{isVerified ? "인증 완료" : "인증번호 받기"}</button>}
            </span>
          </label>
          {needVerify && !isVerified && <label className="jsh-field">인증번호
            <span className="jsh-field-row">
              <input value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="문자로 받은 6자리" />
              <button type="button" className="jsh-btn jsh-btn-line" disabled={code.length < 4} onClick={() => void verify("confirm")}>확인</button>
            </span>
          </label>}
          <label className="jsh-field"><span>요청사항 <small>선택</small></span><textarea value={memo} onChange={e => setMemo(e.target.value)} maxLength={300} rows={3} placeholder="도착 예정 시간, 궁금한 점 등을 적어 주세요." /></label>
          <Consent checked={agree} onChange={setAgree} />
        </fieldset>
        {notice && <p className="jsh-form-notice" role="status">{notice}</p>}
        {error && <p className="jsh-form-error" role="alert">{error}</p>}
        <button type="submit" className="jsh-btn jsh-btn-dark jsh-btn-block" disabled={busy || !agree || !nights}>{busy ? "접수하는 중…" : "예약 신청 보내기"}</button>
        <p className="jsh-sheet-fine">지금은 결제하지 않아요. 일정 확인 후 확정 문자를 보내드립니다.</p>
      </form>}
    </div>
  </dialog>;
}

function Lookup() {
  const { calendar, refresh } = useStay();
  const [code, setCode] = useState(""), [phone, setPhone] = useState(""), [found, setFound] = useState<StayBooking | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const mine = calendar?.mine ?? [];
  async function run(action: "lookup" | "cancel", target = { code, phone }) {
    setBusy(true); setError("");
    try {
      const booking = await api({ action, ...target });
      setFound(booking);
      if (action === "cancel") await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="jsh-lookup" id="lookup">
    <div>
      <p className="jsh-label">MY BOOKING<span>예약 조회</span></p>
      <h3 className="jsh-h3">신청한 예약, 여기서 확인하세요.</h3>
      <p className="jsh-fine">예약번호(JS-로 시작)와 신청할 때 적은 휴대폰 번호를 입력해 주세요.</p>
    </div>
    <div className="jsh-lookup-body">
      {mine.length > 0 && !found && <div className="jsh-mine"><small>이 기기에서 신청한 예약</small>{mine.map(b => <StatusCard key={b.code} booking={b} />)}</div>}
      <form onSubmit={e => { e.preventDefault(); void run("lookup"); }}>
        <label className="jsh-field">예약번호<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} required placeholder="JS-XXXXXX" maxLength={10} autoCapitalize="characters" /></label>
        <label className="jsh-field">휴대폰 번호<input value={phone} onChange={e => setPhone(e.target.value)} required inputMode="tel" placeholder="010-0000-0000" /></label>
        <button type="submit" className="jsh-btn jsh-btn-line" disabled={busy}>{busy ? "확인 중…" : "조회하기"}</button>
      </form>
      {error && <p className="jsh-form-error" role="alert">{error}</p>}
      {found && <StatusCard booking={found} busy={busy} onCancel={() => void run("cancel", { code: found.code, phone })} />}
    </div>
  </div>;
}

const STEPS = [["01", "날짜 고르기", "달력에서 체크인·체크아웃"], ["02", "예약 신청", "이름과 휴대폰 번호만"], ["03", "일정 확인", "확정 여부를 문자로"], ["04", "결제·입실 안내", "확정 후 이어서 안내"]];

export function BookingSection() {
  const { config } = useStay();
  return <section className="jsh-section jsh-reserve" id="reserve" aria-labelledby="jsh-reserve-title">
    <div className="jsh-wrap">
      <div className="jsh-section-head jsh-reserve-head">
        <div>
          <p className="jsh-label" data-reveal="up">RESERVE<span>예약</span></p>
          <h2 className="jsh-h2" id="jsh-reserve-title" data-reveal="up">머무를 날을<br />골라 보세요.</h2>
        </div>
        <ol className="jsh-steps" data-reveal="up">{STEPS.map(([n, title, body], i) => <li key={n} style={{ ["--i" as string]: i }}><span>{n}</span><b>{title}</b><small>{body}</small></li>)}</ol>
      </div>
      {config.notice && <p className="jsh-notice" data-reveal="up">{config.notice}</p>}
      <div className="jsh-reserve-grid" data-reveal="up">
        <CalendarCard />
        <Summary />
      </div>
      <Lookup />
    </div>
    <RequestDialog />
  </section>;
}

// 휴대폰 하단 고정 바 — 예약 영역이 화면에 있을 때는 '신청' 버튼이 된다
export function MobileBar() {
  const { checkIn, checkOut, nights, guests, fromPrice, config, calendar, dialogOpen, setDialogOpen } = useStay();
  const [inReserve, setInReserve] = useState(false), [shown, setShown] = useState(false);
  useEffect(() => {
    const target = document.getElementById("reserve");
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.55);
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer = target ? new IntersectionObserver(([entry]) => setInReserve(entry.isIntersecting), { rootMargin: "-35% 0px -35% 0px" }) : null;
    if (target && observer) observer.observe(target);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); observer?.disconnect(); };
  }, []);
  const ready = !!nights && !!calendar && config.open;
  return <div className="jsh-mobilebar" data-shown={(shown && !dialogOpen) || undefined}>
    <div>
      {nights ? <><b>{shortDate(checkIn)} → {shortDate(checkOut)}</b><small>{nights}박 · {guests}명</small></>
        : <><b>{fromPrice !== null ? `1박 ${won(fromPrice)}부터` : "JS하우스 · 연남동"}</b><small>{checkIn ? "체크아웃 날짜를 골라 주세요" : "신청 단계에서는 결제하지 않아요"}</small></>}
    </div>
    <button type="button" className="jsh-btn jsh-btn-dark" onClick={() => (ready ? setDialogOpen(true) : goReserve())}>{ready ? "예약 신청" : inReserve ? "날짜 선택" : "예약하기"}</button>
  </div>;
}
