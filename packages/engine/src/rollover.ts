/**
 * Rollover carry policy (decision #3, F14 fixes ported).
 *
 * Contract:
 *  - carry ≤ CARRY_MAX undone forward-work items; exam-linked prioritised
 *  - revise-kind NEVER carried (SRS already owns their rescheduling)
 *  - carried items lose their time slot ("anytime")
 */
import { CARRY_MAX, type PlanItem } from './types';

export interface CarryResult {
  carried: PlanItem[];
  droppedRevisions: number;
  droppedForward: number;
}

export function computeCarry(planItems: readonly PlanItem[], doneUids: ReadonlySet<string>): CarryResult {
  const undone = planItems.filter(i => !doneUids.has(i.uid));
  const forward = undone
    .filter(i => i.kind !== 'rev')
    .sort((a, b) => (b.examLinked ? 1 : 0) - (a.examLinked ? 1 : 0));
  const carried = forward.slice(0, CARRY_MAX).map(i => ({ ...i, carried: true, startMin: null }));
  return {
    carried,
    droppedRevisions: undone.filter(i => i.kind === 'rev').length,
    droppedForward: Math.max(0, forward.length - CARRY_MAX),
  };
}
