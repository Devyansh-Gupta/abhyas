/**
 * App store (Zustand) — single source of truth mirroring the prototype's state model.
 * Persistence adapter is injectable; SQLite repo lands in issue #8.
 */
import { create } from 'zustand';
import {
  type Topic, type Exam, type PlanItem, type LearningStyle,
  applyRating, buildDayPlan, computeCarry,
  initialStreak, bumpToday, rollover, type StreakState, type DayActivity,
} from '@abhyas/engine';
import { type PersistenceAdapter, type Snapshot } from './persistence';

export interface SessionLogEntry { day: number; min: number }

interface AppState {
  // core data
  topics: Topic[];
  exams: Exam[];
  sessions: SessionLogEntry[];
  plan: PlanItem[];
  doneUids: Set<string>;
  dayIndex: number;
  learningStyle: LearningStyle;
  streak: StreakState;

  // actions
  checkItem(uid: string): void;
  rateTopic(uid: string, rating: 1 | 2 | 3): void;
  /** Subjects-tab rating path (#7): SRS move on any non-graduated topic, no session logged.
   *  Returns false when nothing applied (unknown or graduated topic) — UI must surface it. */
  rateByTopic(topicId: string, rating: 1 | 2 | 3): boolean;
  logSession(topicId: string, minutes: number): void;
  /** Focus-timer finish path: log minutes + optional confidence rating on any topic. */
  finishFocus(opts: { topicId: string | null; minutes: number; rating?: 1 | 2 | 3 }): void;
  addExam(exam: Exam): void;
  advanceDay(): { carried: number; droppedRevisions: number; droppedForward: number; broke: boolean };
}

const todayActivity = (sessions: SessionLogEntry[], plan: PlanItem[], doneUids: Set<string>): DayActivity => ({
  blocksDone: plan.filter(p => doneUids.has(p.uid)).length,
  focusMinutes: sessions.reduce((a, s) => a + s.min, 0),
});

// --- injectable persistence seam (#8 prep) ---------------------------------
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
});

/** Fire-and-forget save of the current state; no-op without a configured adapter. */
function persist(): void {
  if (!adapter) return;
  adapter.save(toSnapshot(useApp.getState()));
}

/**
 * Load the persisted snapshot (if any) into the store.
 * Resolves false when no adapter is configured or nothing was persisted.
 */
export async function hydrate(): Promise<boolean> {
  if (!adapter) return false;
  const snap = await adapter.load();
  if (!snap) return false;
  useApp.setState({
    topics: snap.topics,
    exams: snap.exams,
    sessions: snap.sessions,
    doneUids: new Set(snap.doneUids),
    dayIndex: snap.dayIndex,
    learningStyle: snap.learningStyle,
    streak: snap.streak,
  });
  return true;
}

export const useApp = create<AppState>((set, get) => ({
  topics: [],
  exams: [],
  sessions: [],
  plan: [],
  doneUids: new Set(),
  dayIndex: 0,
  learningStyle: 'average',
  streak: initialStreak(),

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

  finishFocus({ topicId, minutes, rating }) {
    const { topics, learningStyle } = get();
    set({
      sessions: [...get().sessions, { day: get().dayIndex, min: minutes }],
      streak: bumpToday(get().streak, {
        blocksDone: 0,
        focusMinutes: minutes,
      }),
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

  advanceDay() {
    const { plan, doneUids, streak, sessions } = get();
    const carry = computeCarry(plan, doneUids);
    const activity = todayActivity(sessions, plan, doneUids);
    const r = rollover(streak, activity);

    // rebuild tomorrow's plan from updated topics (SRS already rescheduled by rateTopic)
    const { topics, exams } = get();
    const carriedNames = new Set(carry.carried.map(c => c.topic.id));
    const tomorrowPlan = buildDayPlan(topics, exams, 1, {
      excludeTopicIds: [...carriedNames],
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
}));
