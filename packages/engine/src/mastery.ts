/**
 * Per-subject mastery derivation (#7) — pure view-model math for the
 * Subjects / Progress tabs. No RN imports; caller renders.
 *
 * Contract:
 *  - one entry per subject, in first-seen order
 *  - pct = mean(clamped box) ÷ 5 × 100, rounded (box 5 = mastered ⇒ 100)
 *  - out-of-range boxes clamp into [0,5] so bad data never skews bars
 */
import { type Topic } from './types';

export interface SubjectMastery {
  subjectId: string;
  /** 0–100 average mastery across the subject's topics */
  pct: number;
  /** topic count backing the bar (drives the "N topics" caption) */
  topics: number;
}

export function masteryBySubject(topics: readonly Topic[]): SubjectMastery[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const t of topics) {
    const a = acc.get(t.subjectId) ?? { sum: 0, n: 0 };
    a.sum += Math.min(5, Math.max(0, t.box));
    a.n += 1;
    acc.set(t.subjectId, a);
  }
  return [...acc.entries()].map(([subjectId, { sum, n }]) => ({
    subjectId,
    pct: Math.round((sum / (n * 5)) * 100),
    topics: n,
  }));
}
