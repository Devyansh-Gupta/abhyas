import { describe, it, expect } from 'vitest';
import {
  createGuardianInvite,
  decodeGuardianCode,
  guardianSign,
  guardianSummary,
  weeklyFocusMinutes,
  GUARDIAN_LINK_TTL_DAYS,
} from '../src/guardian.js';
import { type Topic } from '../src/types.js';
import { type StreakState } from '../src/streak.js';

const t = (id: string, subjectId: string, box: number): Topic =>
  ({ id, subjectId, name: id, box, dueIn: 0, weight: 5, coverage: 'in_progress', backlog: false });

const streak = (current = 3, longest = 9): StreakState =>
  ({ current, longest, missed: 0, countedToday: false });

describe('guardian invite codes (P2 parent link)', () => {
  it('round-trips: decode(encode) returns the exact payload', () => {
    const inv = createGuardianInvite({ studentId: 'local-student', dayIndex: 42 });
    const r = decodeGuardianCode(inv.code, { todayDay: 42 });
    expect(r).toEqual({
      ok: true,
      payload: { studentId: 'local-student', issuedDay: 42, ttlDays: GUARDIAN_LINK_TTL_DAYS, n: 0 },
      expiresDay: 42 + GUARDIAN_LINK_TTL_DAYS,
    });
  });

  it('golden: deterministic code for fixed inputs', () => {
    expect(guardianSign('abc', 'secret')).toBe('1cnl8gl');
    const inv = createGuardianInvite({ studentId: 's1', dayIndex: 7, ttlDays: 30, nonce: 2, secret: 'k' });
    // same inputs → byte-identical invite (golden)
    expect(createGuardianInvite({ studentId: 's1', dayIndex: 7, ttlDays: 30, nonce: 2, secret: 'k' }))
      .toEqual(inv);
  });

  it('rejects an edited body as bad_signature', () => {
    const inv = createGuardianInvite({ studentId: 's1', dayIndex: 0 });
    const body = inv.code.split('.')[0]!;
    const sig = inv.code.split('.')[1]!;
    const tampered = `${body.slice(0, -2)}xy.${sig}`;
    const r = decodeGuardianCode(tampered, { todayDay: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });

  it('rejects a wrong secret as bad_signature (handshake swap-safe)', () => {
    const inv = createGuardianInvite({ studentId: 's1', dayIndex: 0, secret: 'a' });
    const r = decodeGuardianCode(inv.code, { todayDay: 0, secret: 'b' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });

  it('expires after ttl and reports both days in detail', () => {
    const inv = createGuardianInvite({ studentId: 's1', dayIndex: 10, ttlDays: 5 });
    expect(decodeGuardianCode(inv.code, { todayDay: 15 }).ok).toBe(true);   // boundary day valid
    const r = decodeGuardianCode(inv.code, { todayDay: 16 });
    expect(r).toMatchObject({ ok: false, reason: 'expired', detail: 'valid through day 15, today is 16' });
  });

  it('no silent failure: malformed codes get a typed reason', () => {
    const reasonOf = (code: string): string => {
      const r = decodeGuardianCode(code, { todayDay: 0 });
      return r.ok ? 'ok' : r.reason;
    };
    expect(reasonOf('')).toBe('malformed');
    expect(reasonOf('garbage')).toBe('malformed');
    expect(reasonOf('a.b.c')).toBe('malformed');
    // signature is checked before the body, so an illegal-char body with a fake sig reads bad_signature
    expect(reasonOf('!!!.0000000')).toBe('bad_signature');
  });

  it('unicode student ids survive the round-trip (portable utf-8)', () => {
    const inv = createGuardianInvite({ studentId: 'अभ्यास-📐', dayIndex: 3 });
    expect(decodeGuardianCode(inv.code, { todayDay: 3 })).toMatchObject({
      ok: true,
      payload: { studentId: 'अभ्यास-📐' },
    });
  });

  it('nonce disambiguates same-day re-invites', () => {
    const a = createGuardianInvite({ studentId: 's', dayIndex: 5, nonce: 0 });
    const b = createGuardianInvite({ studentId: 's', dayIndex: 5, nonce: 1 });
    expect(a.code).not.toBe(b.code);
    expect(a.id).not.toBe(b.id);
  });

  it('deep link targets the /guardian route with the code as param', () => {
    const inv = createGuardianInvite({ studentId: 's', dayIndex: 0 });
    expect(inv.deepLink).toBe(`abhyas://guardian/${inv.code}`);
  });
});

describe('weeklyFocusMinutes', () => {
  it('sums only the trailing 7-day window ending at endDay', () => {
    const sessions = [
      { day: 0, min: 10 }, { day: 4, min: 20 }, { day: 5, min: 5 },
      { day: 10, min: 99 },
    ];
    expect(weeklyFocusMinutes(sessions, 10)).toBe(124); // days 4..10
    expect(weeklyFocusMinutes(sessions, 4)).toBe(30);   // days -2..4 → day 0 + day 4
  });

  it('empty log → 0', () => {
    expect(weeklyFocusMinutes([], 100)).toBe(0);
  });
});

describe('guardianSummary (read-only view-model)', () => {
  it('derives mastery via masteryBySubject plus streak/focus stats — golden values', () => {
    const s = guardianSummary({
      topics: [t('a', '📐', 5), t('b', '📐', 0), t('c', '🧪', 3)],
      sessions: [{ day: 8, min: 25 }, { day: 9, min: 30 }, { day: 1, min: 500 }],
      streak: streak(4, 12),
      dayIndex: 9,
    });
    expect(s.subjects).toEqual([
      { subjectId: '📐', pct: 50, topics: 2 },
      { subjectId: '🧪', pct: 60, topics: 1 },
    ]);
    expect(s.totalTopics).toBe(3);
    expect(s.masteredTopics).toBe(1);
    expect(s.streakCurrent).toBe(4);
    expect(s.streakLongest).toBe(12);
    expect(s.weeklyFocusMinutes).toBe(55); // day 1 session is outside the window
  });

  it('fresh account: empty everything renders zeros, no phantom rows', () => {
    const s = guardianSummary({
      topics: [], sessions: [], streak: streak(0, 0), dayIndex: 0,
    });
    expect(s.subjects).toEqual([]);
    expect(s.totalTopics).toBe(0);
    expect(s.masteredTopics).toBe(0);
    expect(s.weeklyFocusMinutes).toBe(0);
    expect(s.streakCurrent).toBe(0);
  });
});
