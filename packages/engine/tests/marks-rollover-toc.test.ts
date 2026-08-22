import { describe, it, expect } from 'vitest';
import { recalibrate, countChanged } from '../src/marks.js';
import { computeCarry } from '../src/rollover.js';
import { parseToc } from '../src/toc.js';
import type { Topic } from '../src/types.js';

const mk = (id: string, subjectId: string, box: number): Topic =>
  ({ id, subjectId, name: id, box, dueIn: 5, weight: 5, coverage: 'in_progress', backlog: false });

describe('marks recalibration (F11/F24 contract)', () => {
  const topics = [mk('q', '📐', 2), mk('l', '⚗️', 3), mk('n', '📐', 0), mk('m', '📐', 5)];
  it('<40% drops same-subject boxes and makes them due now', () => {
    const after = recalibrate(topics, '📐', 35);
    expect(after[0]).toMatchObject({ box: 1, dueIn: 0 });
    expect(after[1]).toMatchObject({ box: 3 }); // other subject untouched
    expect(after[2]).toMatchObject({ box: 0 }); // new topics untouched
    expect(countChanged(topics, after)).toBe(1);
  });
  it('≥80% promotes; graduation exits rotation', () => {
    const after = recalibrate(topics, '📐', 85);
    expect(after[0]!.box).toBe(3);
    const grad = recalibrate([mk('x', '📐', 4)], '📐', 90);
    expect(grad[0]).toMatchObject({ box: 5, dueIn: 99 });
  });
  it('mid-band changes nothing', () => {
    expect(recalibrate(topics, '📐', 60)).toEqual(topics);
  });
});

describe('rollover carry (decision #3 contract)', () => {
  const items = [
    { uid: 'r1', kind: 'rev' as const },
    { uid: 'f1', kind: 'new' as const, examLinked: false },
    { uid: 'f2', kind: 'new' as const, examLinked: true },
    { uid: 'f3', kind: 'new' as const, examLinked: false },
  ];
  it('carries ≤2 forward-work only, exam-linked first; revisions never carried', () => {
    const r = computeCarry(items as never, new Set());
    expect(r.carried.map(i => i.uid)).toEqual(['f2', 'f1']);
    expect(r.carried.every(i => i.kind !== 'rev')).toBe(true);
    expect(r.droppedRevisions).toBe(1);
  });
  it('done items are not carried', () => {
    const r = computeCarry(items as never, new Set(['f2', 'f1']));
    expect(r.carried.map(i => i.uid)).toEqual(['f3']);
  });
});

describe('TOC parser (F4/F25 contract)', () => {
  it('newline-stripped paste with inline numbering (F4 regression)', () => {
    expect(parseToc('1. Chemical Reactions 2. Acids and Bases 3. Metals'))
      .toEqual(['Chemical Reactions', 'Acids and Bases', 'Metals']);
  });
  it('preserves pre-number fragments (no data loss)', () => {
    expect(parseToc('quadratic equations 4. Quadratic Equations 5. Polynomials'))
      .toEqual(['quadratic equations', 'Quadratic Equations', 'Polynomials']);
  });
  it('strips punctuation & handles two-digit numbers', () => {
    expect(parseToc('10. Heredity.\n11) Our Environment]'))
      .toEqual(['Heredity', 'Our Environment']);
  });
  it('empty/whitespace → empty array', () => {
    expect(parseToc('   \n ')).toEqual([]);
  });
});
