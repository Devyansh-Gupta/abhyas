/**
 * c5 L5 goldens — class periods (onboarding-authored, per-weekday) must carve
 * genuinely-free study stretches out of the planner's capacity.
 *
 * Golden fixture: docs/fixtures/mca-class-timetable.png (Monday column:
 * 10:00–10:50, 11:45–12:35, 12:35–1:25, 2:10–3:50). Study window is the
 * prototype default 16:00–22:30 (STUDY_WINDOW), so weekday classes mostly
 * matter through their clamped overlap; we also probe with an afternoon window
 * to exercise real carving.
 */
import { describe, it, expect } from 'vitest';
import {
  slotsForWeekday,
  capacityMinutes,
  busyPeriods,
  classPeriodsToSessions,
  mergedClassSessions,
  countClassPeriods,
  type ClassSession,
  type ClassPeriods,
} from '../src/timetable';

const MON = 1;

/** The MCA Monday column as onboarding-authored periods (24h minutes-of-day). */
const mcaMonday: ClassPeriods = {
  [MON]: [
    { startMin: 10 * 60, endMin: 10 * 60 + 50 },        // 10:00–10:50
    { startMin: 11 * 60 + 45, endMin: 12 * 60 + 35 },   // 11:45–12:35
    { startMin: 12 * 60 + 35, endMin: 13 * 60 + 25 },   // 12:35–1:25 (back-to-back)
    { startMin: 14 * 60 + 10, endMin: 15 * 60 + 50 },   // 2:10–3:50
  ],
};

/** Afternoon study window that actually overlaps the class block. */
const AFTERNOON = { start: 11 * 60, end: 18 * 60 };

describe('classPeriodsToSessions / merge helpers', () => {
  it('flattens per-weekday periods into repo-shaped sessions with stable ids', () => {
    const flat = classPeriodsToSessions(mcaMonday);
    expect(flat.map(s => s.id)).toEqual(['p_1_0', 'p_1_1', 'p_1_2', 'p_1_3']);
    expect(flat.every(s => s.weekday === MON && s.subjectId === 'class')).toBe(true);
  });

  it('merges plan-tab sessions with onboarding periods without mutating either', () => {
    const planTab: ClassSession[] = [{ id: 'lab', subjectId: '🔬', weekday: 3, startMin: 17 * 60, endMin: 19 * 60 }];
    const merged = mergedClassSessions(planTab, mcaMonday);
    expect(merged.length).toBe(5);
    expect(planTab.length).toBe(1);
  });

  it('counts authored periods across weekdays', () => {
    expect(countClassPeriods({ ...mcaMonday, [5]: [{ startMin: 600, endMin: 650 }] })).toBe(5);
    expect(countClassPeriods({})).toBe(0);
  });
});

describe('planner excludes class hours from capacity', () => {
  const win = { window: AFTERNOON };

  it('busyPeriods returns exactly the day’s authored intervals', () => {
    expect(busyPeriods(classPeriodsToSessions(mcaMonday), MON)).toEqual([
      [600, 650], [705, 755], [755, 805], [850, 950],
    ]);
    // other weekdays untouched
    expect(busyPeriods(classPeriodsToSessions(mcaMonday), 2)).toEqual([]);
  });

  it('capacity shrinks to genuinely-free stretches (11:00–18:00 window)', () => {
    // free inside 11:00–18:00: 11:00–11:45 (classes start 11:45 via the 10:50 end
    // being before-window), 12:35 gap none (back-to-back), 13:25–14:10, 15:50–18:00
    const cap = capacityMinutes([], MON, win);
    const withClasses = capacityMinutes(classPeriodsToSessions(mcaMonday), MON, win);
    expect(cap).toBe(7 * 60); // full 11:00–18:00
    expect(withClasses).toBe(45 + 45 + 130); // 11:00–11:45, 13:25–14:10, 15:50–18:00
    // and every free slot really is class-free
    for (const slot of slotsForWeekday(classPeriodsToSessions(mcaMonday), MON, win)) {
      for (const p of mcaMonday[MON]!) {
        expect(slot.start < p.endMin && p.startMin < slot.end).toBe(false);
      }
    }
  });

  it('back-to-back periods merge into one continuous busy stretch (no phantom gaps)', () => {
    const slots = slotsForWeekday(classPeriodsToSessions(mcaMonday), MON, win)
      .map(s => `${s.start}-${s.end}`);
    // the 11:45–13:25 pair must yield NO slot between them
    expect(slots).toEqual(['660-705', '805-850', '950-1080']);
  });

  it('a day fully covered by classes yields zero capacity without crashing', () => {
    const allDay: ClassPeriods = { [MON]: [{ startMin: 0, endMin: 24 * 60 }] };
    expect(capacityMinutes(classPeriodsToSessions(allDay), MON)).toBe(0);
    expect(slotsForWeekday(classPeriodsToSessions(allDay), MON)).toEqual([]);
  });

  it('overlapping/adjacent authored periods never double-count or crash', () => {
    const messy: ClassPeriods = {
      [MON]: [
        { startMin: 600, endMin: 700 },
        { startMin: 650, endMin: 720 },   // overlaps the first
        { startMin: 720, endMin: 800 },   // touches the second
      ],
    };
    const slots = slotsForWeekday(classPeriodsToSessions(messy), MON, win);
    const total = slots.reduce((a, s) => a + (s.end - s.start), 0);
    // busy union = 600–800 (200min) ∩ window → free = 800–1080
    expect(total).toBe(280);
    expect(capacityMinutes(classPeriodsToSessions(messy), MON, win)).toBe(280);
  });

  it('absent weekday key behaves like no classes', () => {
    expect(capacityMinutes(classPeriodsToSessions({}), MON, win)).toBe(420);
  });
});
