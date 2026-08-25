/**
 * Cycle-5 L4 — pure selection model for the exam-import review stage
 * (apps/mobile/app/exam-import.tsx). No React/RN imports: unit-tested under
 * vitest (node env), same pattern as import-selection.ts.
 */
import type { ParsedExam } from '@abhyas/engine';

export interface ExamDraftRow {
  key: string;
  name: string;
  date?: string;
  session?: string;
}

/** Flat tick map keyed by row key. */
export type ExamSelection = Record<string, boolean>;

/** Build review rows from parser output; keys are stable slugs, deduped. */
export function rowsFromParsed(exams: ParsedExam[]): ExamDraftRow[] {
  const used = new Set<string>();
  return exams.map((e, i) => {
    const base = e.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'exam';
    let key = `${base}-${i}`;
    let n = 0;
    while (used.has(key)) key = `${base}-${i}-${++n}`;
    used.add(key);
    return { key, name: e.name, date: e.date, session: e.session };
  });
}

/** Everything starts ticked — the user unticks what they don't want. */
export function initialSelection(rows: ExamDraftRow[]): ExamSelection {
  const sel: ExamSelection = {};
  for (const r of rows) sel[r.key] = true;
  return sel;
}

export function toggleExam(sel: ExamSelection, key: string, on: boolean): ExamSelection {
  return { ...sel, [key]: on };
}

export function countSelected(rows: ExamDraftRow[], sel: ExamSelection): number {
  return rows.filter(r => sel[r.key]).length;
}
