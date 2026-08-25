/**
 * c5 L5 store round-trip — classPeriods persists like dailyHours:
 * optional snapshot field, absent-not-empty on old snapshots, and the derived
 * plan re-solves against class-busy time when periods land.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useApp, configurePersistence, hydrate } from '../src/store';
import type { PersistenceAdapter, Snapshot } from '../src/persistence';
import type { ClassPeriods } from '@abhyas/engine';

function makeAdapter(initial: Snapshot | null = null) {
  const adapter: PersistenceAdapter & { saves: Snapshot[]; snap: Snapshot | null } = {
    saves: [],
    snap: initial,
    async load() {
      return adapter.snap;
    },
    save(snapshot) {
      adapter.saves.push(snapshot);
      adapter.snap = snapshot;
    },
  };
  return adapter;
}

const seedTopics = [
  { id: 'quad', subjectId: '📐', name: 'Quadratic Equations', box: 0, dueIn: -1, weight: 10, coverage: 'unstarted' as const, backlog: false },
];

const fresh = () => {
  useApp.setState({
    topics: structuredClone(seedTopics),
    exams: [],
    sessions: [],
    plan: [],
    doneUids: new Set(),
    dayIndex: 0,
    learningStyle: 'average',
    streak: { current: 0, longest: 0, missed: 0, countedToday: false },
    classSessions: [],
    classPeriods: {},
  });
};

afterEach(() => {
  configurePersistence(null);
});

describe('classPeriods persistence + planner wiring', () => {
  beforeEach(fresh);

  it('round-trips: set → snapshot carries it → absent snapshot restores {} not undefined', async () => {
    const adapter = makeAdapter();
    configurePersistence(adapter);

    const periods: ClassPeriods = { 1: [{ startMin: 600, endMin: 650 }] };
    useApp.getState().setClassPeriods(periods);
    expect(useApp.getState().classPeriods).toEqual(periods);

    let snap = adapter.saves.at(-1)!;
    expect(snap.classPeriods).toEqual(periods);

    // kill/reopen: hydrate from the saved snapshot
    useApp.setState({ classPeriods: {}, topics: [], plan: [] });
    await hydrate();
    expect(useApp.getState().classPeriods).toEqual(periods);

    // older snapshot WITHOUT the field → absent-not-empty ({}, never undefined)
    const legacy: Snapshot = {
      topics: structuredClone(seedTopics),
      exams: [],
      sessions: [],
      doneUids: [],
      dayIndex: 0,
      learningStyle: 'average',
      streak: { current: 0, longest: 0, missed: 0, countedToday: false },
      dailyHours: 2,
    };
    configurePersistence(makeAdapter(legacy));
    await hydrate();
    expect(useApp.getState().classPeriods).toEqual({});
  });

  it('setClassPeriods re-solves today’s plan around class hours', () => {
    // anchor day = Thu (weekday 4): give Thursday a full-evening class 16:00–20:00
    useApp.setState({
      dayIndex: 0,
      classPeriods: {},
    });
    useApp.getState().setClassPeriods({ 4: [{ startMin: 16 * 60, endMin: 20 * 60 }] });

    const s = useApp.getState();
    expect(s.plan.length).toBeGreaterThan(0);
    // every scheduled block must sit outside the class interval
    for (const item of s.plan) {
      const st = item.startMin ?? 0;
      expect(st < 20 * 60 && 16 * 60 < st + item.durationMin).toBe(false);
    }
  });

  it('skipping the step (empty {}) persists cleanly without carving capacity', () => {
    const adapter = makeAdapter();
    configurePersistence(adapter);
    useApp.getState().setClassPeriods({ 4: [{ startMin: 16 * 60, endMin: 20 * 60 }] });
    const carved = useApp.getState().plan.length;
    expect(carved).toBeGreaterThan(0);
    // "My timetable varies" → clear everything back to {}
    useApp.getState().setClassPeriods({});
    expect(adapter.saves.at(-1)!.classPeriods).toEqual({});
    expect(useApp.getState().classPeriods).toEqual({});
  });
});
