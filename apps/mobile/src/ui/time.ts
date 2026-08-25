/**
 * Clock-time rendering helper (c5 F7). All user-facing wall-clock times —
 * Plan class periods and study-block starts, Today block ranges — route
 * through fmtClock so the Settings 12h/24h preference actually works.
 * Focus-timer digits are durations (mm:ss) and deliberately stay out of this.
 */
import type { TimeFormat } from '../persistence';

export type { TimeFormat };

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Normalize minutes-since-midnight into 0..1439 (accepts end-of-day overflow). */
const norm = (m: number): number => ((m % 1440) + 1440) % 1440;

/** Accept minutes since midnight, or an existing 'HH:MM' string. Pure. */
export function toMinutes(value: number | string): number {
  if (typeof value === 'number') return norm(Math.round(value));
  const [h, m] = value.split(':').map(Number);
  return norm(h * 60 + (m || 0));
}

/**
 * Format a clock time in the given mode. Pure.
 *  - '24' → '17:30'
 *  - '12' → '5:30 PM'
 */
export function fmtClock(value: number | string, format: TimeFormat = '24'): string {
  const m = toMinutes(value);
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  if (format === '12') {
    const period = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${pad2(mm)} ${period}`;
  }
  return `${pad2(h24)}:${pad2(mm)}`;
}
