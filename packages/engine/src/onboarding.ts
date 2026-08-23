/**
 * Onboarding state machine — pure reducer so it's golden-testable (F27 lesson:
 * engine tests miss UI gating; here the GATES are logic, not CSS).
 */
import type { LearningStyle } from './types';

export interface SubjectPick {
  emoji: string;
  name: string;
  kind: 'core' | 'elective' | 'additional';
  presetId?: string;
  custom?: boolean;
  removed?: boolean; // pre-ticked subject the student unchecked
}

export interface OnboardingState {
  step: number; // 0 persona … 8 done
  board: string;
  cls: number | null;
  stream: 'Science' | 'Commerce' | 'Humanities' | 'Vocational' | null;
  subjects: SubjectPick[];
  /** per-subject school progress: fraction covered (0, .25, .5, .75, 1) */
  coverage: Record<string, number>;
  baseline: Record<string, number>; // subjectEmoji → pct
  learningStyle: LearningStyle;
  hoursDone: boolean;
}

export const MAX_SUBJECTS = 8;
export const WARN_SUBJECTS = 6;

export function initOnboarding(): OnboardingState {
  return {
    step: 0,
    board: '',
    cls: null,
    stream: null,
    subjects: [],
    coverage: {},
    baseline: {},
    learningStyle: 'average',
    hoursDone: false,
  };
}

export type ObAction =
  | { t: 'next' }
  | { t: 'back' }
  | { t: 'setBoard', board: string }
  | { t: 'setClass', cls: number }
  | { t: 'setStream', s: NonNullable<OnboardingState['stream']> }
  | { t: 'toggleSubject', pick: SubjectPick }
  | { t: 'addCustom', name: string }
  | { t: 'removeSubject', emoji: string }
  | { t: 'setCoverage', emoji: string, frac: number }
  | { t: 'setBaseline', emoji: string, pct: number }
  | { t: 'setStyle', style: LearningStyle }
  | { t: 'hoursDone' };

/** Which steps apply for this student — stream only for 11–12.
 *  Screen sequence for 9–10: 0 persona, 1 board/class, 2 subjects, 3 coverage,
 *  4 baseline, 5 exams, 6 style. For 11–12 a stream screen inserts at 2. */
export function stepCount(s: OnboardingState): number {
  return s.cls !== null && s.cls >= 11 ? 8 : 7;
}

/** True when this state's step-2 screen is the (skipped) stream step. */
export function isStreamStep(s: OnboardingState): boolean {
  return s.step === 2 && s.cls !== null && s.cls >= 11;
}

/** What the current step SHOWS — single source of truth for the wizard UI.
 *  9–10:  persona, board, subjects, coverage, baseline, exams, style
 *  11–12: persona, board, stream, subjects, coverage, baseline, exams, style */
export type ScreenRole =
  | 'persona' | 'board' | 'stream' | 'subjects'
  | 'coverage' | 'baseline' | 'exams' | 'style';

export function screenFor(s: OnboardingState): ScreenRole {
  const senior = s.cls !== null && s.cls >= 11;
  const seq: ScreenRole[] = senior
    ? ['persona', 'board', 'stream', 'subjects', 'coverage', 'baseline', 'exams', 'style']
    : ['persona', 'board', 'subjects', 'coverage', 'baseline', 'exams', 'style'];
  return seq[Math.min(s.step, seq.length - 1)]!;
}

export function canAdvance(s: OnboardingState): boolean {
  switch (screenFor(s)) {
    case 'board': return !!s.board && s.cls !== null;
    case 'stream': return !!s.stream;
    case 'subjects': {
      const active = s.subjects.filter(x => !x.removed);
      return active.length >= 1 && active.length <= MAX_SUBJECTS;
    }
    default: return true; // coverage/baseline/exams/style skippable by design
  }
}

export function reduce(s: OnboardingState, a: ObAction): OnboardingState {
  switch (a.t) {
    case 'next': return canAdvance(s) ? { ...s, step: Math.min(s.step + 1, 8) } : s;
    case 'back': return { ...s, step: Math.max(0, s.step - 1) };
    case 'setBoard': return { ...s, board: a.board };
    case 'setClass': {
      const cls = a.cls;
      // 9–10: pre-tick fixed core subjects so review starts pre-populated (M1a draft)
      const base = cls >= 11 ? s.subjects : [
        { emoji: '📐', name: 'Mathematics', kind: 'core' as const },
        { emoji: '⚗️', name: 'Science', kind: 'core' as const },
        { emoji: '📖', name: 'English', kind: 'core' as const },
        { emoji: '🌏', name: 'Social Science', kind: 'core' as const },
      ];
      return { ...s, cls, subjects: base, stream: cls >= 11 ? s.stream : null };
    }
    case 'setStream': {
      const CORE_BY_STREAM: Record<string, SubjectPick[]> = {
        Science: [
          { emoji: '📐', name: 'Mathematics', kind: 'core' },
          { emoji: '⚛️', name: 'Physics', kind: 'core' },
          { emoji: '⚗️', name: 'Chemistry', kind: 'core' },
          { emoji: '🧬', name: 'Biology', kind: 'core' },
          { emoji: '📖', name: 'English Core', kind: 'core' },
        ],
        Commerce: [
          { emoji: '📒', name: 'Accountancy', kind: 'core' },
          { emoji: '🏢', name: 'Business Studies', kind: 'core' },
          { emoji: '📊', name: 'Economics', kind: 'core' },
          { emoji: '📐', name: 'Mathematics', kind: 'core' },
          { emoji: '📖', name: 'English Core', kind: 'core' },
        ],
        Humanities: [
          { emoji: '🏛️', name: 'History', kind: 'core' },
          { emoji: '🗺️', name: 'Geography', kind: 'core' },
          { emoji: '⚖️', name: 'Political Science', kind: 'core' },
          { emoji: '🧠', name: 'Psychology', kind: 'core' },
          { emoji: '📖', name: 'English Core', kind: 'core' },
        ],
        Vocational: [{ emoji: '📖', name: 'English Core', kind: 'core' }],
      };
      return { ...s, stream: a.s, subjects: s.cls !== null && s.cls >= 11 ? (CORE_BY_STREAM[a.s] ?? []) : s.subjects };
    }
    case 'toggleSubject':
      return {
        ...s,
        subjects: s.subjects.some(x => x.emoji === a.pick.emoji)
          ? s.subjects.map(x => (x.emoji === a.pick.emoji ? { ...x, removed: !x.removed } : x))
          : [...s.subjects, a.pick],
      };
    case 'addCustom': {
      const name = a.name.trim();
      if (!name) return s;
      if (s.subjects.some(x => x.name.toLowerCase() === name.toLowerCase())) return s;
      if (s.subjects.filter(x => !x.removed).length >= MAX_SUBJECTS) return s;
      return {
        ...s,
        subjects: [...s.subjects, { emoji: '📖', name, kind: 'elective', custom: true }],
      };
    }
    case 'removeSubject': return { ...s, subjects: s.subjects.filter(x => x.emoji !== a.emoji) };
    case 'setCoverage': return { ...s, coverage: { ...s.coverage, [a.emoji]: a.frac } };
    case 'setBaseline': return { ...s, baseline: { ...s.baseline, [a.emoji]: a.pct } };
    case 'setStyle': return { ...s, learningStyle: a.style };
    case 'hoursDone': return { ...s, hoursDone: true };
  }
}
