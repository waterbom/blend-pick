import type { ReviewSummary } from "@/components/ReviewSection";
import { formatKstScheduleTime, kstDayKey, saleCalendarRange } from "@/lib/groupbuy-calendar";
import styles from "@/components/blend/ProductHeading.module.css";

export default function ProductHeading({ name, brand, category, saleState, saleStartMs, saleEndMs, nowMs, soldOut, reviewSummary }: {
  name: string;
  brand: string;
  category: string;
  saleState: "upcoming" | "open" | "ended";
  saleStartMs: number | null;
  saleEndMs: number | null;
  nowMs: number;
  soldOut: boolean;
  reviewSummary?: ReviewSummary;
}) {
  const state = saleState === "open" && soldOut ? "soldout" : saleState;
  const status = { upcoming: "오픈 예정", open: "공구 진행 중", ended: "공구 마감", soldout: "품절" }[state];
  const range = saleCalendarRange(saleStartMs, saleEndMs);
  // Compare KST calendar dates, rather than rounding a remaining-hours duration.
  const daysLeft = state === "open" && range.valid && range.endDay && saleEndMs !== null && saleEndMs >= nowMs
    ? Math.round((Date.parse(range.endDay) - Date.parse(kstDayKey(nowMs))) / 86_400_000)
    : null;
  const reviewCount = reviewSummary && reviewSummary.total > 0 ? reviewSummary.total : 0;
  const reviewAverage = reviewSummary && Number.isFinite(reviewSummary.average) && reviewSummary.average > 0 && reviewSummary.average <= 5
    ? reviewSummary.average.toFixed(1)
    : null;

  return <header className={styles.heading}>
    <div className={styles.badges}>
      {brand && <span className={styles.brand}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 21V3h12v18M3 21h18M9 21v-4h6v4M9 7h1m4 0h1M9 11h1m4 0h1" /></svg>
        <span>{brand}</span>
      </span>}
      <span className={styles.status} data-state={state}><span aria-hidden="true" />{status}</span>
      {daysLeft !== null && daysLeft >= 0 && <span className={styles.deadline} title={`한국시간 ${formatKstScheduleTime(saleEndMs!)} 마감`}>
        <svg width="15" height="17" viewBox="0 0 20 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 2c1 5 6 6 6 12a6 6 0 0 1-12 0c0-2 1-4 3-6 0 3 2 4 3 4 2-3 1-6 0-10Z" /></svg>
        {daysLeft === 0 ? "오늘 마감" : `마감 D-${daysLeft}`}
      </span>}
    </div>
    <h1>{name}</h1>
    {(category || reviewCount > 0) && <div className={styles.meta}>
      {category && <span>{category}</span>}
      {category && reviewCount > 0 && <span className={styles.separator} aria-hidden="true" />}
      {reviewCount > 0 && <a href="#review" className={styles.reviews}>
        {reviewAverage && <><span className={styles.star} aria-hidden="true">★</span><span aria-label={`평점 ${reviewAverage}점`}>{reviewAverage}</span></>}
        <span>리뷰 {reviewCount.toLocaleString("ko-KR")}개</span>
      </a>}
    </div>}
  </header>;
}
