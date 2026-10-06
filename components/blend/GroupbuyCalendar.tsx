"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  calendarMonthDays, calendarMonthFor, formatKstScheduleTime, initialCalendarDay,
  isScheduledSaleDay, kstDayKey, saleCalendarRange, saleCalendarStatus, shiftCalendarMonth,
} from "@/lib/groupbuy-calendar";
import styles from "./GroupbuyCalendar.module.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS_LABELS = { upcoming: "오픈 예정", open: "공구 진행 중", ended: "공구 종료", unscheduled: "기간 미등록", invalid: "일정 확인 필요" };

export default function GroupbuyCalendar({ saleStartMs, saleEndMs, nowMs, soldOut = false }: {
  saleStartMs: number | null;
  saleEndMs: number | null;
  nowMs: number;
  soldOut?: boolean;
}) {
  const titleId = useId();
  const panelId = useId();
  const dockRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const focusPopup = useRef(false);
  const [wideScreen, setWideScreen] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? wideScreen;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => { setWideScreen(query.matches); setOpen(null); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (restoreFocus.current) { launcherRef.current?.focus(); restoreFocus.current = false; }
      return;
    }
    if (focusPopup.current) {
      panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      focusPopup.current = false;
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dockRef.current?.contains(document.activeElement)) {
        restoreFocus.current = true;
        setOpen(false);
      }
    };
    const outside = (event: PointerEvent) => {
      if (!wideScreen && !dockRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("pointerdown", outside);
    };
  }, [isOpen, wideScreen]);
  const range = saleCalendarRange(saleStartMs, saleEndMs);
  const [selected, setSelected] = useState(() => initialCalendarDay(range, nowMs));
  const [month, setMonth] = useState(() => calendarMonthFor(initialCalendarDay(range, nowMs)));
  const today = kstDayKey(nowMs);
  const status = saleCalendarStatus(range, nowMs);
  const days = calendarMonthDays(month);
  const rows = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const selectedDate = new Date(`${selected}T00:00:00Z`);
  const selectedLabel = `${selectedDate.getUTCMonth() + 1}월 ${selectedDate.getUTCDate()}일 ${WEEKDAYS[selectedDate.getUTCDay()]}요일`;
  const selectedMessage = !range.valid ? "등록된 공구 일정을 확인해 주세요."
    : !range.hasSchedule ? "등록된 판매 기간이 없어요."
    : selected === range.startDay && selected === range.endDay ? "공구 시작·종료일이에요."
    : selected === range.startDay ? "공구 시작일이에요."
    : selected === range.endDay ? "공구 종료일이에요."
    : range.startDay && range.endDay ? isScheduledSaleDay(selected, range) ? "공구 판매 기간에 포함된 날짜예요." : "공구 판매 기간이 아니에요."
    : "판매 시작일과 종료일 중 일부만 등록되어 있어요.";

  function selectDay(day: string) {
    setSelected(day);
    setMonth(calendarMonthFor(day));
  }

  return <aside ref={dockRef} className={styles.dock} aria-label="공구 일정" data-open={isOpen}>
    <button ref={launcherRef} type="button" className={styles.launcher} aria-expanded={isOpen} aria-controls={panelId} onClick={() => { focusPopup.current = true; setOpen(true); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></svg>
      공구 일정 보기 <span aria-hidden="true">↗</span>
    </button>
    <div ref={panelRef} id={panelId} hidden={!isOpen} className={styles.calendar} aria-labelledby={titleId}>
    <div className={styles.heading}>
      <h2 id={titleId}>공구 일정</h2>
      <span className={styles.status} data-state={status}>{status === "open" && soldOut ? "품절" : STATUS_LABELS[status]}</span>
      <button type="button" className={styles.close} aria-label="공구 일정 닫기" onClick={() => { restoreFocus.current = true; setOpen(false); }}>×</button>
    </div>

    <div className={styles.monthNavigation}>
      <button type="button" aria-label="이전 달" onClick={() => setMonth(current => shiftCalendarMonth(current, -1))}>‹</button>
      <strong aria-live="polite">{month.year}년 {month.month}월</strong>
      <button type="button" className={styles.todayButton} onClick={() => selectDay(today)}>오늘</button>
      <button type="button" aria-label="다음 달" onClick={() => setMonth(current => shiftCalendarMonth(current, 1))}>›</button>
    </div>

    <div className={styles.legend}>
      <span><i className={styles.periodKey} />{range.startDay && range.endDay ? "판매 기간" : "등록된 일정"}</span>
      <span><i className={styles.todayKey} />오늘</span>
      <span><i className={styles.selectedKey} />선택일</span>
    </div>

    <table className={styles.month} aria-label={`${month.year}년 ${month.month}월 공구 일정`}>
      <thead><tr>{WEEKDAYS.map((day, index) => <th key={day} scope="col" className={index === 0 ? styles.sunday : index === 6 ? styles.saturday : undefined}>{day}</th>)}</tr></thead>
      <tbody>{rows.map((week) => <tr key={week[0].key}>{week.map((day) => {
        const isToday = day.key === today;
        const isSelected = day.key === selected;
        const isSaleDay = isScheduledSaleDay(day.key, range);
        return <td key={day.key}><button
          type="button"
          className={[styles.day, !day.inMonth && styles.outside, day.weekday === 0 && styles.sunday, day.weekday === 6 && styles.saturday, isSaleDay && styles.saleDay, isToday && styles.today, isSelected && styles.selected].filter(Boolean).join(" ")}
          onClick={() => selectDay(day.key)}
          aria-label={`${day.key}${isToday ? ", 오늘" : ""}${isSaleDay ? ", 공구 일정" : ""}`}
          aria-current={isToday ? "date" : undefined}
          aria-pressed={isSelected}
        >{day.day}{isToday && <span className={styles.todayDot} aria-hidden="true" />}</button></td>;
      })}</tr>)}</tbody>
    </table>

    <p className={styles.srOnly} aria-live="polite">{selectedLabel} · {selectedMessage}</p>
    <dl className={styles.schedule}>
      <div><dt>시작</dt><dd>{range.valid && range.startMs !== null ? <button type="button" aria-label="공구 시작일로 이동" onClick={() => selectDay(range.startDay!)}><time dateTime={new Date(range.startMs).toISOString()}>{formatKstScheduleTime(range.startMs)}</time></button> : "시작일 미등록"}</dd></div>
      <div><dt>마감</dt><dd>{range.valid && range.endMs !== null ? <button type="button" aria-label="공구 종료일로 이동" onClick={() => selectDay(range.endDay!)}><time dateTime={new Date(range.endMs).toISOString()}>{formatKstScheduleTime(range.endMs)}</time></button> : "종료일 미등록"}</dd></div>
    </dl>
    <p className={styles.note}>한국시간 기준 · 재고에 따라 조기 품절</p>
    </div>
  </aside>;
}
