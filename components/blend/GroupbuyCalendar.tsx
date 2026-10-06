"use client";

import { useId } from "react";
import {
  calendarMonthDays, calendarMonthFor, formatKstScheduleTime, initialCalendarDay,
  isScheduledSaleDay, kstDayKey, saleCalendarRange, saleCalendarStatus,
} from "@/lib/groupbuy-calendar";
import styles from "./GroupbuyCalendar.module.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS_LABELS = { upcoming: "오픈 예정", open: "공구 진행 중", ended: "공구 마감", unscheduled: "기간 미등록", invalid: "일정 확인 필요" };

export default function GroupbuyCalendar({ saleStartMs, saleEndMs, nowMs, soldOut = false, ended = false }: {
  saleStartMs: number | null;
  saleEndMs: number | null;
  nowMs: number;
  soldOut?: boolean;
  ended?: boolean;
}) {
  const titleId = useId();
  const range = saleCalendarRange(saleStartMs, saleEndMs);
  const today = kstDayKey(nowMs);
  const month = calendarMonthFor(initialCalendarDay(range, nowMs));
  const status = ended ? "ended" : saleCalendarStatus(range, nowMs);
  const days = calendarMonthDays(month);
  const rows = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));

  return <aside className={styles.dock} aria-labelledby={titleId}>
    <div className={styles.calendar}>
      <div className={styles.heading}>
        <h2 id={titleId}>공구 일정</h2>
        <span className={styles.status} data-state={status}>{status === "open" && soldOut ? "품절" : STATUS_LABELS[status]}</span>
      </div>
      <div className={styles.monthLabel}><strong>{month.year}년 {month.month}월</strong></div>
      <div className={styles.legend}>
        <span><i className={styles.periodKey} />{range.startDay && range.endDay ? "판매 기간" : "등록된 일정"}</span>
        <span><i className={styles.todayKey} />오늘</span>
      </div>
      <table className={styles.month} aria-label={`${month.year}년 ${month.month}월 공구 일정`}>
        <thead><tr>{WEEKDAYS.map((day, index) => <th key={day} scope="col" className={index === 0 ? styles.sunday : index === 6 ? styles.saturday : undefined}>{day}</th>)}</tr></thead>
        <tbody>{rows.map((week) => <tr key={week[0].key}>{week.map((day) => {
          const isToday = day.key === today;
          const isSaleDay = isScheduledSaleDay(day.key, range);
          return <td key={day.key}>
            <time
              dateTime={day.key}
              className={[styles.day, !day.inMonth && styles.outside, day.weekday === 0 && styles.sunday, day.weekday === 6 && styles.saturday, isSaleDay && styles.saleDay, isToday && styles.today].filter(Boolean).join(" ")}
              aria-label={`${day.key}${isToday ? ", 오늘" : ""}${isSaleDay ? ", 공구 일정" : ""}`}
              aria-current={isToday ? "date" : undefined}
            >{day.day}</time>
          </td>;
        })}</tr>)}</tbody>
      </table>
      <dl className={styles.schedule}>
        <div><dt>시작</dt><dd>{range.valid && range.startMs !== null ? <time dateTime={new Date(range.startMs).toISOString()}>{formatKstScheduleTime(range.startMs)}</time> : "시작일 미등록"}</dd></div>
        <div><dt>마감</dt><dd>{range.valid && range.endMs !== null ? <time dateTime={new Date(range.endMs).toISOString()}>{formatKstScheduleTime(range.endMs)}</time> : "종료일 미등록"}</dd></div>
      </dl>
      <p className={styles.note}>한국시간 기준 · 재고에 따라 조기 품절</p>
    </div>
  </aside>;
}
