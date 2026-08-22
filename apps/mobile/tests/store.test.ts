import { describe, it, expect, beforeEach } from 'vitest';
import { useApp } from '../src/store';
import type { Topic, Exam } from '@abhyas/engine';

const seedTopics: Topic[] = [
  { id: 'quadratic', subjectId: '📐', name: 'Quadratic Equations', box: 1, dueIn: 0, weight: 10, coverage: 'in_progress', backlog: false },
  { id: 'trig', subjectId: '📐', name: 'Trigonometry', box: 0, dueIn: -1, weight: 12, coverage: 'unstarted', backlog: false },
];
const seedExam: Exam = { id: 'ut1', name: 'UT Maths', kind: 'school', windowStart: '2026-08-27', subjectIds: ['📐'], datesheetConfirmed: false };

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

describe('store · focus finish path (#6)', () => {
  beforeEach(fresh);

  it('finishFocus logs minutes and bumps the streak (OR-rule)', () => {
    useApp.getState().finishFocus({ topicId: null, minutes: 12 });
    const s = useApp.getState();
    expect(s.sessions).toEqual([{ day: 0, min: 12 }]);
    expect(s.streak.current).toBe(1);          // ≥10 min qualifies
    expect(s.streak.countedToday).toBe(true);
  });

  it('finishFocus with rating applies SRS transition to the topic', () => {
    useApp.getState().finishFocus({ topicId: 'quadratic', minutes: 25, rating: 3 });
    const t = useApp.getState().topics.find(x => x.id === 'quadratic')!;
    expect(t.box).toBe(2);
    expect(t.dueIn).toBe(3);
  });

  it('Solid on a NEW topic starts its ladder at box 1', () => {
    useApp.getState().finishFocus({ topicId: 'trig', minutes: 25, rating: 3 });
    const t = useApp.getState().topics.find(x => x.id === 'trig')!;
    expect(t.box).toBe(1);
    expect(t.dueIn).toBe(1);
  });

  it('double bump guard: two sessions same day → streak stays 1 until rollover', () => {
    useApp.getState().finishFocus({ topicId: null, minutes: 30 });
    useApp.getState().finishFocus({ topicId: null, minutes: 30 });
    expect(useApp.getState().streak.current).toBe(1);
    expect(useApp.getState().sessions.length).toBe(2); // both logged
  });

  it('checkItem logs a session too (plan finish path)', () => {
    useApp.setState({ plan: [{ uid: 't_quadratic', kind: 'rev', topic: seedTopics[0]!, durationMin: 20, startMin: 960 }] });
    useApp.getState().checkItem('t_quadratic');
    expect(useApp.getState().doneUids.has('t_quadratic')).toBe(true);
    expect(useApp.getState().sessions).toEqual([{ day: 0, min: 20 }]);
  });
});

describe('store · advanceDay rollover (#5/#14 contract)', () => {
  beforeEach(() => {
    fresh();
    useApp.setState({ plan: [
      { uid: 'f1', kind: 'new', topic: seedTopics[1]!, durationMin: 40, startMin: 960, examLinked: true },
      { uid: 'f2', kind: 'new', topic: seedTopics[0]!, durationMin: 40, startMin: 1010 },
      { uid: 'r1', kind: 'rev', topic: seedTopics[0]!, durationMin: 20, startMin: 1060 },
    ]});
  });

  it('carries ≤2 forward-work (exam-linked first), revisions return to queue', () => {
    const r = useApp.getState().advanceDay();
    expect(r.carried).toBe(2);
    expect(r.droppedRevisions).toBe(1);
    const s = useApp.getState();
    expect(s.dayIndex).toBe(1);
    expect(s.plan.filter(p => p.carried).every(p => p.kind !== 'rev')).toBe(true);
    expect(s.doneUids.size).toBe(0);
  });
});
