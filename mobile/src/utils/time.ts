/** How long ago something happened, rounded the way social apps show it. */
export type RelativeTime =
  | { unit: 'now' }
  | { unit: 'minutes' | 'hours' | 'days'; count: number }
  | { unit: 'date'; date: Date };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Parses PocketBase dates ("2026-11-05 10:00:00.000Z") and ISO dates. */
export function parseServerDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "now", minutes, hours or days up to a week; after that, the date itself. */
export function relativeTime(date: Date, now: Date = new Date()): RelativeTime {
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  if (elapsed < MINUTE) return { unit: 'now' };
  if (elapsed < HOUR) return { unit: 'minutes', count: Math.floor(elapsed / MINUTE) };
  if (elapsed < DAY) return { unit: 'hours', count: Math.floor(elapsed / HOUR) };
  if (elapsed < 7 * DAY) return { unit: 'days', count: Math.floor(elapsed / DAY) };
  return { unit: 'date', date };
}
