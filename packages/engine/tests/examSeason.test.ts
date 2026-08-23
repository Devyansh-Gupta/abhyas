/**
 * Golden suite — Exam Season mode + gap-day engine (issue #9, PRD M14).
 * Acceptance: "Exam window input → capacity slider → dated revision plan
 * respects gaps".
 */
import { describe, it, expect } from 'vitest';
import {
  applyExamSeason,
  activeSeason,
  clampCapacity,
  dateForDayIndex,
  CAPACITY_MIN,
  CAPACITY_MAX,
  GAP_DAY_BOOST,
  TAPER_FACTOR,
} from '../src/examSeason.js';
import { STUDY_WINDOW } from '../src/planner.js';
import type { Topic, Exam } from '../src/types.js';

const mkTopic = (id: string, subjectId: string, weight = 8): Topic => ({
  id, subjectId, name: id, box: 0, dueIn: -1, weight,
  coverage: 'unstarted', backlog: false,
});

const topics = [
  mkTopic('quadratic', '📐', 10),
  mkTopic('trig', '📐', 6),
  mkTopic('acids', '⚗️', 8),
];

// Window-model exam: datesheet not yet released (schema: exactDates nullable)
const windowExam: Exam = {
  id: 'ut1', name: 'UT Maths', kind: 'school',
  windowStart: '2026-09-01', subjectIds: ['📐'], datesheetConfirmed: false,
};

// Datesheet-confirmed exam: papers on Sep 1, Sep 4 → gaps on Sep 2–3
const confirmedExam: Exam = {
  id: 'preboards', name: 'Pre-Boards', kind: 'board',
  windowStart: '2026-09-01', windowEnd: '2026-09-04',
  exactDates: ['2026-09-01', '2026-09-04'],
  subjectIds: ['📐'], datesheetConfirmed: true,
};

describe('examSeason · window without exact dates (#9)', () => {
  it('is active inside the declared window with focus on exam subjects', () => {
    const r = applyExamSeason(topics, [windowExam], '2026-09-03');
    expect(r.active).toBe(true);
    expect(r.focusSubjects).toEqual(['📐']);
    expect(r.gapDay).toBe(false); // no datesheet → no gap semantics
    expect(r.paperToday).toBe(false);
  });

  it('falls back to a default window span when windowEnd is absent', () => {
    // DEFAULT_WINDOW_DAYS=7 → Sep 1..7; day 8 is out
    expect(applyExamSeason(topics, [windowExam], '2026-09-07').active).toBe(true);
    expect(applyExamSeason(topics, [windowExam], '2026-09-08').active).toBe(false);
  });

  it('honours an explicit windowEnd when present', () => {
    const ex: Exam = { ...windowExam, windowEnd: '2026-09-10' };
    expect(applyExamSeason(topics, [ex], '2026-09-10').active).toBe(true);
    expect(applyExamSeason(topics, [ex], '2026-09-11').active).toBe(false);
  });

  it('boosts focus-subject weights and tapers non-exam subjects', () => {
    const r = applyExamSeason(topics, [windowExam], '2026-09-03'); // dial 1.0
    const w = Object.fromEntries(r.topics.map(t => [t.id, t.weight]));
    expect(w['acids']).toBe(Math.max(1, Math.round(8 * TAPER_FACTOR))); // 4
    expect(w['quadratic']).toBe(10); // ×1.0 unchanged
    // ranking flips: tapered chemistry drops behind boosted maths
    const byWeight = r.topics.map(t => t.weight);
    expect(byWeight).toEqual([10, 6, 4]);
  });
});

describe('examSeason · datesheet-confirmed gaps (#9)', () => {
  it('marks days strictly between two papers as gap days with boost', () => {
    for (const date of ['2026-09-02', '2026-09-03']) {
      const r = applyExamSeason(topics, [confirmedExam], date);
      expect(r.active).toBe(true);
      expect(r.gapDay).toBe(true);
      expect(r.capacityMultiplier).toBeCloseTo(GAP_DAY_BOOST, 5);
      // boosted revision capacity shows up as extra target minutes
      expect(r.capacityMinutes).toBe(
        Math.round((STUDY_WINDOW.end - STUDY_WINDOW.start) * GAP_DAY_BOOST),
      );
    }
  });

  it('paper days themselves are not gap days', () => {
    for (const date of ['2026-09-01', '2026-09-04']) {
      const r = applyExamSeason(topics, [confirmedExam], date);
      expect(r.gapDay).toBe(false);
      expect(r.paperToday).toBe(true);
      expect(r.active).toBe(true);
    }
  });

  it('season ends after the last paper; unconfirmed same dates give no gaps', () => {
    expect(applyExamSeason(topics, [confirmedExam], '2026-09-05').active).toBe(false);
    const unconfirmed: Exam = { ...confirmedExam, datesheetConfirmed: false, exactDates: undefined };
    expect(applyExamSeason(topics, [unconfirmed], '2026-09-02').gapDay).toBe(false);
  });

  it('gap-day weights compound dial × boost onto focus subjects only', () => {
    const r = applyExamSeason(topics, [confirmedExam], '2026-09-02', 1.0);
    const quad = r.topics.find(t => t.id === 'quadratic')!;
    expect(quad.weight).toBe(Math.round(10 * GAP_DAY_BOOST)); // 13
    expect(r.topics.find(t => t.id === 'acids')!.weight).toBe(4); // taper unaffected by gap boost
  });

  it('activeSeason unions focus subjects across overlapping exams', () => {
    const chem: Exam = {
      id: 'chem', name: 'Chemistry UT', kind: 'school',
      windowStart: '2026-09-01', subjectIds: ['⚗️'], datesheetConfirmed: false,
    };
    const s = activeSeason([confirmedExam, chem], Date.parse('2026-09-02T00:00:00Z') / 86_400_000)!;
    expect([...s.focusSubjects].sort()).toEqual(['⚗️', '📐'].sort()); // code-unit order agnostic
  });
});

describe('examSeason · subject tapering outside subjectIds (#9)', () => {
  it('never boosts non-exam subjects even at max dial', () => {
    const r = applyExamSeason(topics, [windowExam], '2026-09-03', CAPACITY_MAX);
    const acids = r.topics.find(t => t.id === 'acids')!;
    expect(acids.weight).toBe(Math.round(8 * TAPER_FACTOR));
    const quad = r.topics.find(t => t.id === 'quadratic')!;
    expect(quad.weight).toBe(20); // 10 × 2.0
  });

  it('taper never zeroes a subject out', () => {
    const tiny = [mkTopic('micro', '⚗️', 1)];
    expect(applyExamSeason(tiny, [windowExam], '2026-09-03').topics[0]!.weight).toBe(1);
  });
});

describe('examSeason · capacity slider extremes (#9)', () => {
  it('clamps the dial into [0.5, 2.0]', () => {
    expect(clampCapacity(0.1)).toBe(CAPACITY_MIN);
    expect(clampCapacity(1)).toBe(1);
    expect(clampCapacity(99)).toBe(CAPACITY_MAX);
  });

  it('min dial shrinks focus weights but keeps them above tapered ones', () => {
    const r = applyExamSeason(topics, [windowExam], '2026-09-03', CAPACITY_MIN);
    const quad = r.topics.find(t => t.id === 'quadratic')!;
    const acids = r.topics.find(t => t.id === 'acids')!;
    expect(quad.weight).toBe(5);   // 10 × 0.5
    expect(acids.weight).toBe(4);  // still tapered harder
    expect(quad.weight).toBeGreaterThan(acids.weight);
  });

  it('capacity minutes scale with the dial', () => {
    const base = STUDY_WINDOW.end - STUDY_WINDOW.start;
    expect(applyExamSeason(topics, [], '2026-09-03', CAPACITY_MIN).capacityMinutes).toBe(base / 2);
    expect(applyExamSeason(topics, [], '2026-09-03', CAPACITY_MAX).capacityMinutes).toBe(base * 2);
  });

  it('inactive days ignore the dial entirely (multiplier stays clamped, topics untouched)', () => {
    const r = applyExamSeason(topics, [windowExam], '2026-08-23', 2.0);
    expect(r.active).toBe(false);
    expect(r.capacityMultiplier).toBe(CAPACITY_MAX); // dial still reported
    expect(r.topics).toBe(topics);                   // same reference — no adjustment pass
  });
});

describe('examSeason · boundary days (#9)', () => {
  it('day before first paper counts as in-season with full focus', () => {
    const r = applyExamSeason(topics, [windowExam], '2026-08-31');
    expect(r.active).toBe(true);
    expect(r.focusSubjects).toEqual(['📐']);
    expect(r.gapDay).toBe(false);
  });

  it('two days before first paper is still off-season', () => {
    expect(applyExamSeason(topics, [windowExam], '2026-08-30').active).toBe(false);
  });

  it('eve of a confirmed datesheet focuses without gap/paper flags', () => {
    const r = applyExamSeason(topics, [confirmedExam], '2026-08-31');
    expect(r.active).toBe(true);
    expect(r.gapDay).toBe(false);
    expect(r.paperToday).toBe(false);
  });
});

describe('examSeason · purity & determinism', () => {
  it('never mutates input topics or exams', () => {
    const ts = structuredClone(topics);
    applyExamSeason(ts, [confirmedExam], '2026-09-02', 1.5);
    expect(ts).toEqual(topics);
  });

  it('same inputs → identical output (golden determinism)', () => {
    const a = applyExamSeason(topics, [confirmedExam], '2026-09-02', 1.25);
    const b = applyExamSeason(topics, [confirmedExam], '2026-09-02', 1.25);
    expect(a).toEqual(b);
  });

  it('dateForDayIndex anchors to the planner clock', () => {
    expect(dateForDayIndex(0)).toBe('2026-08-21');
    expect(dateForDayIndex(11)).toBe('2026-09-01');
  });
});
