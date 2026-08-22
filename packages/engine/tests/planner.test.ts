import { describe, it, expect } from 'vitest';
import { freeSlots, slotMinutes, buildDayPlan, STUDY_WINDOW } from '../src/planner.js';
import type { Topic, Exam } from '../src/types.js';

const mkTopic = (id: string, over: Partial<Topic> = {}): Topic => ({
  id, subjectId: '📐', name: id, box: 0, dueIn: -1, weight: 5,
  coverage: 'unstarted', backlog: false, ...over,
});

const exam: Exam = {
  id: 'ut', name: 'Unit Test', kind: 'school',
  windowStart: '2026-08-27', subjectIds: ['📐'], datesheetConfirmed: false,
};

describe('freeSlots (F24 contract)', () => {
  it('derives gaps within study window; slivers <20min dropped', () => {
    // tuition 17:30–19:00 (1080–1140) splits the evening window
    const slots = freeSlots([[480, 935], [1080, 1140]]);
    expect(slots[0]).toEqual({ start: 960, end: 1080 }); // 16:00–18:00
    expect(slots[1]).toEqual({ start: 1140, end: STUDY_WINDOW.end }); // 19:00–22:30
    expect(slotMinutes(slots)).toBe(120 + 210);
  });
  it('adding tuition removes exactly its overlap with the window', () => {
    const without = slotMinutes(freeSlots([[480, 935]]));
    const withTuition = slotMinutes(freeSlots([[480, 935], [1080, 1140]]));
    expect(without - withTuition).toBe(60);
  });
});

describe('buildDayPlan', () => {
  const topics = [
    mkTopic('quadratic', { box: 1, dueIn: 0 }),
    mkTopic('life', { subjectId: '⚗️', box: 2, dueIn: 0 }),
    mkTopic('trig', { box: 0 }),
  ];

  it('places revisions before forward work with stable uids', () => {
    const plan = buildDayPlan(topics, [exam], 0);
    expect(plan[0]!.kind).toBe('rev');
    expect(plan[0]!.uid).toBe('t_quadratic');
    expect(plan.filter(i => i.kind === 'rev').length).toBe(2);
  });

  it('every item carries why + exam linkage', () => {
    const plan = buildDayPlan(topics, [exam], 0);
    for (const it of plan) expect(it.why).toBeTruthy();
    const trig = plan.find(i => i.topic.id === 'trig');
    expect(trig?.examLinked).toBe(true);
    expect(trig?.why).toContain('Exam in');
  });

  it('excluded topics never double-book (F14/F21)', () => {
    const plan = buildDayPlan(topics, [exam], 0, { excludeTopicIds: ['quadratic'] });
    expect(plan.some(i => i.topic.id === 'quadratic')).toBe(false);
  });

  it('respects maxItems and slot capacity', () => {
    const many = Array.from({ length: 12 }, (_, i) => mkTopic(`t${i}`, { box: 0 }));
    expect(buildDayPlan(many, [], 0).length).toBe(6);
    expect(buildDayPlan(many, [], 0, { slots: [{ start: 960, end: 1000 }], maxItems: 12 }).length)
      .toBeLessThan(3); // 40min window fits ~1 block
  });
});
