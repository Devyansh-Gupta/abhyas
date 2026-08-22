/**
 * Core domain types for the Abhyas engine.
 * Kept framework-free and dependency-free — pure data + pure functions.
 */

/** The five mastery boxes; index = box level (0 unused, 1..5). Intervals in days. */
export const BASE_INTERVALS: readonly number[] = [0, 1, 3, 7, 16, 35] as const;

/** Learning-style dial → multiplier applied to every interval. */
export type LearningStyle = 'fast_forget' | 'average' | 'strong_memory';

export const STYLE_MULTIPLIER: Record<LearningStyle, number> = {
  fast_forget: 0.7,
  average: 1.0,
  strong_memory: 1.4,
};

/** Effective interval table for a given learning style (days, rounded). */
export function intervalsFor(style: LearningStyle): number[] {
  return BASE_INTERVALS.map(d => (d === 0 ? 0 : Math.max(1, Math.round(d * STYLE_MULTIPLIER[style]))));
}

/** Revision block length by box level (minutes), from prototype BOX_MIN. */
export const BOX_MINUTES: readonly number[] = [15, 20, 30, 40] as const;

/** Max revision items placed per day. */
export const REV_CAP = 5;

/** Max forward-work items carried across midnight. */
export const CARRY_MAX = 2;

/** Streak rule: a day qualifies with ≥1 completed block OR ≥ this many focus minutes. */
export const STREAK_RULE_MIN_MINUTES = 10;

export type TopicId = string;
export type SubjectEmoji = string;

export interface Subject {
  id: SubjectEmoji; // emoji doubles as stable id in v1 (prototype parity)
  name: string;
  /** core counts toward best-of-5 projection; elective is flagged for weighting */
  kind: 'core' | 'elective' | 'additional';
  origin: 'preset' | 'custom' | 'import' | 'community';
}

export type Coverage = 'unstarted' | 'in_progress' | 'covered';

export interface Topic {
  id: TopicId;
  subjectId: SubjectEmoji;
  name: string;
  /** spaced-repetition box, 0 = new/never studied, 5 = mastered */
  box: number;
  /** days until next review (≤0 means due now); 99 = graduated from rotation */
  dueIn: number;
  /** relative importance used by planner scoring (board weightage or manual) */
  weight: number;
  coverage: Coverage;
  /** covered-but-not-yet-revised pool (mid-year calibration) */
  backlog: boolean;
  sourceRef?: string; // preset topic id for year-rollover diffs
}

export type PlanItemKind = 'rev' | 'new';

export interface PlanItem {
  uid: string;
  kind: PlanItemKind;
  topic: Topic;
  durationMin: number;
  /** start minute-of-day, or null for "anytime" (carried items) */
  startMin: number | null;
  carried?: boolean;
  examLinked?: boolean;
  why?: string;
}

export type ExamKind = 'school' | 'board' | 'competitive';

/** A free study window in minutes-of-day. */
export interface Slot {
  start: number;
  end: number;
}

export interface Exam {
  id: string;
  name: string;
  kind: ExamKind;
  /** inclusive start of exam window (ISO date) */
  windowStart: string;
  /** optional end when datesheet known */
  windowEnd?: string;
  /** exact paper dates once datesheet confirmed — enables gap-day planning */
  exactDates?: string[];
  subjectIds: SubjectEmoji[];
  datesheetConfirmed: boolean;
}
