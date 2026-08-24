/**
 * THE P2 sync gate test (docs/MASTER-PLAN.md PHASE 2, req #3):
 * two simulated devices with independent op-logs make interleaved offline edits
 * (including both editing the same row, and one deleting a row the other edits),
 * then exchange logs in both directions through applyOps — both devices must
 * converge to byte-identical state.
 *
 * No network, no timers: "sync" is passing op arrays between the two devices,
 * exactly what a future transport adapter will carry. The harness mirrors the
 * real contract: compaction runs ONCE per row, over not-yet-pushed ops, before
 * the first push (already-public ops are immutable and never rewritten).
 */
import { describe, it, expect } from 'vitest';
import {
  appendOp,
  applyOps,
  compactOps,
  emptyState,
  liveRows,
  makeOpLog,
  type NewOpInput,
  type OpLog,
  type SyncOp,
  type SyncState,
} from '../src/sync/oplog.js';

/** Simulated device: commits apply locally immediately (as real clients do). */
function device(id: string) {
  let log: OpLog = makeOpLog(id);
  let state: SyncState = emptyState();
  /** Ops already handed to the wire — compaction may never absorb these again. */
  const sent = new Set<string>();
  return {
    id,
    get log() {
      return log;
    },
    get state() {
      return state;
    },
    commit(input: NewOpInput): void {
      const r = appendOp(log, input);
      log = r.log;
      state = applyOps(state, [r.op]).state;
    },
    /** Compact + emit everything not pushed yet; marks emitted ops as sent. */
    pushOutgoing(): SyncOp[] {
      const fresh = log.ops.filter(o => !sent.has(o.opId));
      const out = compactOps(fresh);
      for (const o of out) sent.add(o.opId);
      for (const o of fresh) sent.add(o.opId); // absorbed ops can't be re-sent either
      return out;
    },
    receive(ops: readonly SyncOp[]): void {
      // Filter to what we haven't applied yet — mirrors a transport cursor.
      const fresh = ops.filter(o => !state.appliedOpIds.has(o.opId));
      state = applyOps(state, fresh).state;
    },
  };
}

/** Full bidirectional exchange between two devices. */
function exchange(A: ReturnType<typeof device>, B: ReturnType<typeof device>): void {
  B.receive(A.pushOutgoing());
  A.receive(B.pushOutgoing());
}

describe('two-device convergence', () => {
  it('converges to identical final state after interleaved offline edits, conflicts and delete/edit races', () => {
    const A = device('device-A');
    const B = device('device-B');

    // ── First handshake: A created r1 offline, B created r2 ────────────────────
    A.commit({
      table: 'topics',
      rowId: 'r1',
      kind: 'create',
      payload: { id: 'r1', name: 'Trigonometry', box: 0 },
      clientTs: 1000,
      opId: 'a1',
    });
    B.commit({
      table: 'topics',
      rowId: 'r2',
      kind: 'create',
      payload: { id: 'r2', name: 'Kinematics', box: 0 },
      clientTs: 1001,
      opId: 'b1',
    });
    exchange(A, B);

    expect(Object.keys(liveRows(A.state, 'topics')).sort()).toEqual(['r1', 'r2']);
    expect(Object.keys(liveRows(B.state, 'topics')).sort()).toEqual(['r1', 'r2']);
    expect(A.state.tables).toEqual(B.state.tables);

    // ── Offline phase: interleaved edits on both devices ──────────────────────
    // A edits r1's name while offline…
    A.commit({
      table: 'topics',
      rowId: 'r1',
      kind: 'update',
      payload: { name: 'Trigonometry II' },
      clientTs: 2000,
      opId: 'a2',
    });
    // …and B edits the SAME row concurrently.
    B.commit({
      table: 'topics',
      rowId: 'r1',
      kind: 'update',
      payload: { box: 3 },
      clientTs: 2100,
      opId: 'b2',
    });

    // Both edit r2 with the SAME timestamp → deviceId tiebreak must decide identically.
    A.commit({
      table: 'topics',
      rowId: 'r2',
      kind: 'update',
      payload: { box: 5 },
      clientTs: 3000,
      opId: 'a3',
    });
    B.commit({
      table: 'topics',
      rowId: 'r2',
      kind: 'update',
      payload: { box: 9 },
      clientTs: 3000,
      opId: 'b3',
    });

    // Delete/edit race: A deletes r2 while B keeps editing r1.
    A.commit({ table: 'topics', rowId: 'r2', kind: 'delete', clientTs: 4000, opId: 'a4' });
    B.commit({
      table: 'topics',
      rowId: 'r1',
      kind: 'update',
      payload: { box: 4 },
      clientTs: 4100,
      opId: 'b4',
    });

    // A also creates a fresh row mid-offline phase.
    A.commit({
      table: 'topics',
      rowId: 'r3',
      kind: 'create',
      payload: { id: 'r3', name: 'Calculus', box: 1 },
      clientTs: 4200,
      opId: 'a5',
    });

    // ── Merge both directions; run the exchange twice (= transport retry) ─────
    exchange(A, B);
    exchange(A, B); // pure replay of already-applied ops — must change nothing

    // ── Convergence assertions ────────────────────────────────────────────────
    expect(A.state.tables).toEqual(B.state.tables); // identical envelopes, tombstones included

    const topicsA = liveRows(A.state, 'topics');
    expect(topicsA).toEqual(liveRows(B.state, 'topics'));

    // r1: patches replay everywhere in LWW-key order; B's ts-4100 edit is last.
    expect(topicsA['r1']).toEqual({ id: 'r1', name: 'Trigonometry II', box: 4 });

    // r2: tied-ts edits resolve by deviceId ('device-B' > 'device-A'), then A's
    // strictly newer delete (ts 4000) tombstones the row on BOTH devices.
    expect(topicsA['r2']).toBeUndefined();
    expect(A.state.tables['topics']!['r2']!.deleted).toBe(true);
    expect(B.state.tables['topics']!['r2']!.deleted).toBe(true);

    // r3 arrived from A alone.
    expect(topicsA['r3']).toEqual({ id: 'r3', name: 'Calculus', box: 1 });

    // Convergence closure: replaying EVERYTHING (both raw logs, any order,
    // including retries) through either device changes no row state at all.
    const everything = [...A.log.ops, ...B.log.ops];
    const closedA = applyOps(A.state, everything).state;
    const closedB = applyOps(B.state, everything.reverse()).state;
    expect(closedA.tables).toEqual(A.state.tables);
    expect(closedB.tables).toEqual(B.state.tables);
    expect(closedA.tables).toEqual(closedB.tables);
  });

  it('stays converged when sync happens in partial batches and out of order', () => {
    const A = device('device-A');
    const B = device('device-B');

    A.commit({
      table: 'exams',
      rowId: 'e1',
      kind: 'create',
      payload: { id: 'e1', name: 'Unit Test', windowStart: '2026-09-01' },
      clientTs: 10,
      opId: 'x1',
    });
    A.commit({
      table: 'exams',
      rowId: 'e1',
      kind: 'update',
      payload: { windowStart: '2026-09-05' },
      clientTs: 20,
      opId: 'x2',
    });
    A.commit({
      table: 'exams',
      rowId: 'e1',
      kind: 'update',
      payload: { name: 'Unit Test 1' },
      clientTs: 30,
      opId: 'x3',
    });
    B.commit({
      table: 'exams',
      rowId: 'e2',
      kind: 'create',
      payload: { id: 'e2', name: 'Board Prac' },
      clientTs: 15,
      opId: 'y1',
    });

    // Deliver A's compacted ops to B one at a time, REVERSED (worst-case transport).
    const aOut = compactOps(A.log.ops).slice().reverse();
    for (const op of aOut) B.receive([op]);
    // B replies before seeing everything; A receives all of B at once.
    A.receive(compactOps(B.log.ops));

    expect(liveRows(A.state, 'exams')).toEqual(liveRows(B.state, 'exams'));
    // Compacted create carries final merged state despite reversed delivery.
    expect(liveRows(B.state, 'exams')['e1']).toEqual({
      id: 'e1',
      name: 'Unit Test 1',
      windowStart: '2026-09-05',
    });
  });
});
