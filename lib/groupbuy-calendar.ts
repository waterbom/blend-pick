const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CalendarMonth { year: number; month: number }
export interface SaleCalendarRange {
  startMs: number | null;
  endMs: number | null;
  startDay: string | null;
  endDay: string | null;
  valid: boolean;
  hasSchedule: boolean;
}

export function kstDayKey(timestamp: number): string {
  return new Date(timestamp + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function saleCalendarRange(startMs: number | null, endMs: number | null): SaleCalendarRange {
  const validTimestamp = (value: number | null) => value === null ||
    (Number.isFinite(value) && Number.isFinite(new Date(value + KST_OFFSET_MS).getTime()));
  const valid = validTimestamp(startMs) && validTimestamp(endMs) &&
    (startMs === null || endMs === null || startMs <= endMs);
  return {
    startMs, endMs, valid, hasSchedule: startMs !== null || endMs !== null,
    startDay: valid && startMs !== null ? kstDayKey(startMs) : null,
    endDay: valid && endMs !== null ? kstDayKey(endMs) : null,
  };
}

export function saleCalendarStatus(range: SaleCalendarRange, nowMs: number): "upcoming" | "open" | "ended" | "unscheduled" | "invalid" {
  if (!range.valid) return "invalid";
  if (!range.hasSchedule) return "unscheduled";
  if (range.startMs !== null && nowMs < range.startMs) return "upcoming";
  if (range.endMs !== null && nowMs > range.endMs) return "ended";
  return "open";
}

/** Only registered dates are painted when one endpoint is missing. */
export function isScheduledSaleDay(day: string, range: SaleCalendarRange): boolean {
  if (!range.valid || !range.hasSchedule) return false;
  if (range.startDay && range.endDay) return day >= range.startDay && day <= range.endDay;
  return day === range.startDay || day === range.endDay;
}

export function initialCalendarDay(range: SaleCalendarRange, nowMs: number): string {
  const today = kstDayKey(nowMs);
  if (!range.valid) return today;
  if (range.startDay && today < range.startDay) return range.startDay;
  if (range.endDay && today > range.endDay) return range.endDay;
  return today;
}

export function calendarMonthFor(day: string): CalendarMonth {
  const [year, month] = day.split("-").map(Number);
  return { year, month };
}

export function shiftCalendarMonth(current: CalendarMonth, amount: number): CalendarMonth {
  const shifted = new Date(Date.UTC(current.year, current.month - 1 + amount, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export function calendarMonthDays(month: CalendarMonth) {
  const first = Date.UTC(month.year, month.month - 1, 1);
  const weekday = new Date(first).getUTCDay();
  const count = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const cells = Math.ceil((weekday + count) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const date = new Date(first + (index - weekday) * DAY_MS);
    return {
      key: date.toISOString().slice(0, 10), day: date.getUTCDate(), weekday: date.getUTCDay(),
      inMonth: date.getUTCMonth() + 1 === month.month,
    };
  });
}

export function formatKstScheduleTime(timestamp: number): string {
  const date = new Date(timestamp + KST_OFFSET_MS);
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")} ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}
