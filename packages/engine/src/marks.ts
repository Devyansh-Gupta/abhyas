/**
 * Marks → mastery recalibration (ported from saveTest, F11/F24).
 *
 * Contract:
 *  - <40%: drop one box (floor 1) + dueIn = -1 (due now)
 *  - ≥80%: promote one box; box 5 ⇒ graduated (dueIn 99), else INTERVALS[box]
 *  - only that subject's topics, box>0, box<5 are touched
 *  - returns NEW topic array (pure); caller persists
 */
import { type Topic } from './types.js';
import { intervalsFor, type LearningStyle } from './types.js';

export function recalibrate(topics: readonly Topic[], subjectId: string, pct: number, style: LearningStyle = 'average'): Topic[] {
  const iv = intervalsFor(style);
  return topics.map(t => {
    if (t.subjectId !== subjectId || t.box <= 0 || t.box >= 5) return t;
    if (pct < 40) return { ...t, box: Math.max(1, t.box - 1), dueIn: 0 };
    if (pct >= 80) {
      const box = Math.min(5, t.box + 1);
      return { ...t, box, dueIn: box >= 5 ? 99 : (iv[box] ?? 3) };
    }
    return t;
  });
}

/** Count of topics actually changed — drives the "N topics recalibrated" toast. */
export function countChanged(before: readonly Topic[], after: readonly Topic[]): number {
  let n = 0;
  for (let i = 0; i < before.length; i++) {
    const b = before[i]!;
    const a = after[i]!;
    if (b.box !== a.box || b.dueIn !== a.dueIn) n++;
  }
  return n;
}
