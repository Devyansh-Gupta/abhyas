/**
 * Marks → mastery recalibration (ported from saveTest, F11/F24; extended for
 * baseline marks at onboarding, M1c).
 *
 * Contract:
 *  - <40%: studied topics (box≥1) drop one box (floor 1) + dueIn 0 (due now);
 *          never-studied topics are untouched
 *  - ≥80%: topic steps UP one box — including box 0 → 1, so baseline marks can
 *          seed the ladder; box 5 ⇒ graduated (dueIn 99), else INTERVALS[box]
 *  - only that subject's topics touched; mastered (box 5) never move
 *  - returns NEW topic array (pure); caller persists
 */
import { type Topic } from './types';
import { intervalsFor, type LearningStyle } from './types';

export function recalibrate(topics: readonly Topic[], subjectId: string, pct: number, style: LearningStyle = 'average'): Topic[] {
  const iv = intervalsFor(style);
  return topics.map(t => {
    if (t.subjectId !== subjectId || t.box >= 5) return t;
    if (pct < 40) {
      if (t.box <= 0) return t;
      return { ...t, box: Math.max(1, t.box - 1), dueIn: 0 };
    }
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
