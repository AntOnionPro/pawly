/** How recent a listing or a case is: published today, in the last 7 days or the last 30. */
export const DATE_RANGES = ['day', 'week', 'month'] as const;
export type DateRange = (typeof DATE_RANGES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The start of a range: today at 00:00 on this phone, or 7 or 30 days ago. */
export function rangeStart(range: DateRange, now: Date = new Date()): Date {
  if (range === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return new Date(now.getTime() - (range === 'week' ? 7 : 30) * DAY_MS);
}
