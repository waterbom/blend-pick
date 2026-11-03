export function closingCountdown(end: string, now: number) {
  const remaining = Date.parse(end) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  // Keep the final fraction of a second visible until the actual deadline.
  const total = Math.ceil(remaining / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor(total % 86400 / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const seconds = total % 60;
  const urgency = remaining <= 24 * 3600000 ? "urgent" : remaining <= 48 * 3600000 ? "soon" : "scheduled";
  return {
    days, hours, minutes, seconds, urgency,
    label: `마감까지 ${days ? `${days}일 ` : ""}${hours}시간 ${minutes}분 ${seconds}초 남음`,
  };
}
