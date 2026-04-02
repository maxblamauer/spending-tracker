/**
 * Billing windows often cross a year (e.g. Dec → Jan). If both bounds were
 * normalized with the statement-closing year, the start can sort after the end
 * (e.g. 2026-12-04 … 2026-01-03), which makes inclusive day counts collapse to 1.
 * Pull the start back by whole years until end >= start (max 3 steps).
 */
export function reconcileBillingPeriod(
  periodStart: string,
  periodEnd: string,
): { periodStart: string; periodEnd: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    return { periodStart, periodEnd };
  }
  let start = periodStart;
  const end = periodEnd;
  let guard = 0;
  while (guard < 3) {
    const a = new Date(`${start}T12:00:00`);
    const b = new Date(`${end}T12:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return { periodStart, periodEnd };
    if (b >= a) return { periodStart: start, periodEnd: end };
    const yr = parseInt(start.slice(0, 4), 10) - 1;
    start = `${yr}-${start.slice(5)}`;
    guard++;
  }
  return { periodStart: start, periodEnd: end };
}

/** Inclusive calendar days after reconciling an inverted or cross-year period. */
export function billingPeriodInclusiveDays(periodStart: string, periodEnd: string): number {
  const { periodStart: s, periodEnd: e } = reconcileBillingPeriod(periodStart, periodEnd);
  if (!s || !e) return 1;
  const a = new Date(`${s}T12:00:00`);
  const b = new Date(`${e}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}
