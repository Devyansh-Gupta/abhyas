/**
 * P3 OCR import — pure selection model for the review stage.
 * No React/RN imports: unit-tested directly under vitest (node env) and
 * consumed by app/import.tsx for tick-all headers, per-topic rows and the
 * "Import N subjects · M topics" footer counts.
 */

export interface ParsedSubjectDraft {
  /** stable key derived from the subject name (slugified, deduped) */
  key: string;
  /** display name straight from the parser */
  name: string;
  topics: Array<{ key: string; label: string }>;
}

/** Flat selection state: subject keys in `subjects`, full topic keys in `topics`. */
export interface SelectionState {
  subjects: Record<string, boolean>;
  topics: Record<string, boolean>;
}

/** raw slug, possibly empty for blank/unsluggable input */
const rawSlug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const slugify = (s: string): string => rawSlug(s) || 'subject';

/**
 * Build the review-stage draft from parser output. Subject keys are readable
 * slugs ('mathematics' → later stored as subjectId 'imported-mathematics');
 * duplicate names get numeric suffixes so keys stay unique. Topic keys are
 * `<subjectKey>/<topicSlug>` (deduped within the subject).
 */
export function draftFromParsed(parsed: { subjects: Array<{ name: string; topics: string[] }> }): ParsedSubjectDraft[] {
  const usedSubjects = new Set<string>();
  return parsed.subjects.map(sub => {
    const base = slugify(sub.name);
    let key = base;
    let n = 2;
    while (usedSubjects.has(key)) key = `${base}-${n++}`;
    usedSubjects.add(key);

    const usedTopics = new Set<string>();
    const topics = sub.topics.map((label, idx) => {
      const tBase = rawSlug(label) || `topic-${idx + 1}`;
      let tKey = tBase;
      let m = 2;
      while (usedTopics.has(tKey)) tKey = `${tBase}-${m++}`;
      usedTopics.add(tKey);
      return { key: `${key}/${tKey}`, label };
    });
    return { key, name: sub.name, topics };
  });
}

/** Everything starts selected — preview-before-apply means the user curates DOWN. */
export function initialSelection(draft: ParsedSubjectDraft[]): SelectionState {
  const state: SelectionState = { subjects: {}, topics: {} };
  for (const sub of draft) {
    state.subjects[sub.key] = true;
    for (const t of sub.topics) state.topics[t.key] = true;
  }
  return state;
}

/** Toggle a subject header checkbox — cascades to all its topics. Pure. */
export function toggleSubject(draft: ParsedSubjectDraft[], state: SelectionState, subjectKey: string, on: boolean): SelectionState {
  const next: SelectionState = { subjects: { ...state.subjects }, topics: { ...state.topics } };
  next.subjects[subjectKey] = on;
  for (const sub of draft) {
    if (sub.key !== subjectKey) continue;
    for (const t of sub.topics) next.topics[t.key] = on;
  }
  return next;
}

/** Toggle a single topic row. Does NOT auto-flip the parent header — countSelected handles that. Pure. */
export function toggleTopic(state: SelectionState, topicKey: string, on: boolean): SelectionState {
  if (state.topics[topicKey] === on) return state;
  return { subjects: { ...state.subjects }, topics: { ...state.topics, [topicKey]: on } };
}

/** True when every topic of the subject is ticked (header shows tick-all state). */
export function isSubjectFullySelected(draft: ParsedSubjectDraft[], state: SelectionState, subjectKey: string): boolean {
  const sub = draft.find(s => s.key === subjectKey);
  if (!sub || sub.topics.length === 0) return false;
  return sub.topics.every(t => !!state.topics[t.key]);
}

/**
 * Footer counts: a subject counts when its header is ticked AND it has ≥1
 * ticked topic; topics count only when their parent subject is ticked too.
 */
export function countSelected(draft: ParsedSubjectDraft[], state: SelectionState): { subjects: number; topics: number } {
  let subjects = 0;
  let topics = 0;
  for (const sub of draft) {
    if (!state.subjects[sub.key]) continue;
    const picked = sub.topics.filter(t => !!state.topics[t.key]).length;
    if (picked === 0) continue;
    subjects += 1;
    topics += picked;
  }
  return { subjects, topics };
}
