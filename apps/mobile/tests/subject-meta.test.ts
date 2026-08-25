import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useApp, configurePersistence, hydrate } from '../src/store';
import type { PersistenceAdapter, Snapshot } from '../src/persistence';
import { toRows, fromRows, type RawState, type SqliteRepoClient } from '../src/repo/sqlite';
import type { Topic, Exam } from '@abhyas/engine';

const seedTopics: Topic[] = [
  { id: 'quadratic', subjectId: '📐', name: 'Quadratic Equations', box: 1, dueIn: 0, weight: 10, coverage: 'in_progress', backlog: false },
];
const seedExam: Exam = { id: 'ut1', name: 'UT Maths', kind: 'school', windowStart: '2026-08-27', subjectIds: ['📐'], datesheetConfirmed: false };

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

/** In-memory SqliteRepoClient standing in for expo-sqlite (see sqlite-repo.test.ts). */
function makeClient(initial: RawState = { topicRows: [], examRows: [], sessionRows: [], kvRows: [] }) {
  let raw = initial;
  const client = {
    raw(): RawState {
      return raw;
    },
    async read() {
      return raw;
    },
    async write(next: Parameters<SqliteRepoClient['write']>[0]) {
      // mimic the real client's per-key upsert semantics
      const kv = new Map(raw.kvRows.map(r => [r.key, r.value]));
      for (const r of next.kvRows) kv.set(r.key, r.value);
      raw = { ...next, kvRows: [...kv.entries()].map(([key, value]) => ({ key, value })) };
    },
  };
  return client as SqliteRepoClient & { raw(): RawState };
}

const fresh = () => {
  useApp.setState({
    topics: structuredClone(seedTopics),
    exams: [seedExam],
    sessions: [],
    plan: [],
    doneUids: new Set(),
    dayIndex: 0,
    learningStyle: 'average',
    streak: { current: 0, longest: 0, missed: 0, countedToday: false },
    subjectMeta: {},
  });
};

afterEach(() => {
  configurePersistence(null); // never leak an adapter into other tests
});

describe('subjectMeta persistence (cycle-4 lane A)', () => {
  beforeEach(fresh);

  it('snapshot carries subjectMeta and hydrate restores it (kill/reopen)', async () => {
    useApp.setState({
      subjectMeta: { '📐': { name: 'Mathematics' }, '🧪': { name: 'Science', color: '#38BDF8' } },
    });

    const adapter = makeAdapter();
    configurePersistence(adapter);
    useApp.getState().finishFocus({ topicId: 'quadratic', minutes: 10 });
    expect(adapter.saves.at(-1)!.subjectMeta).toEqual({
      '📐': { name: 'Mathematics' },
      '🧪': { name: 'Science', color: '#38BDF8' },
    });

    // "kill": reset the store to empty, then reopen via hydrate
    fresh();
    expect(useApp.getState().subjectMeta).toEqual({});
    expect(await hydrate()).toBe(true);
    expect(useApp.getState().subjectMeta).toEqual({
      '📐': { name: 'Mathematics' },
      '🧪': { name: 'Science', color: '#38BDF8' },
    });
  });

  it('old snapshots without subjectMeta hydrate to an empty map (fallback path)', async () => {
    const saved: Snapshot = {
      topics: seedTopics,
      exams: [],
      sessions: [],
      doneUids: [],
      dayIndex: 0,
      learningStyle: 'average',
      streak: { current: 0, longest: 0, missed: 0, countedToday: false },
      // no subjectMeta — pre-cycle-4 install
    };
    configurePersistence(makeAdapter(saved));
    expect(await hydrate()).toBe(true);
    expect(useApp.getState().subjectMeta).toEqual({});
  });

  it('sqlite mappers round-trip subjectMeta through the app_kv table', () => {
    const snap: Snapshot = {
      topics: seedTopics,
      exams: [seedExam],
      sessions: [{ day: 0, min: 25 }],
      doneUids: ['t_quadratic'],
      dayIndex: 3,
      learningStyle: 'average',
      streak: { current: 1, longest: 2, missed: 0, countedToday: true },
      subjectMeta: { '📐': { name: 'Mathematics', color: '#8B7CF6' }, '🧪': { name: 'Chemistry' } },
    };

    const raw = toRows(snap);
    const metaRow = raw.kvRows.find(r => r.key === 'subjectMeta');
    expect(metaRow).toBeDefined();
    expect(JSON.parse(metaRow!.value)).toEqual(snap.subjectMeta);

    const restored = fromRows(raw)!;
    expect(restored.subjectMeta).toEqual(snap.subjectMeta);
  });

  it('sqlite round-trip through a live client keeps subjectMeta across save→load', async () => {
    const client = makeClient();
    const adapter = await import('../src/repo/sqlite').then(m =>
      Object.defineProperty({}, '__proto__', {}) && m.createSqliteAdapter(client)
    ) as PersistenceAdapter;

    configurePersistence(adapter);
    useApp.setState({ subjectMeta: { '📐': { name: 'Mathematics' } } });
    useApp.getState().addExam(seedExam); // triggers persist()

    // simulate kill/reopen: load straight back from storage
    configurePersistence(null);
    useApp.setState({ subjectMeta: {} }); // fresh process = empty meta pre-hydrate
    expect(useApp.getState().subjectMeta).toEqual({});

    const reopened = (await import('../src/repo/sqlite')).createSqliteAdapter(client);
    const snap = await reopened.load();
    expect(snap?.subjectMeta).toEqual({ '📐': { name: 'Mathematics' } });

    // full store-level reopen path too
    configurePersistence(reopened);
    expect(await hydrate()).toBe(true);
    expect(useApp.getState().subjectMeta).toEqual({ '📐': { name: 'Mathematics' } });
  });
});
