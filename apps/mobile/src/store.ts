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
      get().logSession(item.topic.id, item.durationMin);
    }
  },

  logSession(topicId, minutes) {
    const { sessions, streak } = get();
    set({
      sessions: [...sessions, { day: get().dayIndex, min: minutes }],
      streak: bumpToday(streak, todayActivity([...sessions, { day: 0, min: minutes }], [], new Set())),
    });
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
  },

  addExam(exam) {
    set({ exams: [...get().exams, exam] });
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
    return {
      carried: carry.carried.length,
      droppedRevisions: carry.droppedRevisions,
      droppedForward: carry.droppedForward,
      broke: r.broke,
    };
  },
}));
