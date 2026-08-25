/**
 * Cycle-5 L4 goldens — parseExamTimetable (packages/engine/src/import/exams.ts).
 * Fixture shapes mirror real Indian datesheets (e.g. the MCA IA-1 sheet):
 * day/date/session rows with subject-code parens, month-name dates,
 * multi-subject days via continuation lines.
 */
import { describe, it, expect } from 'vitest';
import { parseExamTimetable } from '../src/import/exams';

describe('parseExamTimetable', () => {
  it('parses numeric datesheet rows with subject-code parens and FN/AN sessions', () => {
    const r = parseExamTimetable([
      '03.09.2026 (Thursday)  Advanced Data Structures (25MCAIAI301)  FN',
      '04.09.2026 (Friday)    Theory of Computation (25MCAIAI302)   AN',
    ]);
    expect(r.warnings).toEqual([]);
    expect(r.exams).toHaveLength(2);
    expect(r.exams[0]?.name).toBe('Advanced Data Structures');
    expect(r.exams[0]?.date).toBe('2026-09-03');
    expect(r.exams[0]?.session).toBe('FN');
    expect(r.exams[1]?.name).toBe('Theory of Computation');
    expect(r.exams[1]?.date).toBe('2026-09-04');
    expect(r.exams[1]?.session).toBe('AN');
  });

  it('parses month-name dates ("3 Sep 2026") including ordinal and prefix forms', () => {
    const r = parseExamTimetable([
      '3 Sep 2026  Operating Systems',
      '5th September 2026  Software Engineering',
      'Sep 7  Computer Networks',
    ]);
    expect(r.exams.map(e => e.date)).toEqual(['2026-09-03', '2026-09-05', '2026-09-07']);
    expect(r.exams.map(e => e.name)).toEqual([
      'Operating Systems',
      'Software Engineering',
      'Computer Networks',
    ]);
  });

  it('attaches non-date continuation lines to the previous date (multi-subject days)', () => {
    const r = parseExamTimetable([
      '03.09.2026 (Thursday)  Advanced Data Structures (25MCAIAI301) FN',
      'Machine Learning (25MCAIAI305)',
      '',
      '04.09.2026 (Friday)  Compiler Design (25MCAIAI304) AN',
    ]);
    expect(r.exams).toHaveLength(3);
    expect(r.exams[0]?.date).toBe('2026-09-03');
    expect(r.exams[1]).toEqual({ name: 'Machine Learning', date: '2026-09-03', session: undefined });
    expect(r.exams[2]?.date).toBe('2026-09-04');
  });

  it('warns on non-date preamble lines instead of inventing exams', () => {
    const r = parseExamTimetable([
      'MCA Semester III — IA-1 Timetable',
      'Department of Computer Applications',
      '03.09.2026  Databases FN',
    ]);
    expect(r.exams).toEqual([{ name: 'Databases', date: '2026-09-03', session: 'FN' }]);
    expect(r.warnings.some(w => w.includes('skipped 2 non-date lines'))).toBe(true);
  });

  it('returns a retry warning when zero dated rows are found', () => {
    const r = parseExamTimetable(['random note one', 'random note two']);
    expect(r.exams).toHaveLength(0);
    expect(r.warnings.some(w => w.includes('No dated exam rows'))).toBe(true);
  });

  it('carries a header-row session hint (FN/AN columns) onto undated-session rows', () => {
    const r = parseExamTimetable([
      'DATE        SESSION-I     SESSION-II',
      'FN          AN',
      '21.08.2026  Mathematics   Physics',
    ]);
    // header rows set pendingSession=FN before the first date; the dated row
    // inherits it for its paper
    expect(r.exams[0]?.date).toBe('2026-08-21');
    expect(r.exams[0]?.session).toBe('FN');
  });

  it('is resilient to letter-spaced garbage — never throws, warns when nothing parses', () => {
    const junk = ['a b c d e f g', 'x y z 9 8 7', '!!! ### @@@'];
    let r: ReturnType<typeof parseExamTimetable> | undefined;
    expect(() => { r = parseExamTimetable(junk); }).not.toThrow();
    expect(r!.exams).toHaveLength(0);
    expect(r!.warnings.length).toBeGreaterThan(0);
  });

  it('normalizes dashed/slash dates with 2-digit years day-first', () => {
    const r = parseExamTimetable([
      '10-9-26  Discrete Mathematics',
      '12/09/2026 Digital Electronics AN',
    ]);
    expect(r.exams.map(e => e.date)).toEqual(['2026-09-10', '2026-09-12']);
  });
});
