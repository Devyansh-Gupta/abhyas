/**
 * App store (Zustand) — single source of truth mirroring the prototype's state model.
 * Persistence adapter is injectable; SQLite repo lands in issue #8.
 */
import {
  type Topic, type Exam, type PlanItem, type LearningStyle,
  applyRating, buildDayPlan, computeCarry,
  initialStreak, bumpToday, rollover, type StreakState, type DayActivity,
  applyExamSeason, dateForDayIndex, clampCapacity,
  type ClassSession, type MoveDelta, type ClassPeriods,
  movePeriod, cancelPeriod, slotsForWeekday, weekdayFor, studyWindowFor,
  mergedClassSessions,
  createGuardianInvite, type GuardianInvite,
} from '@abhyas/engine';
import { create } from 'zustand';
import { type PersistenceAdapter, type Snapshot, type SubjectMeta, type TimeFormat } from './persistence';

export type { TimeFormat };
/** c5 F6: daily-hours knob bounds. */
export const DAILY_HOURS_MIN = 1;
export const DAILY_HOURS_MAX = 12;
export const DAILY_HOURS_DEFAULT = 2;

/** c5 L6: multi-topic sessions attribute their minutes — topicIds lists every bound topic. */
export interface SessionLogEntry { day: number; min: number; topicIds?: string[] }

interface AppState {
  // core data
  topics: Topic[];
  exams: Exam[];
  /** class timetable — mirrors packages/db schema.classSessions (weekday 0=Sun..6=Sat) */
  classSessions: ClassSession[];
  /** c5 L5: onboarding-authored per-weekday periods (weekday → start/end rows). */
  classPeriods: ClassPeriods;
  sessions: SessionLogEntry[];
  plan: PlanItem[];
  doneUids: Set<string>;
  dayIndex: number;
  learningStyle: LearningStyle;
  streak: StreakState;
  /** Exam Season capacity dial (#9): 0.5–2.0 multiplier on season intensity. */
  examSeasonDial: number;
  /** P2 parent-link invites minted on this device, newest last. */
  pendingGuardianInvites: GuardianInvite[];
  /** Cycle-4 lane A: subject display identity (name/color) by subjectId. */
  subjectMeta: Record<string, SubjectMeta>;
  /** c5 F6: daily study goal in hours (1–12); trims planner capacity. */
  dailyHours: number;
  /** c5 F7: user-facing clock format for plan/today time renders (timer stays mm:ss). */
  timeFormat: TimeFormat;
  /** c5 L1b: message of the last failed persistence save (degraded SQLite), or null. */
  lastSaveError: string | null;

  // actions
  checkItem(uid: string): void;
  rateTopic(uid: string, rating: 1 | 2 | 3): void;
  /** Subjects-tab rating path (#7): SRS move on any non-graduated topic, no session logged.
   *  Returns false when nothing applied (unknown or graduated topic) — UI must surface it. */
  rateByTopic(topicId: string, rating: 1 | 2 | 3): boolean;
  logSession(topicId: string, minutes: number): void;
  /** Focus-timer finish path: log minutes + optional confidence rating on any topic.
   *  c5 L6: `topicIds` (multi-topic session) is stored on the log entry so minutes
   *  are attributable to each bound topic; single-topic calls omit it. */
  finishFocus(opts: { topicId: string | null; minutes: number; rating?: 1 | 2 | 3; topicIds?: string[] }): void;
  addExam(exam: Exam): void;
  /** Exam Season capacity dial (#9): clamped to [0.5, 2]; applies at next plan build. */
  setExamSeasonDial(dial: number): void;
  /** Plan-tab timetable editor: upsert a period by id. Re-solves the derived plan same frame. */
  setClassSession(session: ClassSession): void;
  /** Move a period (weekday and/or start/end). Returns false on invalid move — UI must surface it. */
  moveClassPeriod(id: string, delta: MoveDelta): boolean;
  /** Cancel (remove) a period. Re-solves the derived plan same frame. */
  cancelClassPeriod(id: string): void;
  /** c5 L5: replace the onboarding-authored per-weekday periods wholesale. */
  setClassPeriods(periods: ClassPeriods): void;
  advanceDay(): { carried: number; droppedRevisions: number; droppedForward: number; broke: boolean };
  /** P2 parent link: mint a shareable invite (signed code + deep link), persisted. */
  createGuardianInvite(): GuardianInvite;
  /** c5 F6: set the daily study goal (clamped 1–12h). Re-solves the derived plan same frame. */
  setDailyHours(hours: number): void;
  /** c5 F7: switch user-facing clock rendering between 12h and 24h. */
  setTimeFormat(fmt: TimeFormat): void;
}

const todayActivity = (sessions: SessionLogEntry[], plan: PlanItem[], doneUids: Set<string>): DayActivity => ({
  blocksDone: plan.filter(p => doneUids.has(p.uid)).length,
  focusMinutes: sessions.reduce((a, s) => a + s.min, 0),
});

/**
 * Same-frame re-solve (Plan tab): rebuild today's derived plan against the current
 * timetable. Carried items keep their place; everything else is re-placed into the
 * real class-free slots for this weekday. Pure in its inputs — engine does the math.
 */
const resolveCurrentPlan = (
  topics: Topic[],
  exams: Exam[],
  classSessions: ClassSession[],
  plan: PlanItem[],
  dayIndex: number,
  dailyHours: number,
): PlanItem[] => {
  const carried = plan.filter(p => p.carried);
  const rest = buildDayPlan(topics, exams, 0, {
    excludeTopicIds: carried.map(c => c.topic.id),
    slots: slotsForWeekday(classSessions, weekdayFor(dayIndex), {
      window: studyWindowFor(dailyHours),
    }),
  });
  return [...carried, ...rest];
};

// --- injectable persistence seam (#8 prep) ---------------------------------

/** c5 L5: plan-tab sessions + onboarding-authored periods = full busy-time list. */
const timetableFor = (s: { classSessions: ClassSession[]; classPeriods: ClassPeriods }): ClassSession[] =>
  mergedClassSessions(s.classSessions, s.classPeriods);
let adapter: PersistenceAdapter | null = null;

/** Wire (or unwire, with `null`) a persistence backend. Default: none — memory only. */
export function configurePersistence(next: PersistenceAdapter | null): void {
  adapter = next;
}

const toSnapshot = (s: AppState): Snapshot => ({
  topics: s.topics,
  exams: s.exams,
  sessions: s.sessions,
  doneUids: [...s.doneUids],
  dayIndex: s.dayIndex,
  learningStyle: s.learningStyle,
  streak: s.streak,
  examSeasonDial: s.examSeasonDial,
  pendingGuardianInvites: s.pendingGuardianInvites,
  classSessions: s.classSessions,
  classPeriods: s.classPeriods,
  subjectMeta: s.subjectMeta,
  dailyHours: s.dailyHours,
  timeFormat: s.timeFormat,
});

/** Fire-and-forget save of the current state; no-op without a configured adapter. */
export function persist(): void {
  if (!adapter) return;
  adapter.save(toSnapshot(useApp.getState()));
}

/** c5 L1b: surface a degraded-SQLite save failure for later UI display. */
export function setLastSaveError(msg: string | null): void {
  useApp.setState({ lastSaveError: msg });
}

/**
 * Load the persisted snapshot (if any) into the store.
 * Resolves false when no adapter is configured or nothing was persisted.
 */
export async function hydrate(): Promise<boolean> {
  if (!adapter) return false;
  const snap = await adapter.load();
  if (!snap) return false;
  // Rebuild today's plan from restored state (F29 parity): the snapshot does not
  // carry the derived plan — same contract as onboarding's finish path.
  const plan = resolveCurrentPlan(
    snap.topics,
    snap.exams,
    mergedClassSessions(snap.classSessions ?? [], snap.classPeriods ?? {}),
    [],
    snap.dayIndex,
    snap.dailyHours ?? DAILY_HOURS_DEFAULT,
  );
  useApp.setState({
    topics: snap.topics,
    exams: snap.exams,
    sessions: snap.sessions,
    doneUids: new Set(snap.doneUids),
    dayIndex: snap.dayIndex,
    learningStyle: snap.learningStyle,
    streak: snap.streak,
    examSeasonDial: snap.examSeasonDial ?? 1,
    classSessions: snap.classSessions ?? [],
    classPeriods: snap.classPeriods ?? {},
    pendingGuardianInvites: snap.pendingGuardianInvites ?? [],
    subjectMeta: snap.subjectMeta ?? {},
    dailyHours: snap.dailyHours ?? DAILY_HOURS_DEFAULT,
    timeFormat: snap.timeFormat ?? '24',
    plan,
  });
  return true;
}

export const useApp = create<AppState>((set, get) => ({
  topics: [],
  exams: [],
  classSessions: [],
  classPeriods: {},
  sessions: [],
  plan: [],
  doneUids: new Set(),
  dayIndex: 0,
  learningStyle: 'average',
  streak: initialStreak(),
  examSeasonDial: 1,
  pendingGuardianInvites: [],
  subjectMeta: {},
  dailyHours: DAILY_HOURS_DEFAULT,
  timeFormat: '24',
  lastSaveError: null,

  checkItem(uid) {
    const { plan, doneUids } = get();
    if (doneUids.has(uid)) return;
    const next = new Set(doneUids);
    next.add(uid);
    set({ doneUids: next });
    const item = plan.find(p => p.uid === uid);
    if (item) {
      get().logSession(item.topic.id, item.durationMin); // also persists via logSession
    }
    persist();
  },

  logSession(topicId, minutes) {
    const { sessions, streak } = get();
    set({
      sessions: [...sessions, { day: get().dayIndex, min: minutes }],
      streak: bumpToday(streak, todayActivity([...sessions, { day: 0, min: minutes }], [], new Set())),
    });
    persist();
  },

  rateTopic(uid, rating) {
    const { plan, topics, learningStyle, sessions, dayIndex } = get();
    const item = plan.find(p => p.uid === uid);
    if (!item || item.kind !== 'rev') return;
    set({
      topics: topics.map(t =>
        t.id === item.topic.id ? { ...t, ...applyRating({ box: t.box, dueIn: t.dueIn }, rating, learningStyle) } : t
      ),
      sessions: [...sessions, { day: dayIndex, min: 25 }],
    });
    persist();
  },

  rateByTopic(topicId, rating) {
    const { topics, learningStyle } = get();
    const t = topics.find(x => x.id === topicId);
    if (!t || t.box >= 5) return false;
    set({
      topics: topics.map(x =>
        x.id === topicId ? { ...x, ...applyRating({ box: x.box, dueIn: x.dueIn }, rating, learningStyle) } : x
      ),
    });
    persist();
    return true;
  },

  finishFocus({ topicId, minutes, rating, topicIds }) {
    const { topics, learningStyle } = get();
    // minutes > 0 → log a session + streak bump; rating-only calls (min 0)
    // apply the SRS move without polluting focus-minute totals
    const logged = minutes > 0;
    set({
      sessions: logged
        ? [...get().sessions, { day: get().dayIndex, min: minutes, ...(topicIds && topicIds.length > 1 ? { topicIds } : {}) }]
        : get().sessions,
      streak: logged
        ? bumpToday(get().streak, {
            blocksDone: 0,
            focusMinutes: minutes,
          })
        : get().streak,
      // rating applies the SRS transition; new topics (box 0) start their ladder
      topics: topics.map(t =>
        t.id === topicId && rating
          ? { ...t, ...applyRating({ box: t.box, dueIn: t.dueIn }, rating, learningStyle) }
          : t
      ),
    });
    persist();
  },

  addExam(exam) {
    set({ exams: [...get().exams, exam] });
    persist();
  },

  setExamSeasonDial(dial) {
    set({ examSeasonDial: clampCapacity(dial) });
    persist();
  },

  setClassSession(session) {
    const { topics, exams } = get();
    const list = get().classSessions;
    const next = list.some(s => s.id === session.id)
      ? list.map(s => (s.id === session.id ? session : s))
      : [...list, session];
    set({
      classSessions: next,
      plan: resolveCurrentPlan(topics, exams, timetableFor({ ...get(), classSessions: next }), get().plan, get().dayIndex, get().dailyHours),
    });
    persist();
  },

  moveClassPeriod(id, delta) {
    const r = movePeriod(get().classSessions, id, delta);
    if (!r.ok) return false;
    const { topics, exams } = get();
    set({
      classSessions: r.sessions,
      plan: resolveCurrentPlan(topics, exams, timetableFor({ ...get(), classSessions: r.sessions }), get().plan, get().dayIndex, get().dailyHours),
    });
    persist();
    return true;
  },

  cancelClassPeriod(id) {
    const { topics, exams } = get();
    const next = cancelPeriod(get().classSessions, id);
    set({
      classSessions: next,
      plan: resolveCurrentPlan(topics, exams, timetableFor({ ...get(), classSessions: next }), get().plan, get().dayIndex, get().dailyHours),
    });
    persist();
  },

  setClassPeriods(periods) {
    const { topics, exams } = get();
    const next = timetableFor({ ...get(), classPeriods: periods });
    set({
      classPeriods: periods,
      plan: resolveCurrentPlan(topics, exams, next, get().plan, get().dayIndex, get().dailyHours),
    });
    persist();
  },

  advanceDay() {
    const { plan, doneUids, streak, sessions } = get();
    const carry = computeCarry(plan, doneUids);
    const activity = todayActivity(sessions, plan, doneUids);
    const r = rollover(streak, activity);

    // rebuild tomorrow's plan from updated topics (SRS already rescheduled by rateTopic)
    const { topics, exams, examSeasonDial, dailyHours, classSessions, classPeriods } = get();
    const carriedNames = new Set(carry.carried.map(c => c.topic.id));
    // #9 Exam Season: shift weights toward exam subjects; gap days get boosted capacity
    const season = applyExamSeason(topics, exams, dateForDayIndex(get().dayIndex + 1), examSeasonDial);
    const tomorrowPlan = buildDayPlan(season.topics, exams, 1, {
      excludeTopicIds: [...carriedNames],
      slots: slotsForWeekday(mergedClassSessions(classSessions, classPeriods), weekdayFor(get().dayIndex + 1), {
        window: studyWindowFor(dailyHours),
      }),
    });

    set({
      dayIndex: get().dayIndex + 1,
      plan: [...carry.carried, ...tomorrowPlan],
      doneUids: new Set(),
      streak: r.state,
    });
    persist();
    return {
      carried: carry.carried.length,
      droppedRevisions: carry.droppedRevisions,
      droppedForward: carry.droppedForward,
      broke: r.broke,
    };
  },

  createGuardianInvite() {
    // studentId is a local placeholder until P2 auth lands; the transport
    // adapter re-signs with a real identity at handshake time.
    const invite = createGuardianInvite({
      studentId: 'local-student',
      dayIndex: get().dayIndex,
      nonce: get().pendingGuardianInvites.length,
    });
    set({ pendingGuardianInvites: [...get().pendingGuardianInvites, invite] });
    persist();
    return invite;
  },

  setDailyHours(hours) {
    const clamped = Math.min(DAILY_HOURS_MAX, Math.max(DAILY_HOURS_MIN, Math.round(hours)));
    const { topics, exams } = get();
    set({
      dailyHours: clamped,
      // same-frame re-solve so the plan reflects the new capacity immediately
      plan: resolveCurrentPlan(topics, exams, timetableFor(get()), get().plan, get().dayIndex, clamped),
    });
    persist();
  },

  setTimeFormat(fmt) {
    set({ timeFormat: fmt === '12' ? '12' : '24' });
    persist();
  },
}));
