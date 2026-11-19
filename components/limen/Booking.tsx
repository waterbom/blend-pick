"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { commerceParams, fbqTrack } from "@/lib/analytics";
import { payErrorMessage, tossMobilePhone } from "@/lib/pay-utils";
import { useMetaEvent } from "@/lib/use-meta-event";
import { RATE_ROWS, ROOMS, ROOM_KEYS, type RoomKey, type StayConfig } from "@/components/limen/content";
import { DAY, SEASON, STATUS, WEEK, addDays, shortDate, stayApi as api, weekdayOf, won, type RoomCalendar, type StayBooking, type StayOrder } from "@/components/limen/stay";

// LIMEN 달력 예약 — 객실 선택 → 날짜 → 인원 → 예약자 정보 → (카드 결제 또는 예약 신청) → 완료.
// 히어로의 빠른 예약 바, 객실 카드의 버튼, 본문 달력, 모바일 하단 바가 같은 선택 상태를 함께 쓴다 (StayProvider).
// 객실(원룸·투룸)은 서로 다른 공간이라 달력이 따로다. 날짜별 요금은 서버가 시즌까지 계산해 내려준다.
// 요금이 모두 정해진 일정이고 카드 결제가 켜져 있으면 블랜드픽과 같은 토스 결제창으로 바로 결제·확정한다.
// 그렇지 않은 일정은 결제 없이 신청만 받고 운영자가 확정한다. 어느 쪽인지는 서버가 정한다 (calendar.pay).

// 달력 칸용 짧은 요금 — 200,000 → 20만, 185,000 → 18.5만
const manwon = (n: number) => `${(Math.round(n / 1000) / 10).toLocaleString("ko-KR")}만`;
const Arrow = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;

type Calendar = {
  today: string; lastDay: string; config: StayConfig;
  rooms: Record<RoomKey, RoomCalendar>;
  mine: StayBooking[]; phoneVerify: boolean;
  pay: boolean; termsKey: string; // 카드 결제 가능 여부, 화면에 보여 준 환불 규정의 지문
};
type Quote = { nightly: { day: string; price: number | null }[]; total: number | null };

type Stay = {
  calendar: Calendar | null; config: StayConfig; loadError: string; refresh: () => Promise<void>;
  room: RoomKey; setRoom: (room: RoomKey) => void; roomOpen: boolean; maxGuests: number;
  checkIn: string; checkOut: string; guests: number; nights: number; hint: string;
  setGuests: (n: number) => void; choose: (day: string) => void; reset: () => void;
  selectable: (day: string) => boolean; canCheckout: (day: string) => boolean;
  priceOf: (day: string) => number | null; seasonOf: (day: string) => "shoulder" | "peak" | undefined;
  quote: Quote | null;
  fromPrice: (room?: RoomKey) => number | null; // 요금표에서 가장 낮은 1박 요금 (객실을 주지 않으면 전체)
  dialogOpen: boolean; setDialogOpen: (open: boolean) => void;
  pay: boolean;      // 카드 결제를 받는 상태
  payNow: boolean;   // 지금 고른 일정을 카드로 바로 결제할 수 있음 (요금이 모두 정해짐)
  clientKey: string;
};
const StayContext = createContext<Stay | null>(null);
export function useStay() {
  const value = useContext(StayContext);
  if (!value) throw Error("StayProvider is required");
  return value;
}

export function StayProvider({ initialConfig, initialPay = false, clientKey = "", children }: { initialConfig: StayConfig; initialPay?: boolean; clientKey?: string; children: ReactNode }) {
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [loadError, setLoadError] = useState("");
  const [room, setRoomKey] = useState<RoomKey>("two");
  const [checkIn, setIn] = useState(""), [checkOut, setOut] = useState(""), [guestCount, setGuestCount] = useState(2), [hint, setHint] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const serial = useRef(0), picked = useRef({ room: "two" as RoomKey, checkIn: "", checkOut: "" });
  // 가장 마지막에 보낸 요청의 응답만 화면에 반영한다 (serial)
  const refresh = useCallback((): Promise<void> => {
    const current = ++serial.current;
    return fetch("/api/limen", { cache: "no-store" }).then(async response => {
      const data: Calendar = await response.json();
      if (!response.ok) throw Error("load failed");
      if (current !== serial.current) return;
      setCalendar(data); setLoadError("");
      // 새 달력에서 고른 날짜가 막혔으면(다른 예약이 먼저 잡힘) 선택을 비운다
      const { room: key, checkIn: start, checkOut: end } = picked.current;
      if (start) {
        const blocked = new Set([...data.rooms[key].closed, ...data.rooms[key].taken]), first = addDays(data.today, data.config.minLeadDays);
        const count = (Date.parse(end || addDays(start, 1)) - Date.parse(start)) / DAY;
        const free = data.config.open && data.config.rooms[key].open && Array.from({ length: count }, (_, i) => addDays(start, i)).every(day => day >= first && day < data.lastDay && !blocked.has(day));
        if (!free) { setIn(""); setOut(""); setHint("고르신 날짜가 방금 마감됐어요. 다시 골라 주세요."); }
      }
    }).catch(() => {
      if (current === serial.current) setLoadError("예약 달력을 불러오지 못했어요.");
    });
  }, []);
  useEffect(() => { picked.current = { room, checkIn, checkOut }; }, [room, checkIn, checkOut]);
  useEffect(() => {
    const counter = serial;
    void refresh();
    // 다른 사람이 먼저 잡은 날짜가 오래 열려 보이지 않게, 화면으로 돌아올 때 다시 확인
    const onFocus = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => { counter.current++; document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh]);
  useMetaEvent("ViewContent", "hotel-limen", { content_type: "product", content_ids: ["hotel-limen"] });

  const config = calendar?.config ?? initialConfig;
  const rates = config.rooms[room], maxGuests = rates.guests, roomOpen = config.open && rates.open;
  const guests = Math.min(guestCount, maxGuests);
  const data = calendar?.rooms[room];
  const sets = useMemo(() => ({ closed: new Set(data?.closed), taken: new Set(data?.taken) }), [data]);
  const first = calendar ? addDays(calendar.today, config.minLeadDays) : "";
  const selectable = useCallback((day: string) =>
    !!calendar && roomOpen && day >= first && day < calendar.lastDay && !sets.closed.has(day) && !sets.taken.has(day),
  [calendar, roomOpen, first, sets]);
  // 퇴실일은 그날 밤을 쓰지 않으므로, 다른 예약의 입실일이어도 고를 수 있다
  const canCheckout = useCallback((day: string) => {
    if (!checkIn || !calendar || day <= checkIn || day > calendar.lastDay) return false;
    const count = (Date.parse(day) - Date.parse(checkIn)) / DAY;
    return count <= config.maxNights && Array.from({ length: count }, (_, i) => addDays(checkIn, i)).every(selectable);
  }, [calendar, checkIn, config.maxNights, selectable]);
  const priceOf = useCallback((day: string) => data?.prices[day] ?? null, [data]);
  const seasonOf = useCallback((day: string) => data?.seasons[day], [data]);

  const choose = useCallback((day: string) => {
    setHint("");
    if (checkIn && !checkOut && day > checkIn) {
      if (canCheckout(day)) { setOut(day); return; }
      if (!selectable(day)) { setHint((Date.parse(day) - Date.parse(checkIn)) / DAY > config.maxNights ? `한 번에 최대 ${config.maxNights}박까지 예약할 수 있어요.` : "사이에 마감된 날짜가 있어요. 다른 날짜를 골라 주세요."); return; }
    }
    if (!selectable(day)) return;
    // 마감일을 건너뛴 날짜를 누르면 그날부터 체크인을 새로 잡는다
    if (checkIn && !checkOut && day > checkIn) setHint("사이에 마감된 날짜가 있어 체크인을 다시 잡았어요. 체크아웃을 골라 주세요.");
    setIn(day); setOut("");
  }, [checkIn, checkOut, canCheckout, selectable, config.maxNights]);
  const reset = useCallback(() => { setIn(""); setOut(""); setHint(""); }, []);
  const setGuests = useCallback((n: number) => setGuestCount(Math.max(1, Math.min(maxGuests, n))), [maxGuests]);
  // 객실마다 달력이 다르므로 객실을 바꾸면 고른 날짜를 비운다
  const setRoom = useCallback((next: RoomKey) => {
    setRoomKey(current => { if (current !== next) { setIn(""); setOut(""); setHint(""); } return next; });
  }, []);

  const nights = checkIn && checkOut ? (Date.parse(checkOut) - Date.parse(checkIn)) / DAY : 0;
  const quote = useMemo<Quote | null>(() => {
    if (!nights) return null;
    const nightly = Array.from({ length: nights }, (_, i) => { const day = addDays(checkIn, i); return { day, price: priceOf(day) }; });
    return { nightly, total: nightly.every(n => n.price !== null) ? nightly.reduce((sum, n) => sum + (n.price as number), 0) : null };
  }, [nights, checkIn, priceOf]);
  const fromPrice = useCallback((key?: RoomKey) => {
    const prices = (key ? [key] : ROOM_KEYS.filter(k => config.rooms[k].open)).flatMap(k => RATE_ROWS.map(row => config.rooms[k][row.key])).filter((v): v is number => typeof v === "number");
    return prices.length ? Math.min(...prices) : null;
  }, [config.rooms]);

  const pay = (calendar ? calendar.pay : initialPay) && !!clientKey;
  const payNow = pay && !!calendar && typeof quote?.total === "number";
  const value: Stay = {
    calendar, config, loadError, refresh, room, setRoom, roomOpen, maxGuests, checkIn, checkOut, guests, nights, hint, setGuests, choose, reset,
    selectable, canCheckout, priceOf, seasonOf, quote, fromPrice, dialogOpen, setDialogOpen, pay, payNow, clientKey,
  };
  return <StayContext.Provider value={value}>{children}</StayContext.Provider>;
}

const goReserve = () => document.getElementById("reserve")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

// 히어로 안의 빠른 예약 바
export function QuickBar() {
  const { room, checkIn, checkOut, nights, fromPrice, config, payNow } = useStay();
  const from = fromPrice();
  return <button type="button" className="lm-quick" onClick={goReserve} aria-label="예약 달력으로 이동">
    <span><small>객실</small><b key={room} className="lm-flip">{ROOMS[room].name} · {config.rooms[room].guests}인</b></span>
    <span><small>체크인</small><b key={checkIn} className="lm-flip">{checkIn ? shortDate(checkIn) : "날짜 선택"}</b></span>
    <span><small>체크아웃</small><b key={checkOut} className="lm-flip">{checkOut ? shortDate(checkOut) : "날짜 선택"}</b></span>
    <strong>{nights ? `${nights}박 ${payNow ? "예약" : "신청"}` : config.open ? "날짜 보기" : "달력 보기"}<Arrow /></strong>
    {from !== null && <em>1박 {won(from)}부터</em>}
  </button>;
}

// 객실 카드의 버튼 — 그 객실을 고른 채로 달력으로 내려간다
export function RoomCta({ room }: { room: RoomKey }) {
  const { setRoom, config } = useStay();
  const open = config.open && config.rooms[room].open;
  return <button type="button" className="lm-room-cta" disabled={!open} onClick={() => { setRoom(room); goReserve(); }}>
    {open ? <>{ROOMS[room].name} 날짜 보기<Arrow /></> : "예약 준비 중"}
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

// 객실 고르기 — 고른 객실의 달력과 요금으로 바뀐다
function RoomSwitch() {
  const { room, setRoom, config, fromPrice } = useStay();
  return <div className="lm-roomswitch" role="radiogroup" aria-label="객실 선택">
    {ROOM_KEYS.map(key => {
      const rates = config.rooms[key], open = config.open && rates.open, from = fromPrice(key);
      return <button key={key} type="button" role="radio" aria-checked={room === key} disabled={!open} onClick={() => setRoom(key)}>
        <span>{ROOMS[key].en}</span>
        <b>{ROOMS[key].name}<small>{rates.guests}인</small></b>
        <em>{!open ? "예약 준비 중" : from !== null ? `1박 ${won(from)}부터` : "요금 문의"}</em>
      </button>;
    })}
  </div>;
}

function Month({ ym, hover, onHover }: { ym: string; hover: string; onHover: (day: string) => void }) {
  const { calendar, checkIn, checkOut, choose, selectable, canCheckout, priceOf, seasonOf } = useStay();
  const year = Number(ym.slice(0, 4)), month = Number(ym.slice(5, 7));
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate(), leading = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const picking = !!checkIn && !checkOut;
  const previewEnd = picking && hover > checkIn && canCheckout(hover) ? hover : "";
  return <div className="lm-month">
    <h4>{year}. {String(month).padStart(2, "0")}</h4>
    <div className="lm-week" aria-hidden="true">{WEEK.map((d, i) => <span key={d} data-weekend={i === 5 || i === 6 || undefined}>{d}</span>)}</div>
    <div className="lm-days" role="group" aria-label={`${year}년 ${month}월`}>
      {Array.from({ length: leading }, (_, i) => <span key={`e${i}`} aria-hidden="true" />)}
      {Array.from({ length: count }, (_, i) => {
        const day = `${ym}-${String(i + 1).padStart(2, "0")}`;
        const open = selectable(day), out = picking && day > checkIn && canCheckout(day);
        const start = day === checkIn, end = day === checkOut;
        const inside = !!checkIn && !!checkOut && day > checkIn && day < checkOut;
        const preview = !!previewEnd && day > checkIn && day <= previewEnd;
        const past = !!calendar && day < calendar.today;
        const price = open ? priceOf(day) : null, season = open ? seasonOf(day) : undefined;
        const state = start ? "start" : end ? "end" : inside ? "inside" : open ? "open" : out ? "out" : past ? "past" : "off";
        const label = `${month}월 ${i + 1}일 ${WEEK[weekdayOf(day)]}요일${start ? ", 체크인" : end ? ", 체크아웃" : ""}${open ? `${season ? `, ${SEASON[season]}` : ""}${price !== null ? `, 1박 ${won(price)}` : ", 예약 가능"}` : out ? ", 체크아웃 가능" : past ? ", 지난 날짜" : ", 예약 마감"}`;
        return <button key={day} type="button" className="lm-day" data-state={state} data-preview={preview || undefined} data-today={day === calendar?.today || undefined} data-season={season}
          data-weekend={[5, 6].includes(weekdayOf(day)) || undefined} disabled={!calendar || (!open && !out)} aria-pressed={start || end || inside} aria-label={label}
          onClick={() => choose(day)} onMouseEnter={() => onHover(day)} onFocus={() => onHover(day)}>
          <b>{i + 1}</b>
          <small>{start ? "체크인" : end ? "체크아웃" : open ? (price !== null ? manwon(price) : "") : out ? "퇴실" : !past && calendar ? "마감" : ""}</small>
        </button>;
      })}
    </div>
  </div>;
}

function CalendarCard() {
  const { calendar, config, room, roomOpen, loadError, refresh, checkIn, checkOut, nights, hint, reset } = useStay();
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
  const hasSeason = !!calendar && Object.keys(calendar.rooms[room].seasons).length > 0;
  const status = !calendar ? (loadError || "달력을 불러오는 중이에요…")
    : !config.open ? "지금은 예약을 받지 않고 있어요."
    : !roomOpen ? `지금은 ${ROOMS[room].name} 예약을 받지 않고 있어요.`
    : hint ? hint
    : nights ? `${ROOMS[room].name} · ${nights}박 ${nights + 1}일 · ${shortDate(checkIn)} → ${shortDate(checkOut)}`
    : checkIn ? `${shortDate(checkIn)} 체크인 · 이제 체크아웃 날짜를 골라 주세요`
    : `${ROOMS[room].name} · 체크인 날짜를 먼저 골라 주세요`;
  return <div className="lm-cal" data-picking={(!!checkIn && !checkOut) || undefined}>
    <div className="lm-cal-top">
      <p className="lm-cal-status" role="status" aria-live="polite" data-tone={hint ? "warn" : nights ? "done" : undefined}><i aria-hidden="true" />{status}{loadError && !calendar && <button type="button" onClick={() => void refresh()}>다시 불러오기</button>}</p>
      <div className="lm-cal-nav">
        <button type="button" aria-label="이전 달" disabled={index === 0} onClick={() => move(-1)}>←</button>
        <button type="button" aria-label="다음 달" disabled={index >= months.length - 1} onClick={() => move(1)}>→</button>
      </div>
    </div>
    <div className="lm-months" key={`${room}-${index}`} data-dir={direction > 0 ? "next" : "prev"} onMouseLeave={() => setHover("")}
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={e => {
        const from = touch.current; touch.current = null;
        if (!from) return;
        const dx = e.changedTouches[0].clientX - from.x, dy = e.changedTouches[0].clientY - from.y;
        if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) move(dx < 0 ? 1 : -1);
      }}>
      {months.length ? <>
        <Month ym={months[index]} hover={hover} onHover={setHover} />
        {months[index + 1] && <div className="lm-month-second"><Month ym={months[index + 1]} hover={hover} onHover={setHover} /></div>}
      </> : <div className="lm-cal-skeleton" aria-hidden="true">{Array.from({ length: 35 }, (_, i) => <span key={i} style={{ ["--i" as string]: i }} />)}</div>}
    </div>
    <div className="lm-cal-foot">
      <ul className="lm-legend" aria-label="달력 표시 안내">
        <li data-k="open">예약 가능</li><li data-k="pick">선택</li><li data-k="off">마감</li>
        {hasSeason && <><li data-k="shoulder">준성수기</li><li data-k="peak">극성수기</li></>}
      </ul>
      <button type="button" className="lm-reset" disabled={!checkIn} onClick={reset}>다시 고르기 ↺</button>
    </div>
  </div>;
}

function Summary() {
  const { calendar, config, room, roomOpen, maxGuests, checkIn, checkOut, guests, setGuests, nights, quote, fromPrice, seasonOf, setDialogOpen, pay, payNow } = useStay();
  const ready = !!nights && !!calendar && roomOpen;
  const from = fromPrice(room);
  // 요금이 빠진 날짜가 섞이면 카드 결제 대신 신청으로 받는다
  const asRequest = !pay || (!!nights && !payNow);
  return <aside className="lm-summary" aria-label="예약 요약">
    <div className="lm-summary-head">
      <span>YOUR STAY · {ROOMS[room].en}</span>
      {from !== null ? <strong>{won(from)}<small> 부터 / 1박</small></strong> : <strong className="lm-summary-soft">요금은 일정 확인 후 안내</strong>}
    </div>
    <div className="lm-dates">
      <div data-on={!!checkIn || undefined}><small>체크인{config.checkInTime && <i>{config.checkInTime}</i>}</small><b key={checkIn} className="lm-flip">{checkIn ? shortDate(checkIn) : "날짜 선택"}</b></div>
      <span aria-hidden="true">{nights ? `${nights}박` : "→"}</span>
      <div data-on={!!checkOut || undefined}><small>체크아웃{config.checkOutTime && <i>{config.checkOutTime}</i>}</small><b key={checkOut} className="lm-flip">{checkOut ? shortDate(checkOut) : "날짜 선택"}</b></div>
    </div>
    <div className="lm-stepper">
      <span>인원<small>{ROOMS[room].name} 최대 {maxGuests}인 · 추가 불가</small></span>
      <div>
        <button type="button" aria-label="인원 줄이기" disabled={guests <= 1} onClick={() => setGuests(guests - 1)}>−</button>
        <output aria-live="polite" key={guests} className="lm-flip">{guests}</output>
        <button type="button" aria-label="인원 늘리기" disabled={guests >= maxGuests} onClick={() => setGuests(guests + 1)}>+</button>
      </div>
    </div>
    {quote && <div className="lm-price" aria-live="polite">
      {quote.total !== null ? <>
        <ul>{quote.nightly.slice(0, 4).map(n => { const season = seasonOf(n.day); return <li key={n.day}><span>{shortDate(n.day)}{season && <i>{SEASON[season]}</i>}</span><span>{won(n.price as number)}</span></li>; })}
          {quote.nightly.length > 4 && <li><span>외 {quote.nightly.length - 4}박</span><span>{won(quote.nightly.slice(4).reduce((s, n) => s + (n.price as number), 0))}</span></li>}</ul>
        <p><span>{payNow ? "결제 금액" : "예상 숙박요금"} · {nights}박</span><strong><Tween value={quote.total} /></strong></p>
      </> : <p className="lm-price-note">{nights}박 일정의 요금은 예약 확인 연락 때 함께 안내드려요.</p>}
    </div>}
    <button type="button" className="lm-btn lm-btn-light lm-btn-block" disabled={!ready} onClick={() => setDialogOpen(true)}>
      {!calendar ? "달력 확인 중…" : !roomOpen ? "예약 준비 중" : nights ? (payNow ? "예약·결제하기" : "예약 신청하기") : checkIn ? "체크아웃 날짜를 골라 주세요" : "날짜를 먼저 골라 주세요"}
    </button>
    {asRequest
      ? <ul className="lm-trust"><li>신청 단계에서는 결제하지 않아요</li><li>일정 확인 후 확정 문자를 보내드려요</li></ul>
      : <ul className="lm-trust"><li>카드로 결제하면 바로 예약이 확정돼요</li><li>결제 전에 취소·환불 규정을 확인할 수 있어요</li></ul>}
  </aside>;
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="lm-consent">
    <label><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span><b>[필수]</b> 개인정보 수집·이용에 동의합니다.</span></label>
    <details><summary>내용 보기</summary>
      <p><b>수집 항목</b> 이름, 휴대폰 번호, 요청사항</p>
      <p><b>이용 목적</b> 예약 접수·결제 처리, 일정 안내, 문의 응대</p>
      <p><b>보유 기간</b> 전자상거래 등에서의 소비자보호에 관한 법률에 따라 계약·청약철회 등에 관한 기록 5년 보관 후 파기</p>
      <p>동의를 거부할 수 있으며, 거부하면 예약이 제한됩니다.</p>
    </details>
  </div>;
}

function StatusCard({ booking, onCancel, busy }: { booking: StayBooking; onCancel?: () => void; busy?: boolean }) {
  const [asking, setAsking] = useState(false);
  const { status, paid } = booking;
  const canCancel = !!onCancel && (status === "requested" || status === "pending" || (status === "confirmed" && !booking.cancelRequested));
  const ask = status === "confirmed" ? "취소를 요청할까요?" : status === "pending" ? "결제하지 않고 닫을까요?" : "신청을 취소할까요?";
  const cancelLabel = status === "confirmed" ? "취소 요청하기" : status === "pending" ? "결제하지 않고 닫기" : "신청 취소하기";
  return <div className="lm-status" data-status={status}>
    <div><span className="lm-status-chip">{STATUS[status]}{status === "confirmed" && paid ? " · 결제 완료" : ""}</span><code>{booking.code}</code></div>
    <strong>{shortDate(booking.checkIn)} → {shortDate(booking.checkOut)}<small>{booking.roomName && `${booking.roomName} · `}{booking.nights}박 · {booking.guests}명</small></strong>
    {status === "expired" ? null : typeof booking.amount === "number"
      ? <p>{paid ? "결제금액" : "결제 예정 금액"} {won(booking.amount)}{booking.receiptUrl && <> · <a href={booking.receiptUrl} target="_blank" rel="noopener noreferrer">영수증 보기 ↗</a></>}</p>
      : typeof booking.estimate?.total === "number" && <p>예상 숙박요금 {won(booking.estimate.total)}</p>}
    {status === "requested" && <p>일정을 확인하고 있어요. 확정되면 문자로 알려드릴게요.</p>}
    {status === "pending" && <p>아직 결제가 끝나지 않았어요. 15분 안에 결제하지 않으면 날짜가 다시 열립니다.</p>}
    {status === "confirming" && <p>결제 승인을 확인하고 있어요. 다시 결제하지 마시고 잠시 뒤 다시 조회해 주세요.</p>}
    {status === "cancelling" && <p>환불을 처리하고 있어요. 잠시 뒤 다시 조회해 주세요.</p>}
    {status === "expired" && <p>결제가 완료되지 않아 예약되지 않았어요. 결제된 금액은 없습니다.</p>}
    {status === "declined" && <p>죄송해요, 이 일정은 예약이 어려워요. 다른 날짜로 다시 신청해 주세요.</p>}
    {status === "cancelled" && typeof booking.amount === "number" && booking.refundAmount !== null && <p>환불 처리금액 {won(booking.refundAmount)}</p>}
    {booking.cancelRequested && <p>취소 요청이 접수됐어요. {paid ? "동의하신 취소·환불 규정에 따라 확인한 뒤 연락드릴게요." : "확인 후 연락드릴게요."}</p>}
    {booking.estimate?.refundTerms && status !== "expired" && <details className="lm-status-terms"><summary>동의한 취소·환불 규정</summary><p>{booking.estimate.refundTerms}</p></details>}
    {canCancel && (asking
      ? <div className="lm-status-ask"><span>{ask}</span><button type="button" disabled={busy} onClick={onCancel}>{status === "pending" ? "네, 닫을게요" : "네, 취소할게요"}</button><button type="button" onClick={() => setAsking(false)}>아니요</button></div>
      : <button type="button" className="lm-status-cancel" onClick={() => setAsking(true)}>{cancelLabel}</button>)}
  </div>;
}

// 결제창에서 사용자가 직접 닫았을 때 토스가 알려주는 코드
const PAY_CANCEL_CODES = ["USER_CANCEL", "PAY_PROCESS_CANCELED", "PAY_PROCESS_ABORTED"];

// 예약 창 — 휴대폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 가운데 창.
// 카드 결제 일정: 예약자 정보 + 환불 규정 동의 → 날짜를 잡고 토스 결제창을 연다 → 결과 화면(/hotel/limen/result)에서 승인.
// 신청 일정: 예약자 정보만 받고 바로 접수 완료를 보여 준다.
function RequestDialog() {
  const { calendar, config, room, checkIn, checkOut, guests, nights, quote, dialogOpen, setDialogOpen, refresh, reset, payNow, clientKey } = useStay();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null), requestId = useRef(""), sending = useRef(false), closedByCode = useRef(false);
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [memo, setMemo] = useState(""), [agree, setAgree] = useState(false), [terms, setTerms] = useState(false);
  const [code, setCode] = useState(""), [verified, setVerified] = useState(""), [notice, setNotice] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [done, setDone] = useState<StayBooking | null>(null), [copied, setCopied] = useState(false), [paying, setPaying] = useState(false);
  const digits = phone.replace(/[^0-9]/g, ""), needVerify = !!calendar?.phoneVerify, isVerified = !needVerify || verified === digits;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (dialogOpen && !el.open) el.showModal();
    // 코드로 닫을 때 나오는 close 이벤트는 한 박자 늦게 온다. 그 사이 창을 다시 열었을 수 있으므로(결제창이 바로 닫힌 경우)
    // 이 이벤트가 '사용자가 닫음'으로 처리되어 오류 안내를 지우지 않게 표시해 둔다.
    if (!dialogOpen && el.open) { closedByCode.current = true; el.close(); }
  }, [dialogOpen]);
  // 휴대폰에서 결제창으로 넘어갔다가 '뒤로'로 돌아오면 멈춰 있던 화면을 다시 쓸 수 있게 되돌린다
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      sending.current = false; requestId.current = "";
      setBusy(false); setPaying(false);
      void refresh();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [refresh]);
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
    let orderId = "";
    try {
      requestId.current ||= crypto.randomUUID();
      const guest = { requestId: requestId.current, room, checkIn, checkOut, guests, guestName: name, guestPhone: digits, memo, agreed: agree };
      if (!payNow || typeof quote?.total !== "number") {
        const booking = await api({ action: "request", ...guest });
        setDone(booking);
        fbqTrack("Lead", { content_name: "LIMEN 예약 신청", content_ids: ["hotel-limen"], value: booking.estimate?.total ?? 0, currency: "KRW" });
        await refresh();
        return;
      }
      // 1) 서버가 금액·규정을 다시 확인하고 날짜를 15분 동안 잡는다
      const order = await api<StayOrder>({ action: "reserve", ...guest, agreedTerms: terms, amount: quote.total, termsKey: calendar?.termsKey });
      orderId = order.orderId;
      if (!order.payable || typeof order.amount !== "number") { router.push(`/hotel/limen/result?orderId=${encodeURIComponent(order.orderId)}`); return; }
      try { sessionStorage.setItem("limen-last-order", order.orderId); } catch { /* 저장소를 못 써도 결제는 진행된다 */ }
      fbqTrack("InitiateCheckout", commerceParams([{ id: "hotel-limen", quantity: 1, price: order.amount }]));
      // 2) 결제창이 가려지지 않게 예약 창을 닫고, 블랜드픽과 같은 토스 결제창을 연다
      setDialogOpen(false); setPaying(true);
      const toss = await loadTossPayments(clientKey);
      await toss.payment({ customerKey: "ANONYMOUS" }).requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: order.amount },
        orderId: order.orderId,
        orderName: `LIMEN ${ROOMS[room].name} ${checkIn} ~ ${checkOut}`,
        customerName: name.trim(),
        customerMobilePhone: tossMobilePhone(digits),
        successUrl: `${window.location.origin}/hotel/limen/result`,
        failUrl: `${window.location.origin}/hotel/limen/result?failed=1&booking=${encodeURIComponent(order.orderId)}`,
      });
      // 3) 결제가 끝나면 결과 화면으로 이동해 서버에서 승인한다
    } catch (err) {
      requestId.current = "";
      if (orderId) {
        // 결제창을 닫았거나 열지 못함 — 승인된 결제가 없으므로 잡아 둔 날짜를 바로 돌려준다
        await api<StayOrder>({ action: "abandon", orderId }).catch(() => {});
        setError(PAY_CANCEL_CODES.includes((err as { code?: string }).code || "") ? "결제를 취소했어요. 잡아 둔 날짜는 다시 열렸습니다." : (payErrorMessage(err) || "결제를 취소했어요. 잡아 둔 날짜는 다시 열렸습니다."));
        setDialogOpen(true);
      } else setError((err as Error).message);
      setPaying(false);
      await refresh();
    } finally {
      sending.current = false; setBusy(false);
    }
  }

  return <>
    {paying && <p className="lm-paying" role="status"><i aria-hidden="true" />결제창을 여는 중이에요…</p>}
    <dialog ref={dialog} className="lm-dialog" aria-labelledby="lm-dialog-title"
      onClose={() => { if (closedByCode.current) closedByCode.current = false; else close(); }}
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="lm-sheet">
        <span className="lm-sheet-grip" aria-hidden="true" />
        <button type="button" className="lm-sheet-close" aria-label="닫기" onClick={close}>×</button>
        {done ? <div className="lm-done">
          <svg className="lm-done-mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" /><path d="m20 33 9 9 16-19" /></svg>
          <h3 id="lm-dialog-title">예약 신청이 접수됐어요</h3>
          <p>일정을 확인한 뒤 확정 여부와 결제 방법을 문자로 안내드릴게요.<br />아직 예약이 확정된 것은 아니에요.</p>
          <div className="lm-done-code">
            <small>예약번호</small><strong>{done.code}</strong>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(done.code).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "복사했어요" : "번호 복사"}</button>
          </div>
          <dl><div><dt>객실</dt><dd>{done.roomName}</dd></div><div><dt>일정</dt><dd>{shortDate(done.checkIn)} → {shortDate(done.checkOut)} · {done.nights}박</dd></div><div><dt>인원</dt><dd>{done.guests}명</dd></div>
            {typeof done.estimate?.total === "number" && <div><dt>예상 숙박요금</dt><dd>{won(done.estimate.total)}</dd></div>}</dl>
          <p className="lm-done-note">예약번호와 휴대폰 번호로 이 페이지의 ‘예약 조회’에서 언제든 확인하고 취소할 수 있어요.</p>
          <button type="button" className="lm-btn lm-btn-dark lm-btn-block" onClick={close}>확인</button>
        </div> : <form onSubmit={submit}>
          <p className="lm-label"><b>—</b><span>{payNow ? "RESERVE · 예약·결제" : "RESERVE · 예약 신청"}</span></p>
          <h3 id="lm-dialog-title">누가 머무시나요?</h3>
          <div className="lm-sheet-stay">
            <span>{ROOMS[room].name} · {checkIn && shortDate(checkIn)} → {checkOut && shortDate(checkOut)}</span><span>{nights}박 · {guests}명</span>
            {quote && typeof quote.total === "number" && <strong>{won(quote.total)}</strong>}
          </div>
          <fieldset disabled={busy}>
            <label className="lm-field">예약자 이름<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={40} autoComplete="name" placeholder="홍길동" /></label>
            <label className="lm-field">휴대폰 번호
              <span className="lm-field-row">
                <input value={phone} onChange={e => { setPhone(e.target.value); setNotice(""); }} required inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" pattern="01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}" />
                {needVerify && <button type="button" className="lm-btn lm-btn-line" disabled={digits.length < 10 || isVerified} onClick={() => void verify("send")}>{isVerified ? "인증 완료" : "인증번호 받기"}</button>}
              </span>
            </label>
            {needVerify && !isVerified && <label className="lm-field">인증번호
              <span className="lm-field-row">
                <input value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="문자로 받은 6자리" />
                <button type="button" className="lm-btn lm-btn-line" disabled={code.length < 4} onClick={() => void verify("confirm")}>확인</button>
              </span>
            </label>}
            <label className="lm-field"><span>요청사항 <small>선택</small></span><textarea value={memo} onChange={e => setMemo(e.target.value)} maxLength={300} rows={3} placeholder="도착 예정 시간, 궁금한 점 등을 적어 주세요." /></label>
            {payNow && <div className="lm-consent lm-terms">
              <b>취소·환불 규정</b>
              <p tabIndex={0}>{config.refundTerms}</p>
              <label><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /><span><b>[필수]</b> 위 취소·환불 규정을 확인했고 동의합니다.</span></label>
            </div>}
            <Consent checked={agree} onChange={setAgree} />
          </fieldset>
          {notice && <p className="lm-form-notice" role="status">{notice}</p>}
          {error && <p className="lm-form-error" role="alert">{error}</p>}
          {payNow && typeof quote?.total === "number"
            ? <>
              <button type="submit" className="lm-btn lm-btn-dark lm-btn-block" disabled={busy || !agree || !terms || !nights}>{busy ? "결제 준비 중…" : `${won(quote.total)} 결제하기`}</button>
              <p className="lm-sheet-fine">토스페이먼츠 결제창에서 카드로 결제해요. 결제가 끝나면 바로 예약이 확정됩니다.</p>
            </>
            : <>
              <button type="submit" className="lm-btn lm-btn-dark lm-btn-block" disabled={busy || !agree || !nights}>{busy ? "접수하는 중…" : "예약 신청 보내기"}</button>
              <p className="lm-sheet-fine">지금은 결제하지 않아요. 일정 확인 후 확정 문자를 보내드립니다.</p>
            </>}
        </form>}
      </div>
    </dialog>
  </>;
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
  return <div className="lm-lookup" id="lookup">
    <div>
      <p className="lm-label"><b>—</b><span>MY BOOKING</span></p>
      <h3 className="lm-h3">내 예약 확인</h3>
      <p className="lm-fine">예약번호(LM-으로 시작)와 예약할 때 적은 휴대폰 번호를 입력해 주세요.</p>
    </div>
    <div className="lm-lookup-body">
      {mine.length > 0 && !found && <div className="lm-mine"><small>이 기기에서 진행한 예약</small>{mine.map(b => <StatusCard key={b.code} booking={b} />)}</div>}
      <form onSubmit={e => { e.preventDefault(); void run("lookup"); }}>
        <label className="lm-field">예약번호<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} required placeholder="LM-XXXXXX" maxLength={10} autoCapitalize="characters" /></label>
        <label className="lm-field">휴대폰 번호<input value={phone} onChange={e => setPhone(e.target.value)} required inputMode="tel" placeholder="010-0000-0000" /></label>
        <button type="submit" className="lm-btn lm-btn-line" disabled={busy}>{busy ? "확인 중…" : "조회하기"}</button>
      </form>
      {error && <p className="lm-form-error" role="alert">{error}</p>}
      {found && <StatusCard booking={found} busy={busy} onCancel={() => void run("cancel", { code: found.code, phone })} />}
    </div>
  </div>;
}

const STEPS = [["01", "객실·날짜", "달력에서 체크인·체크아웃"], ["02", "예약 신청", "이름과 휴대폰 번호만"], ["03", "일정 확인", "확정 여부를 문자로"], ["04", "결제·입실 안내", "확정 후 이어서 안내"]];
const PAY_STEPS = [["01", "객실·날짜", "달력에서 체크인·체크아웃"], ["02", "예약자 정보", "이름과 휴대폰 번호만"], ["03", "카드 결제", "토스페이먼츠 결제창"], ["04", "예약 확정", "결제 즉시 확정 문자"]];

// 07 — 예약
export function BookingSection() {
  const { config, pay } = useStay();
  return <section className="lm-section lm-reserve" id="reserve" aria-labelledby="lm-reserve-title">
    <div className="lm-wrap">
      <div className="lm-head lm-reserve-head">
        <div>
          <p className="lm-label" data-reveal><b>07</b><span>RESERVE</span></p>
          <h2 className="lm-h2" id="lm-reserve-title" data-reveal>머무를 날을<br />골라 보세요</h2>
        </div>
        <ol className="lm-steps" data-reveal>{(pay ? PAY_STEPS : STEPS).map(([n, title, body], i) => <li key={n} style={{ ["--i" as string]: i }}><span>{n}</span><b>{title}</b><small>{body}</small></li>)}</ol>
      </div>
      {config.notice && <p className="lm-notice" data-reveal>{config.notice}</p>}
      <div data-reveal><RoomSwitch /></div>
      <div className="lm-reserve-grid" data-reveal>
        <CalendarCard />
        <Summary />
      </div>
      <Lookup />
    </div>
    <RequestDialog />
  </section>;
}

// 휴대폰 하단 고정 바 — 날짜를 다 고르면 '예약·결제'(또는 '예약 신청') 버튼이 된다
export function MobileBar() {
  const { room, roomOpen, checkIn, checkOut, nights, guests, fromPrice, calendar, dialogOpen, setDialogOpen, pay, payNow } = useStay();
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
  const ready = !!nights && !!calendar && roomOpen;
  const from = fromPrice();
  return <div className="lm-mobilebar" data-shown={(shown && !dialogOpen) || undefined}>
    <div>
      {nights ? <><b>{shortDate(checkIn)} → {shortDate(checkOut)}</b><small>{ROOMS[room].name} · {nights}박 · {guests}명</small></>
        : <><b>{from !== null ? `1박 ${won(from)}부터` : "LIMEN · 연남동"}</b><small>{checkIn ? "체크아웃 날짜를 골라 주세요" : pay ? "카드 결제 후 바로 예약 확정" : "신청 단계에서는 결제하지 않아요"}</small></>}
    </div>
    <button type="button" className="lm-btn lm-btn-dark" onClick={() => (ready ? setDialogOpen(true) : goReserve())}>{ready ? (payNow ? "예약·결제" : "예약 신청") : inReserve ? "날짜 선택" : "예약하기"}</button>
  </div>;
}
