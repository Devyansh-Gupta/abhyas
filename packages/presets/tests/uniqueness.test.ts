/**
 * c5 L1a golden: no two seeded topics may share a subjectId within any single
 * board/class combo. v1 used the emoji as subjectId; glyphs collide (custom
 * subjects seed as 📖 next to core English 📖), producing duplicate React keys
 * ("Encountered two children with the same key `📖`") and merged groups in the
 * Subjects/Progress tabs. The mobile seeding layer mints unique ids; this test
 * pins the preset-registry half of that invariant across EVERY combo.
 */
import { describe, it, expect } from 'vitest';
import { BOARDS, presetsFor, topicsFromPreset } from '../src/index.js';

const CLASSES = [9, 10, 11, 12] as const;

describe('golden (c5 L1a): seeded topics have unique subjectIds per board/class', () => {
  for (const board of BOARDS) {
    for (const cls of CLASSES) {
      const presets = presetsFor(board, cls);
      it(`${board} · class ${cls}${presets.length ? '' : ' (no presets — vacuous)'}`, () => {
        const seeded = presets.flatMap(p => topicsFromPreset(p, 'unstarted').topics);
        // every preset seeds under its OWN subjectId — no glyph reuse across
        // subjects (a collision would merge two subjects' groups + React keys)
        const subjectIds = new Set(seeded.map(t => t.subjectId));
        expect(subjectIds.size).toBe(presets.length);
        // and topic ids stay globally unique across the combined seed set
        const topicIds = seeded.map(t => t.id);
        expect(new Set(topicIds).size).toBe(topicIds.length);
      });
    }
  }

  it('preset emojis are distinct WITHIN each board/class combo (display glyphs too)', () => {
    for (const board of BOARDS) {
      for (const cls of CLASSES) {
        const emojis = presetsFor(board, cls).map(p => p.emoji);
        expect(new Set(emojis).size).toBe(emojis.length);
      }
    }
  });
});
