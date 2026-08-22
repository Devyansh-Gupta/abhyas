import { describe, it, expect } from 'vitest';
import { applyRating, revMinutes, dueTopics } from '../src/srs.js';
import { intervalsFor } from '../src/types.js';

const t = (box: number, dueIn = 0, weight = 5) => ({ box, dueIn, weight });

describe('applyRating', () => {
  it('Solid promotes and reschedules via INTERVALS', () => {
    expect(applyRating(t(1), 3)).toEqual({ box: 2, dueIn: 3 });
  });
  it('Getting-there holds with dueIn re-pinned', () => {
    expect(applyRating(t(2), 2)).toEqual({ box: 2, dueIn: 3 });
  });
  it('Shaky drops one box', () => {
    expect(applyRating(t(2), 1)).toEqual({ box: 1, dueIn: 1 });
  });
  it('Shaky floors at box 1', () => {
    expect(applyRating(t(1), 1)).toEqual({ box: 1, dueIn: 1 });
  });
  it('mastery ceiling: Solid on box4 graduates (99)', () => {
    expect(applyRating({ box: 4, dueIn: 7 }, 3)).toEqual({ box: 5, dueIn: 99 });
  });
});

describe('learning dial', () => {
  it('multiplier scales intervals', () => {
    expect(intervalsFor('fast_forget')).toEqual([0, 1, 2, 5, 11, 25]);
    expect(intervalsFor('average')).toEqual([0, 1, 3, 7, 16, 35]);
    expect(intervalsFor('strong_memory')).toEqual([0, 1, 4, 10, 22, 49]);
  });
  it('dial flows through ratings', () => {
    const fast = applyRating(t(1), 3, 'fast_forget');
    expect(fast.dueIn).toBe(2);
  });
});

describe('revMinutes', () => {
  it('maps box → minutes with clamping (box indexes the table directly)', () => {
    expect(revMinutes(1)).toBe(20);
    expect(revMinutes(2)).toBe(30);
    expect(revMinutes(3)).toBe(40);
    expect(revMinutes(4)).toBe(40); // clamped at table end (prototype gave 20 by accident)
    expect(revMinutes(9)).toBe(40);
  });
});

describe('dueTopics', () => {
  const topics = [
    { id: 'a', box: 2, dueIn: 0, weight: 5 },
    { id: 'b', box: 1, dueIn: 0, weight: 5 },
    { id: 'c', box: 5, dueIn: 0, weight: 9 }, // mastered — excluded
    { id: 'd', box: 0, dueIn: -1, weight: 9 }, // new — excluded
    { id: 'e', box: 1, dueIn: 0, weight: 8 },
  ] as never[];
  it('returns only due, unmastered topics; weakest first, then heavier weight; capped', () => {
    const got = dueTopics(topics, 2);
    expect(got.map(x => x.id)).toEqual(['e', 'b']);
  });
});
