import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  useApp, configurePersistence, hydrate,
  DAILY_HOURS_MIN, DAILY_HOURS_MAX, DAILY_HOURS_DEFAULT,
} from '../src/store';
import type { PersistenceAdapter, Snapshot } from '../src/persistence';
import { toRows, fromRows } from '../src/repo/sqlite';
import { capacityMinutes, studyWindowFor, STUDY_WINDOW } from '@abhyas/engine';
import type { Topic } from '@abhyas/engine';

const seedTopics: Topic[] = [
  { id: 'quadratic', subjectId: '📐', name: 'Quadratic Equations', box: 1, dueIn: 0, weight: 10, coverage: 'in_progress', backlog: false },
];

/** Fake in-memory adapter recording every save. */
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

const fresh = () => {
  useApp.setState({
    topics: structuredClone(seedTopics),
    exams: [],
    sessions: [],
    plan: [],
    doneUids: new Set<string>(),
    dayIndex: 0,
    learningStyle: 'average',
    streak: { current: 0, longest: 0, missed: 0, countedToday: false },
    subjectMeta: {},
    dailyHours: DAILY_HOURS_DEFAULT,
    timeFormat: '24',
  });
};

beforeEach(fresh);
afterEach(() => configurePersistence(null));

describe('settings preferences persistence (c5 F6/F7)', () => {
  it('setDailyHours clamps to [1,12] and re-solves the plan same frame', () => {
    useApp.getState().setDailyHours(0);
    expect(useApp.getState().dailyHours).toBe(DAILY_HOURS_MIN);
    useApp.getState().setDailyHours(99);
    expect(useApp.getState().dailyHours).toBe(DAILY_HOURS_MAX);
    useApp.getState().setDailyHours(4.4); // rounds
    expect(useApp.getState().dailyHours).toBe(4);
  });

  it('dailyHours/timeFormat round-trip through snapshot → hydrate (kill/reopen)', async () => {
    useApp.getState().setDailyHours(5);
    useApp.getState().setTimeFormat('12');

    const adapter = makeAdapter();
    configurePersistence(adapter);
    useApp.getState().addExam({ id: 'ut1', name: 'UT', kind: 'school', windowStart: '2026-09-01', subjectIds: ['📐'], datesheetConfirmed: false });
    expect(adapter.saves.at(-1)!.dailyHours).toBe(5);
    expect(adapter.saves.at(-1)!.timeFormat).toBe('12');

    fresh();
    const st = useApp.getState();
    expect(st.dailyHours).toBe(DAILY_HOURS_DEFAULT);
    expect(st.timeFormat).toBe('24');
    expect(await hydrate()).toBe(true);
    expect(useApp.getState().dailyHours).toBe(5);
    expect(useApp.getState().timeFormat).toBe('12');
  });

  it('pre-c5 snapshots without prefs hydrate to defaults (fallback path)', async () => {
    const saved: Snapshot = {
      topics: seedTopics,
      exams: [],
      sessions: [],
      doneUids: [],
      dayIndex: 0,
      learningStyle: 'average',
      streak: { current: 0, longest: 0, missed: 0, countedToday: false },
    };
    configurePersistence(makeAdapter(saved));
    expect(await hydrate()).toBe(true);
    expect(useApp.getState().dailyHours).toBe(DAILY_HOURS_DEFAULT);
    expect(useApp.getState().timeFormat).toBe('24');
  });

  it('sqlite mappers round-trip dailyHours/timeFormat through kv rows', () => {
    const snap: Snapshot = {
      topics: seedTopics,
      exams: [],
      sessions: [{ day: 0, min: 25 }],
      doneUids: ['t_quadratic'],
      dayIndex: 3,
      learningStyle: 'average',
      streak: { current: 1, longest: 2, missed: 0, countedToday: true },
      dailyHours: 7,
      timeFormat: '12',
    };
    const raw = toRows(snap);
    expect(raw.kvRows.find(r => r.key === 'dailyHours')?.value).toBe('7');
    expect(raw.kvRows.find(r => r.key === 'timeFormat')?.value).toBe('12');
    const restored = fromRows(raw)!;
    expect(restored.dailyHours).toBe(7);
    expect(restored.timeFormat).toBe('12');
  });

  it('studyWindowFor trims capacity to dailyHours·60 (engine wiring)', () => {
    // full window = 16:00–22:30 = 390m; a 2h goal starts at 20:30
    const win2 = studyWindowFor(2);
    expect(win2.end).toBe(STUDY_WINDOW.end);
    expect(win2.start).toBe(22 * 60 + 30 - 120);
    expect(capacityMinutes([], 4, { window: win2 })).toBe(120);
    // clamped bounds
    expect(capacityMinutes([], 4, { window: studyWindowFor(DAILY_HOURS_MAX) })).toBe(390);
    expect(studyWindowFor(DAILY_HOURS_MIN).start).toBe(STUDY_WINDOW.end - 60);
  });
});
