/**
 * P3 preset-expansion golden tests: structural validity of the whole library
 * (ICSE Class 9–10, Maharashtra SSC / Tamil Nadu / Karnataka SSLC Class 10).
 * Pure data checks — no RN imports.
 */
import { describe, it, expect } from 'vitest';
import { BOARDS, PRESETS, presetsFor } from '../src/index.js';

const REQUIRED_FIELDS = ['id', 'board', 'class', 'subject', 'emoji', 'acadYear', 'version', 'kind', 'topics'] as const;

describe('preset library structure (P3 expansion)', () => {
  it('every preset carries all required fields with sane values', () => {
    for (const p of PRESETS) {
      for (const f of REQUIRED_FIELDS) expect(p[f], `${p.id} missing ${f}`).toBeDefined();
      expect([5, 6, 7, 8, 9, 10, 11, 12]).toContain(p.class);
      expect(['core', 'elective', 'additional']).toContain(p.kind);
      expect(p.acadYear).toMatch(/^\d{4}-\d{2}$/);
      expect(p.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(p.emoji.length).toBeGreaterThan(0);
      // weight defaults sane when present (1..15 scale)
      if (p.weight !== undefined) expect(p.weight).toBeGreaterThanOrEqual(1);
      if (p.weight !== undefined) expect(p.weight).toBeLessThanOrEqual(15);
    }
  });

  it('topic ids are unique within each preset, kebab-case, weights in 1..10', () => {
    for (const p of PRESETS) {
      const ids = p.topics.map(t => t.id);
      expect(new Set(ids).size, `dup ids in ${p.id}`).toBe(ids.length);
      for (const t of p.topics) {
        expect(t.id).toMatch(/^[a-z0-9-]+$/);
        expect(t.name.trim().length).toBeGreaterThan(1);
        if (t.weight !== undefined) {
          expect(t.weight, `${p.id}/${t.id} weight`).toBeGreaterThanOrEqual(1);
          expect(t.weight, `${p.id}/${t.id} weight`).toBeLessThanOrEqual(10);
        }
      }
      expect(p.topics.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('registers ICSE class 9 and 10 with realistic chapter-level depth', () => {
    for (const cls of [9, 10]) {
      const ps = presetsFor('ICSE', cls);
      const subjects = ps.map(p => p.subject);
      // core Group I/II subjects + electives registered per class
      for (const s of [
        'English Language & Literature', 'Hindi', 'History & Civics', 'Geography',
        'Mathematics', 'Physics', 'Chemistry', 'Biology',
        'Computer Applications', 'Commercial Studies',
      ]) expect(subjects).toContain(s);
      for (const p of ps) {
        expect(p.topics.length).toBeGreaterThanOrEqual(5);
        expect(p.id.startsWith(`icse·class${cls}·`)).toBe(true);
      }
    }
    // elective kind on the optional subjects
    for (const p of presetsFor('ICSE', 10)) {
      if (['Computer Applications', 'Commercial Studies'].includes(p.subject)) {
        expect(p.kind).toBe('elective');
      }
    }
  });

  it('registers Maharashtra SSC, Tamil Nadu Samacheer Kalvi and Karnataka SSLC class 10 with sourced notes', () => {
    const expectedBoards = ['Maharashtra', 'Tamil Nadu', 'Karnataka'];
    for (const board of expectedBoards) {
      const ps = presetsFor(board, 10);
      expect(ps.length, board).toBeGreaterThanOrEqual(3);
      for (const p of ps) {
        expect(p._note, `${p.id} should cite its source`).toBeDefined();
        expect(p._note!.length).toBeGreaterThan(20);
        expect(p.board).toBe(board);
      }
    }
    expect(BOARDS).toEqual(['CBSE', 'ICSE', 'Maharashtra', 'Tamil Nadu', 'Karnataka']);
  });

  it('state-board maths/science/social presets cover their split paper structures', () => {
    // Maharashtra splits maths & science into two papers each
    const mhSubjects = presetsFor('Maharashtra', 10).map(p => p.subject);
    expect(mhSubjects).toContain('Mathematics Part 1 — Algebra');
    expect(mhSubjects).toContain('Mathematics Part 2 — Geometry');
    expect(mhSubjects).toContain('Science & Technology Part 1');
    expect(mhSubjects).toContain('Science & Technology Part 2');
    // TN & KA use combined single-paper Science/Social Science
    expect(presetsFor('Tamil Nadu', 10).map(p => p.subject)).toEqual(
      expect.arrayContaining(['Mathematics', 'Science', 'Social Science']),
    );
    expect(presetsFor('Karnataka', 10).map(p => p.subject)).toEqual(
      expect.arrayContaining(['Mathematics', 'Science', 'Social Science']),
    );
  });
});
