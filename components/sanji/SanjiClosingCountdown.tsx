import { closingCountdown } from "@/lib/closing-countdown";

const twoDigits = (value: number) => String(value).padStart(2, "0");

export default function SanjiClosingCountdown({ end, now }: { end: string; now: number }) {
  const countdown = closingCountdown(end, now);
  if (!countdown) return null;
  return <div className={`sh-deadline ${countdown.urgency}`} role="timer" aria-live="off" aria-label={countdown.label} suppressHydrationWarning>
    <span className="sh-deadline-caption" aria-hidden="true" suppressHydrationWarning><i />{countdown.urgency === "urgent" ? "마감 임박 · 남은 시간" : "마감까지 남은 시간"}</span>
    <span className="sh-deadline-digits" aria-hidden="true">
      {countdown.days > 0 && <span className="sh-deadline-days" suppressHydrationWarning>{countdown.days}<small>일</small></span>}
      <span className="sh-deadline-clock"><b suppressHydrationWarning>{twoDigits(countdown.hours)}</b><i>:</i><b suppressHydrationWarning>{twoDigits(countdown.minutes)}</b><i>:</i><b suppressHydrationWarning>{twoDigits(countdown.seconds)}</b></span>
    </span>
  </div>;
}
