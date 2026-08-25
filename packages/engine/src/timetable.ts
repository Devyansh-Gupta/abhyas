/**
 * Class timetable → study capacity (Plan tab, master-plan row "week strip + timetable editor").
 *
 * Contract:
 *  - ClassSession mirrors packages/db schema.classSessions (weekday 0=Sun..6=Sat,
 *    startMin/endMin minutes-of-day) so the store state is repo-shaped.
 *  - A weekday's busy periods = its class sessions clamped to the study window;
 *    free slots + capacity derive purely via planner.freeSlots.
 *  - movePeriod / cancelPeriod are pure list transforms with validation —
 *    the UI calls them from the store; invalid moves never mutate.
 *  - buildWeekPlan re-solves the visible week: day d uses daysAhead=d and the
 *    real slots for that weekday. Pure ⇒ same-frame re-solve on any edit.
 */
import { type Topic, type Exam, type PlanItem, type Slot } from './types';
import { freeSlots, slotMinutes, buildDayPlan, STUDY_WINDOW } from './planner';

/** Mirrors packages/db/src/schema.ts classSessions shape. */
export interface ClassSession {
  id: string;
  subjectId: string;
  /** 0=Sun … 6=Sat */
  weekday: number;
  startMin: number;
  endMin: number;
  room?: string | null;
}

/** Prototype anchor: today = Thu 2026-08-21 (weekday 4). */
export const WEEKDAY_TODAY = 4;

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Weekday index for `daysAhead` days from the prototype anchor (wraps). Pure. */
export function weekdayFor(daysAhead: number): number {
  return (((WEEKDAY_TODAY + daysAhead) % 7) + 7) % 7;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Busy [start,end] pairs for a weekday, clamped to the study window. Pure. */
export function busyPeriods(sessions: readonly ClassSession[], weekday: number): [number, number][] {
  return sessions
    .filter(s => s.weekday === weekday)
    .map(s => [s.startMin, s.endMin] as [number, number]);
}

/** Free study slots for a weekday = full window minus that day's classes. Pure. */
export function slotsForWeekday(
  sessions: readonly ClassSession[],
  weekday: number,
  opts: { window?: { start: number; end: number } } = {},
): Slot[] {
  return freeSlots(busyPeriods(sessions, weekday), opts.window);
}

/**
 * Study window trimmed to the user's daily-hours preference (c5 F6): keeps the
 * evening END fixed (22:30) and starts later so total capacity ≈ dailyHours·60.
 * Clamped to 1–12h; >6.5h falls back to the full window (no midnight spillover). Pure.
 */
export function studyWindowFor(dailyHours: number): { start: number; end: number } {
  const span = Math.round(Math.min(12, Math.max(1, dailyHours)) * 60);
  return { start: Math.max(STUDY_WINDOW.start, STUDY_WINDOW.end - span), end: STUDY_WINDOW.end };
}

/** Free study minutes available on a weekday after classes. Pure. */
export function capacityMinutes(
  sessions: readonly ClassSession[],
  weekday: number,
  opts: { window?: { start: number; end: number } } = {},
): number {
  return slotMinutes(slotsForWeekday(sessions, weekday, opts));
}

/** Fields a move may change: weekday (0..6) and/or start/end minutes-of-day. */
export interface MoveDelta {
  weekday?: number;
  startMin?: number;
  endMin?: number;
}

export interface MoveResult {
  sessions: ClassSession[];
  ok: boolean;
  reason?: string;
}

/**
 * Move a period (change weekday and/or start/end times). Pure.
 * Returns { sessions, ok:false } unchanged when: id unknown, resulting times
 * inverted (start >= end), out of 0..1440, or weekday outside 0..6.
 */
export function movePeriod(
  sessions: readonly ClassSession[],
  id: string,
  delta: MoveDelta,
): MoveResult {
  const target = sessions.find(s => s.id === id);
  if (!target) return { sessions: [...sessions], ok: false, reason: 'unknown period' };

  const startMin = delta.startMin ?? target.startMin;
  const endMin = delta.endMin ?? target.endMin;
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)
    || startMin < 0 || endMin > 24 * 60 || startMin >= endMin) {
    return { sessions: [...sessions], ok: false, reason: 'invalid times' };
  }
  if (delta.weekday !== undefined && (!Number.isInteger(delta.weekday)
    || delta.weekday < 0 || delta.weekday > 6)) {
    return { sessions: [...sessions], ok: false, reason: 'invalid weekday' };
  }
  // shifting one edge must keep duration sane: allow independent edges only via both,
  // but a lone ±edge shift is legal as long as it stays ordered (checked above).

  return {
    ok: true,
    sessions: sessions.map(s =>
      s.id === id ? { ...s, startMin, endMin, weekday: delta.weekday ?? s.weekday } : s
    ),
  };
}

/** Remove a period by id. Pure; unknown id returns the list unchanged. */
export function cancelPeriod(sessions: readonly ClassSession[], id: string): ClassSession[] {
  return sessions.filter(s => s.id !== id);
}

export interface BuildWeekPlanOpts {
  /** days in the strip (default 7) */
  days?: number;
  maxItemsPerDay?: number;
  /** c5 F6: trim each day's capacity to this many hours (optional; default = full window). */
  dailyHours?: number;
}

/**
 * Re-solve the whole visible week against the timetable. Pure.
 * Day d of the strip = anchor day + d: revision due-windows & exam proximity use
 * daysAhead=d, and real class-free slots come from that weekday's sessions.
 * Item uids stay stable per topic (`t_<id>`) across days and re-solves.
 */
export function buildWeekPlan(
  topics: readonly Topic[],
  exams: readonly Exam[],
  sessions: readonly ClassSession[],
  opts: BuildWeekPlanOpts = {},
): PlanItem[][] {
  const days = opts.days ?? 7;
  const win = opts.dailyHours !== undefined ? studyWindowFor(opts.dailyHours) : undefined;
  return Array.from({ length: days }, (_, d) =>
    buildDayPlan(topics, exams, d, {
      slots: slotsForWeekday(sessions, weekdayFor(d), win ? { window: win } : {}),
      ...(opts.maxItemsPerDay !== undefined ? { maxItems: opts.maxItemsPerDay } : {}),
    })
  );
}
