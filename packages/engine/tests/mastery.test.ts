import { describe, it, expect } from 'vitest';
import { masteryBySubject } from '../src/mastery.js';
import type { Topic } from '../src/types.js';

const t = (id: string, subjectId: string, box: number): Topic =>
  ({ id, subjectId, name: id, box, dueIn: 0, weight: 5, coverage: 'in_progress', backlog: false });

describe('masteryBySubject (#7)', () => {
  it('averages clamped boxes per subject as 0–100, first-seen order', () => {
    expect(masteryBySubject([
      t('a', '📐', 5), t('b', '📐', 1), t('c', '🧪', 0),
    ])).toEqual([
      { subjectId: '📐', pct: 60, topics: 2 },
      { subjectId: '🧪', pct: 0, topics: 1 },
    ]);
  });

  it('empty input → empty output (no phantom bars)', () => {
    expect(masteryBySubject([])).toEqual([]);
  });

  it('out-of-range boxes clamp into [0,5]', () => {
    expect(masteryBySubject([t('x', '📘', 9), t('y', '📘', -2)])).toEqual([
      { subjectId: '📘', pct: 50, topics: 2 },
    ]);
  });
});
