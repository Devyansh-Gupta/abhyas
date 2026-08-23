/**
 * Exam Season mode + gap-day engine (issue #9 / PRD M14).
 *
 * During an exam window the daily plan shifts toward exam-linked subjects;
 * confirmed-datesheet gaps (days between two papers) get boosted revision
 * capacity for those subjects; non-exam subjects taper. A capacity dial
 * (0.5–2.0) lets the user scale the season intensity.
 *
 * Pure TS, zero RN imports, deterministic: dates are explicit ISO strings
 * anchored to the same engine "today" as planner.ts.
 */
import { type Topic, type Exam, type SubjectEmoji } from './types';
import { STUDY_WINDOW } from './planner';

/** Engine clock anchor — must match planner.ts daysUntil's hardcoded today. */
export const ENGINE_TODAY_ANCHOR = '2026-08-21';

/** Capacity dial bounds (PRD M14 slider). */
export const CAPACITY_MIN = 0.5;
export const CAPACITY_MAX = 2.0;

/**
 * Window-model fallback: an exam entered with only a start date (no datesheet)
 * occupies this many days from windowStart (PRD: "exam name + month window"
 * minimum input; a school UT week is the common shape).
 */
export const DEFAULT_WINDOW_DAYS = 7;

/** The day immediately before a season's first paper still counts as in-season. */
export const EVE_DAYS = 1;

/** Extra multiplier applied to focus subjects on gap days between papers. */
export const GAP_DAY_BOOST = 1.3;

/** Weight multiplier for subjects with no active exam while season is on. */
export const TAPER_FACTOR = 0.5;

const DAY_MS = 86_400_000;

const toDay = (iso: string): number => Date.parse(iso + 'T00:00:00Z') / DAY_MS;
const toIso = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** ISO date for a plan-relative day index (0 = engine today). Deterministic. */
export function dateForDayIndex(daysAhead: number): string {
  return toIso(toDay(ENGINE_TODAY_ANCHOR) + daysAhead);
}

export const clampCapacity = (dial: number): number =>
  Math.min(CAPACITY_MAX, Math.max(CAPACITY_MIN, dial));

interface ActiveSeason {
  focusSubjects: Set<SubjectEmoji>;
  firstDay: number;
  lastDay: number;
  paperDays: number[] | null; // exact dates only (confirmed datesheet)
}

/** Which exams overlap `date`, and their union of subject ids. Pure. */
export function activeSeason(exams: readonly Exam[], day: number): ActiveSeason | null {
  let first = Infinity;
  let last = -Infinity;
  const focus = new Set<SubjectEmoji>();
  const paperDays: number[] = [];

  for (const ex of exams) {
    const start = toDay(ex.windowStart);
    // datesheet-confirmed exams span exactly first..last paper; otherwise the
    // declared window (or a DEFAULT_WINDOW_DAYS fallback from windowStart)
    const end =
      ex.datesheetConfirmed && ex.exactDates && ex.exactDates.length > 0
        ? Math.max(start, ...ex.exactDates.map(toDay))
        : ex.windowEnd
          ? toDay(ex.windowEnd)
          : start + DEFAULT_WINDOW_DAYS - 1;

    if (day >= start - EVE_DAYS && day <= end) {
      first = Math.min(first, start);
      last = Math.max(last, end);
      for (const s of ex.subjectIds) focus.add(s);
      if (ex.datesheetConfirmed && ex.exactDates) {
        for (const d of ex.exactDates) paperDays.push(toDay(d));
      }
    }
  }
  if (first === Infinity) return null;
  return { focusSubjects: focus, firstDay: first, lastDay: last, paperDays: paperDays.length ? paperDays : null };
}

export interface ExamSeasonResult {
  /** True when `date` falls inside (or one eve-day before) any exam window. */
  active: boolean;
  /** Confirmed datesheet only: day strictly between two consecutive papers. */
  gapDay: boolean;
  /** An exact paper falls on `date` itself. */
  paperToday: boolean;
  /** Subjects with a paper in the currently-active exam window(s). */
  focusSubjects: SubjectEmoji[];
  /** clamp(dial) × gap-day boost — applied to focus-subject weights & capacity. */
  capacityMultiplier: number;
  /** Study-window minutes × capacityMultiplier, i.e. today's target minutes. */
  capacityMinutes: number;
  /**
   * Dated plan adjustment: topic copies with weights re-scaled
   * (focus × multiplier, others × TAPER_FACTOR during season).
   * Same array reference as the input when the season is inactive.
   */
  topics: readonly Topic[];
}

/**
 * Apply Exam Season adjustments for one dated plan build. Pure:
 * inputs are never mutated; inactive days return the input topics untouched.
 */
export function applyExamSeason(
  topics: readonly Topic[],
  exams: readonly Exam[],
  date: string,
  dial = 1.0,
): ExamSeasonResult {
  const day = toDay(date);
  const base: ExamSeasonResult = {
    active: false,
    gapDay: false,
    paperToday: false,
    focusSubjects: [],
    capacityMultiplier: clampCapacity(dial),
    capacityMinutes: Math.round((STUDY_WINDOW.end - STUDY_WINDOW.start) * clampCapacity(dial)),
    topics,
  };

  const season = activeSeason(exams, day);
  // in-season also covers the eve of the first paper (boundary rule)
  const eveActive = season !== null && day >= season.firstDay - EVE_DAYS && day < season.firstDay;
  if (!season || (day > season.lastDay && !eveActive)) return base;
  if (eveActive) {
    // eve of first paper: full focus, no gap semantics yet
    return {
      ...base,
      active: true,
      focusSubjects: [...season.focusSubjects].sort(),
      topics: adjust(topics, season.focusSubjects, base.capacityMultiplier),
    };
  }

  const papers = (season.paperDays ?? []).slice().sort((a, b) => a - b);
  const gapDay =
    papers.length >= 2 &&
    papers.some((p, i) => i > 0 && day > papers[i - 1]! && day < p);
  const paperToday = papers.includes(day);

  const multiplier = base.capacityMultiplier * (gapDay ? GAP_DAY_BOOST : 1);
  return {
    active: true,
    gapDay,
    paperToday,
    focusSubjects: [...season.focusSubjects].sort(),
    capacityMultiplier: multiplier,
    capacityMinutes: Math.round((STUDY_WINDOW.end - STUDY_WINDOW.start) * multiplier),
    topics: adjust(topics, season.focusSubjects, multiplier),
  };
}

function adjust(topics: readonly Topic[], focus: Set<SubjectEmoji>, mult: number): Topic[] {
  return topics.map(t => {
    if (focus.has(t.subjectId)) {
      const w = Math.max(1, Math.round(t.weight * mult));
      return w === t.weight ? t : { ...t, weight: w };
    }
    return { ...t, weight: Math.max(1, Math.round(t.weight * TAPER_FACTOR)) };
  });
}
