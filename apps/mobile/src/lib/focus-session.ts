/**
 * c5 L6 (F9): pure helpers for multi-topic focus sessions.
 * Kept framework-free so they're unit-testable in node (goldens in
 * apps/mobile/tests/focus-multitopic.test.ts).
 */

/** Toggle a topic id in an ordered selection list; returns a NEW array. */
export function toggleTopicId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
}

/**
 * Split `minutes` across `parts` topics as evenly as whole minutes allow.
 * Remainder minutes go to the earlier topics. parts <= 0 or minutes <= 0 → [].
 */
export function splitEvenly(minutes: number, parts: number): number[] {
  if (parts <= 0 || minutes <= 0) return [];
  const base = Math.floor(minutes / parts);
  const rem = minutes % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}
