import { describe, it, expect } from 'vitest';
import {
  busyPeriods, slotsForWeekday, capacityMinutes,
  movePeriod, cancelPeriod, buildWeekPlan, weekdayFor, WEEKDAY_TODAY,
} from '../src/timetable.js';
import { STUDY_WINDOW } from '../src/planner.js';
import type { ClassSession } from '../src/timetable.js';
import type { Topic, Exam } from '../src/types.js';

const WINDOW_MIN = STUDY_WINDOW.end - STUDY_WINDOW.start; // 390

const mkSession = (over: Partial<ClassSession>): ClassSession => ({
  id: 'p1', subjectId: '📐', weekday: WEEKDAY_TODAY, startMin: 1050, endMin: 1110, ...over, // Thu 17:30–18:30
});

const mkTopic = (id: string, over: Partial<Topic> = {}): Topic => ({
  id, subjectId: '📐', name: id, box: 0, dueIn: -1, weight: 5,
  coverage: 'unstarted', backlog: false, ...over,
});

const exam: Exam = {
  id: 'ut', name: 'Unit Test', kind: 'school',
  windowStart: '2026-08-27', subjectIds: ['📐'], datesheetConfirmed: false,
};

describe('weekdayFor', () => {
  it('anchors today at Thursday (4) and wraps the week', () => {
    expect(WEEKDAY_TODAY).toBe(4);
    expect(weekdayFor(0)).toBe(4);
    expect(weekdayFor(2)).toBe(6); // Sat
    expect(weekdayFor(3)).toBe(0); // Sun — wraps
    expect(weekdayFor(7)).toBe(4); // full week wraps back
  });
});

describe('capacity math (timetable → free study minutes)', () => {
  it('empty timetable leaves the full study window', () => {
    expect(capacityMinutes([], WEEKDAY_TODAY)).toBe(WINDOW_MIN);
  });

  it('a class period removes exactly its overlap with the window', () => {
    const sessions = [mkSession({})];
    // 17:30–18:30 sits fully inside 16:00–22:30
    expect(capacityMinutes(sessions, WEEKDAY_TODAY)).toBe(WINDOW_MIN - 60);
    // an afternoon period starting before the window only costs the overlap
    const early = [mkSession({ startMin: 900, endMin: 1020 })]; // 15:00–17:00
    expect(capacityMinutes(early, WEEKDAY_TODAY)).toBe(WINDOW_MIN - 60);
  });

  it('busy periods and slots respect only the requested weekday', () => {
    const sessions = [mkSession({}), mkSession({ id: 'p2', weekday: 1 })];
    expect(busyPeriods(sessions, WEEKDAY_TODAY)).toEqual([[1050, 1110]]);
    expect(busyPeriods(sessions, 1)).toEqual([[1050, 1110]]);
    expect(capacityMinutes(sessions, 2)).toBe(WINDOW_MIN);
    expect(slotsForWeekday(sessions, WEEKDAY_TODAY)).toEqual([
      { start: STUDY_WINDOW.start, end: 1050 },
      { start: 1110, end: STUDY_WINDOW.end },
    ]);
  });
});

describe('movePeriod / cancelPeriod (pure transforms)', () => {
  it('move across weekdays shifts capacity loss from old day to new day', () => {
    const base = [mkSession({})];
    const moved = movePeriod(base, 'p1', { weekday: 1 });
    expect(moved.ok).toBe(true);
    expect(capacityMinutes(moved.sessions, WEEKDAY_TODAY)).toBe(WINDOW_MIN); // old day restored
    expect(capacityMinutes(moved.sessions, 1)).toBe(WINDOW_MIN - 60);        // new day pays
  });

  it('move times change start/end and keep other periods untouched', () => {
    const base = [mkSession({}), mkSession({ id: 'p2', startMin: 1200, endMin: 1230 })];
    const r = movePeriod(base, 'p1', { startMin: 1020, endMin: 1080 }); // 17:00→18:00
    expect(r.ok).toBe(true);
    expect(r.sessions.find(s => s.id === 'p1')).toMatchObject({ startMin: 1020, endMin: 1080 });
    expect(r.sessions.find(s => s.id === 'p2')).toEqual(base[1]);
    expect(base[0]!.startMin).toBe(1050); // input list not mutated
  });

  it('rejects invalid moves without mutating (inverted, out-of-day, bad weekday, unknown id)', () => {
    const base = [mkSession({})];
    for (const delta of [
      { startMin: 1200, endMin: 1100 },   // inverted
      { startMin: -10 },                  // negative
      { endMin: 1500 },                   // past midnight
      { weekday: 7 as const },            // no such weekday
    ]) {
      const r = movePeriod(base, 'p1', delta);
      expect(r.ok).toBe(false);
      expect(r.sessions).toEqual(base);
    }
    const unknown = movePeriod(base, 'nope', { weekday: 1 });
    expect(unknown.ok).toBe(false);
    expect(unknown.reason).toContain('unknown');
  });

  it('cancel removes exactly one period and restores capacity; unknown id is a no-op', () => {
    const base = [mkSession({}), mkSession({ id: 'p2', weekday: 1 })];
    const after = cancelPeriod(base, 'p1');
    expect(after.map(s => s.id)).toEqual(['p2']);
    expect(capacityMinutes(after, WEEKDAY_TODAY)).toBe(WINDOW_MIN);
    expect(cancelPeriod(base, 'ghost')).toEqual(base);
  });
});

describe('buildWeekPlan (timetable-aware re-solve)', () => {
  const topics = [
    mkTopic('quadratic', { box: 1, dueIn: 0 }),
    mkTopic('trig', { box: 0 }),
  ];

  it('returns 7 days with stable per-topic uids on every day', () => {
    const week = buildWeekPlan(topics, [], []);
    expect(week).toHaveLength(7);
    for (const day of week) {
      expect(day.map(i => i.uid)).toEqual(['t_quadratic', 't_trig']);
    }
  });

  it('blocks route around class periods: gap before tuition, resume after', () => {
    const tuition = [mkSession({})]; // Thu 17:30–18:30 splits the window
    const week = buildWeekPlan(topics, [], tuition);
    const thursday = week[0]!;
    // first block fits in 16:00–17:30; nothing starts inside the class period
    expect(thursday[0]!.startMin).toBeLessThanOrEqual(1050 - 40 + 60); // placed in first gap
    for (const item of thursday) {
      if (item.startMin === null) continue;
      expect(item.startMin < 1050 || item.startMin >= 1110).toBe(true);
    }
  });

  it('moving a period re-solves the same day differently (same-frame contract)', () => {
    const before = buildWeekPlan(topics, [], [mkSession({})])[0]!;
    const after = buildWeekPlan(
      topics, [],
      movePeriod([mkSession({})], 'p1', { startMin: 960, endMin: 1020 }).sessions, // 16:00–17:00
    )[0]!;
    // first block now starts at/after the earlier class ends
    expect(after.some(i => i.startMin !== null && i.startMin >= 1020)).toBe(true);
    expect(before).not.toEqual(after);
  });

  it('exam proximity still drives why-text through the week path', () => {
    const week = buildWeekPlan(topics, [exam], []);
    const trig = week[0]!.find(i => i.topic.id === 'trig');
    expect(trig?.examLinked).toBe(true);
    expect(trig?.why).toContain('Exam in');
  });
});
