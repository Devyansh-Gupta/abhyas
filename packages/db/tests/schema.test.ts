import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import * as s from '../src/schema.js';

describe('schema integrity', () => {
  it('exposes all PRD §10 tables', () => {
    const names = Object.keys(s);
    for (const expected of ['users', 'guardianLinks', 'subjects', 'topics', 'exams', 'classSessions', 'studySessions', 'planItems', 'assessments', 'syncLog']) {
      expect(names).toContain(expected);
    }
  });
  it('onboarding-v2 fields present', () => {
    expect('kind' in getTableColumns(s.subjects)).toBe(true);
    expect('origin' in getTableColumns(s.subjects)).toBe(true);
    expect('coverage' in getTableColumns(s.topics)).toBe(true);
    expect('backlog' in getTableColumns(s.topics)).toBe(true);
    expect('sourceRef' in getTableColumns(s.topics)).toBe(true);
  });
  it('exam window model fields present', () => {
    const cols = getTableColumns(s.exams);
    expect('windowStart' in cols).toBe(true);
    expect('datesheetConfirmed' in cols).toBe(true);
  });
  it('sync_log supports revert tracking (decision #4)', () => {
    const cols = getTableColumns(s.syncLog);
    expect('clientTs' in cols).toBe(true);
    expect('revertedBy' in cols).toBe(true);
  });
});
