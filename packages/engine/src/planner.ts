/**
 * Derived daily planning — ported from the prototype's buildPlan/buildPlanFor.
 *
 * Contract:
 *  - free slots = study window minus busy periods, gaps < 20 min dropped
 *  - revisions (due topics, weakest box first) placed before forward work
 *  - forward work ranked by: weight + exam proximity bonus + unstarted bias
 *  - excluded topics (carried today) never double-booked
 *  - stable item uid = `t_<topicId>` (planDone survives re-solves — F21)
 */
import { type Topic, type PlanItem, type Exam, type Slot } from './types';
import { revMinutes } from './srs';

export type BusyPeriod = [startMin: number, endMin: number];

export const STUDY_WINDOW = { start: 16 * 60, end: 22 * 60 + 30 } as const;
const MIN_SLOT = 20;
const GAP_AFTER = 10;

/** Derive free study slots for a day. Pure. */
export function freeSlots(busy: readonly BusyPeriod[], window = STUDY_WINDOW): Slot[] {
  const sorted = [...busy].sort((a, b) => a[0] - b[0]);
  const slots: Slot[] = [];
  let cur = window.start;
  for (const [bs, be] of sorted) {
    if (bs > cur) slots.push({ start: cur, end: Math.min(bs, window.end) });
    cur = Math.max(cur, be);
    if (cur >= window.end) break;
  }
  if (cur < window.end) slots.push({ start: cur, end: window.end });
  return slots.filter(s => s.end - s.start >= MIN_SLOT);
}

export function slotMinutes(slots: readonly Slot[]): number {
  return slots.reduce((a, s) => a + (s.end - s.start), 0);
}

const daysUntil = (exam: Exam, aheadDays: number): number => {
  const start = Date.parse(exam.windowStart + 'T00:00:00Z') / 86_400_000;
  const today = Date.parse('2026-08-21T00:00:00Z') / 86_400_000 + aheadDays;
  return Math.max(0, Math.round(start - today));
};

export interface BuildDayOpts {
  excludeTopicIds?: readonly string[];
  maxItems?: number;
  /** real slots come from the caller (needs the day's timetable); defaults to full study window */
  slots?: readonly Slot[];
}

/**
 * Build a day plan. Pure function.
 * @param daysAhead 0 = today, 1 = tomorrow… drives revision due-window & exam proximity
 */
export function buildDayPlan(
  topics: readonly Topic[],
  exams: readonly Exam[],
  daysAhead: number,
  opts: BuildDayOpts = {},
): PlanItem[] {
  const excl = new Set(opts.excludeTopicIds ?? []);
  const maxItems = opts.maxItems ?? 6;

  // 1. due revisions (dueIn <= daysAhead), weakest box first
  const due = topics
    .filter(t => t.box > 0 && t.box < 5 && t.dueIn <= daysAhead && t.dueIn >= -1 && !excl.has(t.id))
    .sort((a, b) => a.box - b.box || b.weight - a.weight);

  // 2. forward work ranked: weight + exam proximity (closer ⇒ hotter) + unstarted bias
  const scored = topics
    .filter(t => !due.includes(t) && !excl.has(t.id))
    .map(t => {
      let score = t.weight;
      const ex = exams.find(e => e.subjectIds.includes(t.subjectId));
      if (ex) score += Math.max(0, 40 - daysUntil(ex, daysAhead) * 6);
      if (t.box === 0) score += 15;
      return { t, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.t);

  // 3. place into free slots with a cursor that hops to the next slot when one fills
  const slots = opts.slots ?? [{ start: STUDY_WINDOW.start, end: STUDY_WINDOW.end }];
  const items: PlanItem[] = [];
  let si = 0;
  let cursor: number | null = null;

  const place = (dur: number): number | null => {
    for (; si < slots.length; si++) {
      const s = slots[si]!;
      if (cursor === null || cursor < s.start) cursor = s.start;
      const c: number = cursor;
      if (c + dur <= s.end) {
        cursor = c + dur + GAP_AFTER;
        return c;
      }
      cursor = null; // slot exhausted → try next
    }
    return null;
  };

  for (const t of due) {
    if (items.length >= maxItems) break;
    const st = place(revMinutes(t.box));
    if (st === null) break;
    items.push({
      uid: `t_${t.id}`,
      kind: 'rev',
      topic: t,
      durationMin: revMinutes(t.box),
      startMin: st,
      why: `Revision due · box ${t.box}/5`,
    });
  }
  for (const t of scored) {
    if (items.length >= maxItems) break;
    const st = place(40);
    if (st === null) break;
    const ex = exams.find(e => e.subjectIds.includes(t.subjectId));
    items.push({
      uid: `t_${t.id}`,
      kind: 'new',
      topic: t,
      durationMin: 40,
      startMin: st,
      examLinked: !!ex,
      why: ex ? `Exam in ${daysUntil(ex, daysAhead)}d covers this` : (t.box === 0 ? 'Not started yet' : 'Weak topic'),
    });
  }
  return items;
}
