import { describe, it, expect, beforeEach } from 'vitest';
import { toggleTopicId, splitEvenly } from '../src/lib/focus-session';
import { useApp } from '../src/store';
import type { Topic, Exam } from '@abhyas/engine';

describe('focus-session · toggleTopicId', () => {
  it('adds a topic preserving order', () => {
    expect(toggleTopicId([], 'b')).toEqual(['b']);
    expect(toggleTopicId(['a', 'c'], 'b')).toEqual(['a', 'c', 'b']);
  });
  it('removes a topic keeping the rest in order', () => {
    expect(toggleTopicId(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
  it('toggles are idempotent round-trips and never mutate input', () => {
    const src = ['a', 'b'];
    const out = toggleTopicId(toggleTopicId(src, 'x'), 'x');
    expect(out).toEqual(['a', 'b']);
    expect(src).toEqual(['a', 'b']);
  });
});

describe('focus-session · splitEvenly (goldens)', () => {
  it('splits cleanly', () => {
    expect(splitEvenly(50, 2)).toEqual([25, 25]);
    expect(splitEvenly(90, 3)).toEqual([30, 30, 30]);
  });
  it('gives remainder minutes to earlier topics', () => {
    expect(splitEvenly(25, 2)).toEqual([13, 12]);
    expect(splitEvenly(10, 3)).toEqual([4, 3, 3]);
  });
  it('degenerate inputs → empty', () => {
    expect(splitEvenly(10, 0)).toEqual([]);
    expect(splitEvenly(0, 3)).toEqual([]);
  });
});

const topics: Topic[] = [
  { id: 'quadratic', subjectId: '📐', name: 'Quadratics', box: 1, dueIn: 0, weight: 10, coverage: 'in_progress', backlog: false },
  { id: 'trig', subjectId: '📐', name: 'Trigonometry', box: 0, dueIn: -1, weight: 12, coverage: 'unstarted', backlog: false },
];

describe('store · finishFocus multi-topic attribution (c5 L6)', () => {
  beforeEach(() => {
    useApp.setState({
      topics: structuredClone(topics),
      exams: [] as Exam[],
      sessions: [],
      plan: [],
      doneUids: new Set(),
      dayIndex: 0,
      learningStyle: 'average',
      streak: { current: 0, longest: 0, missed: 0, countedToday: false },
    });
  });

  it('multi-topic finish records ALL bound topic ids on one session entry', () => {
    useApp.getState().finishFocus({ topicId: 'quadratic', topicIds: ['quadratic', 'trig'], minutes: 25 });
    const s = useApp.getState();
    expect(s.sessions).toEqual([{ day: 0, min: 25, topicIds: ['quadratic', 'trig'] }]);
    expect(s.sessions.reduce((a, x) => a + x.min, 0)).toBe(25); // total unchanged
    expect(s.streak.current).toBe(1);
  });

  it('single-topic calls keep the legacy shape (no topicIds field)', () => {
    useApp.getState().finishFocus({ topicId: 'trig', minutes: 12 });
    expect(useApp.getState().sessions).toEqual([{ day: 0, min: 12 }]);
  });

  it('rating still applies to the primary topic only', () => {
    useApp.getState().finishFocus({ topicId: 'quadratic', topicIds: ['quadratic', 'trig'], minutes: 25, rating: 3 });
    const s = useApp.getState();
    expect(s.topics.find(t => t.id === 'quadratic')!.box).toBe(2);
    expect(s.topics.find(t => t.id === 'trig')!.box).toBe(0); // rated later via its own sheet
  });
});
