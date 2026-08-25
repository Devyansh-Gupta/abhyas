import { describe, it, expect } from 'vitest';
import { fmtClock, toMinutes } from '../src/ui/time';

describe('fmtClock (c5 F7)', () => {
  it('24h mode renders zero-padded HH:MM', () => {
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(17 * 60 + 30)).toBe('17:30');
    expect(fmtClock(22 * 60 + 30, '24')).toBe('22:30');
  });

  it('12h mode renders h:MM AM/PM with noon/midnight handling', () => {
    expect(fmtClock(0, '12')).toBe('12:00 AM');
    expect(fmtClock(9 * 60, '12')).toBe('9:00 AM');
    expect(fmtClock(12 * 60, '12')).toBe('12:00 PM');
    expect(fmtClock(17 * 60 + 30, '12')).toBe('5:30 PM');
    expect(fmtClock(23 * 60 + 59, '12')).toBe('11:59 PM');
  });

  it("accepts an existing 'HH:MM' string", () => {
    expect(toMinutes('17:30')).toBe(1050);
    expect(fmtClock('08:05', '12')).toBe('8:05 AM');
  });

  it('wraps end-of-day overflow minutes past midnight', () => {
    expect(fmtClock(1440 + 90)).toBe('01:30');
    expect(fmtClock(-60)).toBe('23:00');
  });
});
