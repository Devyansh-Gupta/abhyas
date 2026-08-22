/**
 * SRS (spaced repetition) transitions — ported from the prototype's proven logic
 * and pinned by the same golden cases as tests/srs.test.js.
 *
 * Contract:
 *  - rating 1 (Shaky): box −1, floored at 1
 *  - rating 2 (Getting there): box unchanged
 *  - rating 3 (Solid): box +1, capped at 5
 *  - dueIn always rescheduled via intervals[box]; box 5 ⇒ graduated (dueIn 99)
 */
import { BASE_INTERVALS, BOX_MINUTES, type Topic, type LearningStyle, intervalsFor } from './types.js';

export type Rating = 1 | 2 | 3;

export interface SrsState {
  box: number;
  dueIn: number;
}

/** Pure transition — no mutation. `style` personalizes intervals (learning dial). */
export function applyRating(state: SrsState, rating: Rating, style: LearningStyle = 'average'): SrsState {
  const iv = intervalsFor(style);
  let box = state.box;
  if (rating === 1) box = Math.max(1, box - 1);
  else if (rating === 3) box = Math.min(5, box + 1);
  // rating 2 → hold
  const dueIn = box >= 5 ? 99 : (iv[box] ?? BASE_INTERVALS[box] ?? 1);
  return { box, dueIn };
}

/** Revision block length in minutes for a topic's box.
 *  Deliberate engine improvement over the prototype: box indexes clamp into the
 *  table (prototype's `BOX_MIN[box]||20` gave box4→20 by accident). */
export function revMinutes(box: number): number {
  const idx = Math.min(Math.max(Math.round(box), 1), BOX_MINUTES.length - 1);
  return BOX_MINUTES[idx] ?? 20;
}

/** Topics currently due for revision, ordered by lowest box first (weakest first), capped. */
export function dueTopics(topics: Topic[], cap: number = 5): Topic[] {
  return topics
    .filter(t => t.box > 0 && t.box < 5 && t.dueIn <= 0)
    .sort((a, b) => a.box - b.box || b.weight - a.weight)
    .slice(0, cap);
}
