import { describe, it, expect } from 'vitest';
import { PRESETS, presetsFor, topicsFromPreset } from '../src/index.js';

describe('preset library (T1)', () => {
  it('all bundles well-formed: unique stable topic ids, sane names', () => {
    for (const p of PRESETS) {
      const ids = p.topics.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length); // no dupes
      expect(p.id).toMatch(/@\d{4}-\d{2}$/);       // year-versioned id
      expect(p.topics.length).toBeGreaterThanOrEqual(3);
      for (const t of p.topics) {
        expect(t.name.length).toBeGreaterThan(1);
        expect(t.id).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  it('presetsFor filters by board+class', () => {
    expect(presetsFor('CBSE', 10).length).toBe(2);
    expect(presetsFor('CBSE', 12).map(p => p.subject)).toEqual(['Physics']);
    // P3 expansion: state boards are now registered (was "long tail → T2 builder")
    expect(presetsFor('Maharashtra', 10).length).toBe(6);
    expect(presetsFor('ICSE', 9).length).toBe(10);
    expect(presetsFor('ICSE', 10).length).toBe(10);
    expect(presetsFor('Tamil Nadu', 9)).toEqual([]); // unregistered board/class still → []
  });

  it('topicsFromPreset instantiates engine topics with provenance', () => {
    const p = presetsFor('CBSE', 10)[0]!;
    const inst = topicsFromPreset(p, 'covered');
    expect(inst.kind).toBe('core');
    expect(inst.topics[0]).toMatchObject({
      box: 0,
      coverage: 'covered',
      backlog: true,           // mid-year calibration → catching-up pool
      sourceRef: inst.topics[0]!.id, // stable link to preset
    });
  });
});
