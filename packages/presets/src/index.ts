/**
 * Preset library — T1 syllabus bundles (ADR §D1: versioned JSON in-repo).
 * Import maps stay tiny; bundles are KB-scale and tree-shakeable.
 */
import cbse10science from '../data/cbse/class10/science.json';
import cbse10maths from '../data/cbse/class10/mathematics.json';
import cbse12physics from '../data/cbse/class12/physics.json';
// ICSE (P3 expansion)
import icse9English from '../data/icse/class9/english-language.json';
import icse9Hindi from '../data/icse/class9/hindi.json';
import icse9HistoryCivics from '../data/icse/class9/history-civics.json';
import icse9Geography from '../data/icse/class9/geography.json';
import icse9Maths from '../data/icse/class9/mathematics.json';
import icse9Physics from '../data/icse/class9/physics.json';
import icse9Chemistry from '../data/icse/class9/chemistry.json';
import icse9Biology from '../data/icse/class9/biology.json';
import icse9ComputerApps from '../data/icse/class9/computer-applications.json';
import icse9CommercialStudies from '../data/icse/class9/commercial-studies.json';
import icse10English from '../data/icse/class10/english-language.json';
import icse10Hindi from '../data/icse/class10/hindi.json';
import icse10HistoryCivics from '../data/icse/class10/history-civics.json';
import icse10Geography from '../data/icse/class10/geography.json';
import icse10Maths from '../data/icse/class10/mathematics.json';
import icse10Physics from '../data/icse/class10/physics.json';
import icse10Chemistry from '../data/icse/class10/chemistry.json';
import icse10Biology from '../data/icse/class10/biology.json';
import icse10ComputerApps from '../data/icse/class10/computer-applications.json';
import icse10CommercialStudies from '../data/icse/class10/commercial-studies.json';
// State boards (P3 expansion — conservative chapter mappings, sources in _note)
import mh10Algebra from '../data/maharashtra/class10/maths-algebra.json';
import mh10Geometry from '../data/maharashtra/class10/maths-geometry.json';
import mh10Science1 from '../data/maharashtra/class10/science-1.json';
import mh10Science2 from '../data/maharashtra/class10/science-2.json';
import mh10HistoryPolSci from '../data/maharashtra/class10/history-political-science.json';
import mh10Geography from '../data/maharashtra/class10/geography.json';
import tn10Maths from '../data/tamilnadu/class10/mathematics.json';
import tn10Science from '../data/tamilnadu/class10/science.json';
import tn10SocialScience from '../data/tamilnadu/class10/social-science.json';
import ka10Maths from '../data/karnataka/class10/mathematics.json';
import ka10Science from '../data/karnataka/class10/science.json';
import ka10SocialScience from '../data/karnataka/class10/social-science.json';

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
  icse9English,
  icse9Hindi,
  icse9HistoryCivics,
  icse9Geography,
  icse9Maths,
  icse9Physics,
  icse9Chemistry,
  icse9Biology,
  icse9ComputerApps,
  icse9CommercialStudies,
  icse10English,
  icse10Hindi,
  icse10HistoryCivics,
  icse10Geography,
  icse10Maths,
  icse10Physics,
  icse10Chemistry,
  icse10Biology,
  icse10ComputerApps,
  icse10CommercialStudies,
  mh10Algebra,
  mh10Geometry,
  mh10Science1,
  mh10Science2,
  mh10HistoryPolSci,
  mh10Geography,
  tn10Maths,
  tn10Science,
  tn10SocialScience,
  ka10Maths,
  ka10Science,
  ka10SocialScience,
] as unknown as Preset[];

/** Boards with at least one registered preset — onboarding board picker order. */
export const BOARDS = ['CBSE', 'ICSE', 'Maharashtra', 'Tamil Nadu', 'Karnataka'] as const;
export type BoardId = (typeof BOARDS)[number];

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
