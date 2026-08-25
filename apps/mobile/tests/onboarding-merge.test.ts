import { describe, it, expect } from 'vitest';
import { importedTopics, importedMeta, mergeWizardTopics } from '../src/lib/onboarding-merge';

/** minimal Topic-ish shape — only id/subjectId matter to the merge helpers */
type T = { id: string; subjectId: string };

const seeded: T[] = [
  { id: '📐', subjectId: '📐' },
  { id: 'custom-sanskrit', subjectId: '📖-2' },
];
const imported: T[] = [
  { id: 'imported-mathematics-ch-1', subjectId: 'imported-mathematics' },
  { id: 'imported-physics-units', subjectId: 'imported-physics' },
];

describe('onboarding-merge · mid-wizard import reconciliation (c5 L6 F8)', () => {
  it('importedTopics selects only imported-subject store topics', () => {
    expect(importedTopics([...seeded, ...imported])).toEqual(imported);
    expect(importedTopics(seeded)).toEqual([]);
  });

  it('importedMeta keeps only imported-* keys', () => {
    expect(importedMeta({ '📐': { name: 'Maths' }, 'imported-physics': { name: 'Physics' } })).toEqual({
      'imported-physics': { name: 'Physics' },
    });
  });

  it('mergeWizardTopics appends stored imports without duplicates', () => {
    const merged = mergeWizardTopics(seeded, [...seeded, ...imported]);
    expect(merged.map(t => t.id)).toEqual([
      '📐',
      'custom-sanskrit',
      'imported-mathematics-ch-1',
      'imported-physics-units',
    ]);
  });

  it('wizard-seeded ids win collisions (no double-seeding)', () => {
    const stored = [{ id: '📐', subjectId: 'imported-stale' }, ...imported];
    const merged = mergeWizardTopics(seeded, stored);
    expect(merged.filter(t => t.id === '📐')).toHaveLength(1);
    expect(merged.find(t => t.id === '📐')!.subjectId).toBe('📐');
  });
});
