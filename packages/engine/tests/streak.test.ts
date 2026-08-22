import { describe, it, expect } from 'vitest';
import { rollover, bumpToday, initialStreak, qualifies } from '../src/streak.js';

describe('streak (F22/F23 contract — ported from tests/streak-break.test.js)', () => {
  it('one missed day is forgiven; streak holds', () => {
    const s = { ...initialStreak(), current: 12 };
    const r = rollover(s, { blocksDone: 0, focusMinutes: 0 });
    expect(r.broke).toBe(false);
    expect(r.state.current).toBe(12);
    expect(r.state.missed).toBe(1);
  });

  it('two consecutive misses BREAK to 0 with flag + counter reset', () => {
    let s = { ...initialStreak(), current: 13, countedToday: true };
    s = rollover(s, { blocksDone: 0, focusMinutes: 0 }).state;
    const r = rollover(s, { blocksDone: 0, focusMinutes: 0 });
    expect(r.broke).toBe(true);
    expect(r.state.current).toBe(0);
    expect(r.state.missed).toBe(0);
  });

  it('re-earns after break: bump → 1', () => {
    const s = initialStreak();
    const after = bumpToday(s, { blocksDone: 1, focusMinutes: 0 });
    expect(after.current).toBe(1);
    expect(after.countedToday).toBe(true);
  });

  it('earned rollover increments once, not twice', () => {
    const bumped = bumpToday({ ...initialStreak(), current: 1 }, { blocksDone: 1, focusMinutes: 0 });
    const r = rollover(bumped, { blocksDone: 1, focusMinutes: 30 });
    expect(r.state.current).toBe(2); // counted today ⇒ no double increment
  });

  it('OR-rule boundary: exactly 10 minutes qualifies', () => {
    expect(qualifies({ blocksDone: 0, focusMinutes: 10 })).toBe(true);
    expect(qualifies({ blocksDone: 0, focusMinutes: 9 })).toBe(false);
  });

  it('longest tracks the peak', () => {
    let s = { ...initialStreak(), current: 5, longest: 5 };
    s = bumpToday(s, { blocksDone: 1, focusMinutes: 0 });
    expect(s.longest).toBe(6);
  });
});
