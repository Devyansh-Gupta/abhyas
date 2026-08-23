import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useApp, configurePersistence, hydrate } from '../src/store';
import type { PersistenceAdapter, Snapshot } from '../src/persistence';
import type { Topic, Exam } from '@abhyas/engine';

const seedTopics: Topic[] = [
  { id: 'quadratic', subjectId: '📐', name: 'Quadratic Equations', box: 1, dueIn: 0, weight: 10, coverage: 'in_progress', backlog: false },
  { id: 'trig', subjectId: '📐', name: 'Trigonometry', box: 0, dueIn: -1, weight: 12, coverage: 'unstarted', backlog: false },
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
  });
};

afterEach(() => {
  configurePersistence(null); // never leak an adapter into other tests
});

describe('store persistence seam (#8 prep)', () => {
  beforeEach(fresh);

  it('default mode (no adapter) writes nothing', () => {
    const spy = makeAdapter();
    configurePersistence(spy);
    configurePersistence(null); // back to default: memory only

    useApp.getState().finishFocus({ topicId: null, minutes: 12 });
    useApp.getState().addExam(seedExam);
    useApp.getState().advanceDay();

    expect(spy.saves).toEqual([]);
    expect(useApp.getState().dayIndex).toBe(1); // behavior unchanged
  });

  it('mutations trigger save() with the expected snapshot payload', () => {
    const adapter = makeAdapter();
    configurePersistence(adapter);

    useApp.getState().finishFocus({ topicId: 'quadratic', minutes: 25, rating: 3 });
    expect(adapter.saves.length).toBe(1);
    let snap = adapter.saves[0]!;
    expect(snap.sessions).toEqual([{ day: 0, min: 25 }]);
    expect(snap.streak.current).toBe(1);
    expect(snap.topics.find(t => t.id === 'quadratic')).toMatchObject({ box: 2, dueIn: 3 });
    expect(snap.doneUids).toEqual([]);
    expect(snap.dayIndex).toBe(0);
    expect(snap.learningStyle).toBe('average');
    expect(snap.exams).toEqual([seedExam]);

    useApp.setState({ plan: [{ uid: 't_trig', kind: 'new', topic: seedTopics[1]!, durationMin: 40, startMin: 960 }] });
    adapter.saves.length = 0;
    useApp.getState().checkItem('t_trig');
    snap = adapter.saves.at(-1)!; // last of checkItem's saves carries the full new state
    expect(snap.doneUids).toEqual(['t_trig']);
    // sessions accumulate across actions in the same store instance
    expect(snap.sessions).toEqual([{ day: 0, min: 25 }, { day: 0, min: 40 }]);
    expect(snap.streak.current).toBe(1);

    useApp.getState().advanceDay();
    snap = adapter.saves.at(-1)!;
    expect(snap.dayIndex).toBe(1);
    expect(snap.doneUids).toEqual([]);
  });

  it('hydrate() restores a persisted snapshot into the store', async () => {
    const saved: Snapshot = {
      topics: [{ ...seedTopics[0]!, box: 3, dueIn: 7 }],
      exams: [seedExam],
      sessions: [{ day: 2, min: 30 }],
      doneUids: ['t_quadratic'],
      dayIndex: 2,
      learningStyle: 'strong_memory',
      streak: { current: 4, longest: 6, missed: 1, countedToday: true },
    };
    const adapter = makeAdapter(saved);
    configurePersistence(adapter);

    // store starts from a different state entirely
    fresh();
    useApp.setState({ dayIndex: 99, learningStyle: 'fast_forget' });

    const restored = await hydrate();
    expect(restored).toBe(true);
    const s = useApp.getState();
    expect(s.dayIndex).toBe(2);
    expect(s.learningStyle).toBe('strong_memory');
    expect(s.sessions).toEqual([{ day: 2, min: 30 }]);
    expect(s.doneUids).toEqual(new Set(['t_quadratic']));
    expect(s.topics.find(t => t.id === 'quadratic')).toMatchObject({ box: 3, dueIn: 7 });
    expect(s.streak.current).toBe(4);
    // hydrate must not write back
    expect(adapter.saves).toEqual([]);
  });

  it('hydrate() resolves false with no adapter or empty storage', async () => {
    configurePersistence(null);
    expect(await hydrate()).toBe(false);

    configurePersistence(makeAdapter(null)); // configured but nothing persisted
    expect(await hydrate()).toBe(false);
  });
});
