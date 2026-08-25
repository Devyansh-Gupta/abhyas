/**
 * P3 OCR import — pure selection logic for the review stage
 * (apps/mobile/src/lib/import-selection.ts): toggling subjects/topics,
 * tick-all cascade, footer counts, key derivation.
 */
import { describe, it, expect } from 'vitest';
import {
  draftFromParsed, initialSelection, toggleSubject, toggleTopic,
  countSelected, isSubjectFullySelected, slugify,
} from '../src/lib/import-selection';

const sample = {
  subjects: [
    { name: 'Mathematics', topics: ['Quadratic Equations', 'Trigonometry'] },
    { name: 'Science', topics: ['Chemical Reactions'] },
    { name: 'Mathematics', topics: ['Probability'] }, // duplicate name → deduped key
  ],
};

const draft = () => draftFromParsed(sample);

describe('draftFromParsed', () => {
  it('slugifies subject names to readable keys', () => {
    const d = draft();
    expect(d[0].key).toBe('mathematics');
    expect(d[1].key).toBe('science');
  });

  it('dedupes colliding subject keys with numeric suffixes', () => {
    const d = draft();
    expect(d[2].key).toBe('mathematics-2');
  });

  it('derives topic keys as <subjectKey>/<topicSlug> and keeps them unique', () => {
    const d = draft();
    expect(d[0].topics.map(t => t.key)).toEqual(['mathematics/quadratic-equations', 'mathematics/trigonometry']);
    // same topic text under the duplicated subject stays unique via subject prefix
    expect(d[2].topics[0].key).toBe('mathematics-2/probability');
  });

  it('falls back to indexed keys for blank/unsluggable topics', () => {
    const d = draftFromParsed({ subjects: [{ name: 'Art', topics: ['', '!!!', 'Sketching'] }] });
    expect(d[0].topics.map(t => t.key)).toEqual(['art/topic-1', 'art/topic-2', 'art/sketching']);
  });

  it('slugify never returns empty (blank name → "subject")', () => {
    expect(slugify('')).toBe('subject');
    expect(slugify('  --  ')).toBe('subject');
    expect(slugify('Computer Science & Lab')).toBe('computer-science-lab');
  });
});

describe('selection toggling', () => {
  it('initialSelection ticks everything (user curates down)', () => {
    const sel = initialSelection(draft());
    expect(countSelected(draft(), sel)).toEqual({ subjects: 3, topics: 4 });
  });

  it('toggleSubject cascades to all its topics only', () => {
    const d = draft();
    let sel = initialSelection(d);
    sel = toggleSubject(d, sel, 'mathematics', false);
    // maths topics unticked, science untouched
    expect(countSelected(d, sel)).toEqual({ subjects: 2, topics: 2 });
    expect(sel.topics['mathematics/quadratic-equations']).toBe(false);
    expect(sel.topics['science/chemical-reactions']).toBe(true);
    // re-tick restores all maths topics
    sel = toggleSubject(d, sel, 'mathematics', true);
    expect(countSelected(d, sel)).toEqual({ subjects: 3, topics: 4 });
  });

  it('toggleSubject is pure — original state untouched', () => {
    const d = draft();
    const sel = initialSelection(d);
    toggleSubject(d, sel, 'science', false);
    expect(sel.topics['science/chemical-reactions']).toBe(true);
    expect(countSelected(d, sel)).toEqual({ subjects: 3, topics: 4 });
  });

  it('toggleTopic flips one row and returns same reference on no-op', () => {
    const d = draft();
    const sel = initialSelection(d);
    const next = toggleTopic(sel, 'mathematics/trigonometry', false);
    expect(next.topics['mathematics/trigonometry']).toBe(false);
    expect(next.topics['mathematics/quadratic-equations']).toBe(true);
    expect(toggleTopic(next, 'mathematics/trigonometry', false)).toBe(next); // no-op identity
  });

  it('unticking every topic of a subject drops that subject from the count', () => {
    const d = draft();
    let sel = initialSelection(d);
    for (const t of d[0].topics) sel = toggleTopic(sel, t.key, false);
    const c = countSelected(d, sel);
    expect(c).toEqual({ subjects: 2, topics: 2 }); // maths header still ticked but 0 picked → excluded
    expect(isSubjectFullySelected(d, sel, 'mathematics')).toBe(false);
  });
});

describe('countSelected / header state', () => {
  it('all-zero selection → {0,0} (footer disabled condition)', () => {
    const d = draft();
    let sel = initialSelection(d);
    for (const s of d) sel = toggleSubject(d, sel, s.key, false);
    expect(countSelected(d, sel)).toEqual({ subjects: 0, topics: 0 });
  });

  it('isSubjectFullySelected reflects tick-all state after partial unticks', () => {
    const d = draft();
    let sel = initialSelection(d);
    expect(isSubjectFullySelected(d, sel, 'mathematics')).toBe(true);
    sel = toggleTopic(sel, 'mathematics/quadratic-equations', false);
    expect(isSubjectFullySelected(d, sel, 'mathematics')).toBe(false);
    sel = toggleSubject(d, sel, 'mathematics', true); // cascade re-ticks everything
    expect(isSubjectFullySelected(d, sel, 'mathematics')).toBe(true);
  });

  it('counts are exact per-row arithmetic (N subjects · M topics)', () => {
    const d = draft();
    let sel = initialSelection(d);
    sel = toggleTopic(sel, 'science/chemical-reactions', false);
    sel = toggleSubject(d, sel, 'mathematics-2', false);
    expect(countSelected(d, sel)).toEqual({ subjects: 1, topics: 2 });
  });
});
