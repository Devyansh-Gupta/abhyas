/**
 * Cycle-5 L4 — pure selection logic for the exam-import review stage
 * (apps/mobile/src/lib/exam-import-selection.ts): row derivation, tick-all
 * initial state, toggling, footer counts.
 */
import { describe, it, expect } from 'vitest';
import {
  rowsFromParsed, initialSelection, toggleExam, countSelected,
} from '../src/lib/exam-import-selection';

const parsed = [
  { name: 'Advanced Data Structures', date: '2026-09-03', session: 'FN' },
  { name: 'Theory of Computation', date: '2026-09-04', session: 'AN' },
  { name: 'Machine Learning', date: '2026-09-04' },
];

describe('rowsFromParsed', () => {
  it('derives one stable keyed row per parsed exam', () => {
    const rows = rowsFromParsed(parsed);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map(r => r.key)).size).toBe(3);
    expect(rows[0]).toMatchObject({ name: 'Advanced Data Structures', date: '2026-09-03', session: 'FN' });
  });

  it('keeps keys unique even for identical names', () => {
    const rows = rowsFromParsed([
      { name: 'Mathematics', date: '2026-09-01' },
      { name: 'Mathematics', date: '2026-09-02' },
    ]);
    expect(new Set(rows.map(r => r.key)).size).toBe(2);
  });

  it('handles unsluggable names without crashing', () => {
    const rows = rowsFromParsed([{ name: '!!!', date: '2026-09-01' }]);
    expect(rows[0].key).toBe('exam-0');
  });
});

describe('selection', () => {
  const rows = rowsFromParsed(parsed);

  it('starts with everything ticked', () => {
    expect(countSelected(rows, initialSelection(rows))).toBe(3);
  });

  it('toggling off reduces the count; footer gate hits zero', () => {
    let sel = initialSelection(rows);
    sel = toggleExam(sel, rows[0].key, false);
    expect(countSelected(rows, sel)).toBe(2);
    sel = toggleExam(sel, rows[1].key, false);
    sel = toggleExam(sel, rows[2].key, false);
    expect(countSelected(rows, sel)).toBe(0);
  });

  it('toggling does not mutate the previous selection object', () => {
    const before = initialSelection(rows);
    const after = toggleExam(before, rows[0].key, false);
    expect(before[rows[0].key]).toBe(true);
    expect(after[rows[0].key]).toBe(false);
  });
});
