const kstDate = (value: string | Date) => new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10);
export function settlementInPeriod(value: string | Date, period?: string, now = new Date()) {
    const day = kstDate(value), today = kstDate(now);
    if (period === 'today') return day === today;
    if (period === 'month') return day.slice(0, 7) === today.slice(0, 7);
    if (period === 'week') {
        const monday = new Date(today + 'T00:00:00Z');
        monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
        return day >= monday.toISOString().slice(0, 10) && day <= today;
    }
    return true;
}
export function settlementTotal(rows: { settled_at: string | Date; net_amount: number | null }[], period?: string, now = new Date()): number | null {
    const selected = rows.filter(s => settlementInPeriod(s.settled_at, period, now));
    return selected.some(s => s.net_amount == null) ? null : selected.reduce((n, s) => n + Number(s.net_amount), 0);
}
