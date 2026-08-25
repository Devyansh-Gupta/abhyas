/**
 * c5 L6 (F8): reconciliation between wizard-seeded topics and topics imported
 * mid-wizard via the shared /import screen. Import lands subjects/topics in the
 * store immediately; finish() must keep them without double-seeding.
 */

/** Store topics that came from the import flow (readable 'imported-*' subject ids). */
export function importedTopics<T extends { subjectId: string }>(stored: readonly T[]): T[] {
  return stored.filter(t => String(t.subjectId).startsWith('imported-'));
}

/** subjectMeta entries belonging to imported subjects, keyed by subjectId. */
export function importedMeta<M extends Record<string, unknown>>(meta: M): Partial<M> {
  const out: Partial<M> = {};
  for (const k of Object.keys(meta)) {
    if (k.startsWith('imported-')) (out as Record<string, unknown>)[k] = meta[k];
  }
  return out;
}

/**
 * Wizard-seeded topics win on id collisions; everything else from the store is
 * appended in its original order. Pure — no mutation.
 */
export function mergeWizardTopics<T extends { id: string }>(
  seeded: readonly T[],
  stored: readonly T[],
): T[] {
  const seen = new Set(seeded.map(t => t.id));
  return [...seeded, ...stored.filter(t => !seen.has(t.id))];
}
