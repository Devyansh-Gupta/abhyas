/**
 * Preset library — T1 syllabus bundles (ADR §D1: versioned JSON in-repo).
 * Import maps stay tiny; bundles are KB-scale and tree-shakeable.
 */
import cbse10science from '../data/cbse/class10/science.json';
import cbse10maths from '../data/cbse/class10/mathematics.json';
import cbse12physics from '../data/cbse/class12/physics.json';

export interface PresetTopic {
  id: string;
  name: string;
  weight?: number;
}

export interface Preset {
  id: string;
  board: string;
  class: number;
  subject: string;
  emoji: string;
  acadYear: string;
  version: string;
  kind: 'core' | 'elective' | 'additional';
  weight?: number;
  _note?: string;
  topics: PresetTopic[];
}

export const PRESETS: Preset[] = [
  cbse10science,
  cbse10maths,
  cbse12physics,
] as unknown as Preset[];

/** Find presets for an onboarding selection. */
export function presetsFor(board: string, cls: number): Preset[] {
  return PRESETS.filter(p => p.board === board && p.class === cls);
}

/** Instantiate a preset into engine topics (coverage from mid-year calibration). */
export function topicsFromPreset(
  p: Preset,
  coverage: 'unstarted' | 'in_progress' | 'covered',
): { subjectEmoji: string; subjectName: string; kind: 'core' | 'elective' | 'additional' } & { topics: import('@abhyas/engine').Topic[] } {
  const backlog = coverage === 'covered';
  return {
    subjectEmoji: p.emoji,
    subjectName: p.subject,
    kind: p.kind,
    topics: p.topics.map(t => ({
      id: t.id,
      subjectId: p.emoji,
      name: t.name,
      box: 0,
      dueIn: -1,
      weight: t.weight ?? 5,
      coverage,
      backlog,
      sourceRef: t.id,
    })),
  };
}
