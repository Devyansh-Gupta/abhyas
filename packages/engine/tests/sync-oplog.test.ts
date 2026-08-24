/**
 * Golden tests for the P2 sync engine primitives:
 *   • retry idempotency        (gate req #1)
 *   • create→update compaction (gate req #2)
 *   • backfill queue           (gate req #4)
 *   • clock-skew deviceId tiebreak
 */
import { describe, it, expect } from 'vitest';
import {
  appendOp,
  applyOps,
  compactOps,
  emptyState,
  liveRows,
  makeOpLog,
} from '../src/sync/oplog.js';
import { buildBackfill } from '../src/sync/backfill.js';

const mk = (
  opId: string,
  over: Partial<Parameters<typeof appendOp>[1]> & { clientTs: number },
) => ({
  table: 'topics',
  kind: 'update' as const,
  ...over,
  opId,
});

describe('retry idempotency (op_id keyed)', () => {
  it('applying the same batch twice applies each op exactly once', () => {
    let s = emptyState();
    const batch = [
      mk('o1', { rowId: 'r1', kind: 'create', payload: { name: 'a' }, clientTs: 10 }),
      mk('o2', { rowId: 'r1', payload: { box: 2 }, clientTs: 20 }),
    ] as const;

    const first = applyOps(s, batch);
    s = first.state;
    expect(first.applied).toBe(2);
    expect(first.duplicates).toBe(0);

    // Transport retry: exact same batch again.
    const retry = applyOps(s, batch);
    expect(retry.applied).toBe(0);
    expect(retry.duplicates).toBe(2);
    expect(retry.state).toEqual(s); // byte-identical state — no double-apply

    // Duplicate WITHIN one batch is also collapsed.
    const dupInBatch = applyOps(emptyState(), [...batch, ...batch]);
    expect(dupInBatch.applied).toBe(2);
    expect(dupInBatch.duplicates).toBe(2);
  });

  it('an older duplicate arriving late does not clobber newer state', () => {
    let s = emptyState();
    s = applyOps(s, [mk('new', { rowId: 'r1', payload: { box: 9 }, clientTs: 50 })]).state;
    s = applyOps(s, [mk('old', { rowId: 'r1', payload: { box: 1 }, clientTs: 10 })]).state;
    expect(liveRows(s, 'topics')['r1']).toEqual({ box: 9 });
  });
});

describe('create→update compaction', () => {
  it('create + many updates collapses to ONE create carrying final state', () => {
    let log = makeOpLog('d1');
    ({ log } = appendOp(log, {
      table: 'topics',
      rowId: 'r1',
      kind: 'create',
      payload: { id: 'r1', name: 'v1', box: 0 },
      clientTs: 100,
      opId: 'c1',
    }));
    ({ log } = appendOp(log, {
      table: 'topics',
      rowId: 'r1',
      kind: 'update',
      payload: { name: 'v2' },
      clientTs: 200,
      opId: 'u1',
    }));
    ({ log } = appendOp(log, {
      table: 'topics',
      rowId: 'r1',
      kind: 'update',
      payload: { box: 7 },
      clientTs: 300,
      opId: 'u2',
    }));
    ({ log } = appendOp(log, {
      table: 'topics',
      rowId: 'r2',
      kind: 'create',
      payload: { id: 'r2' },
      clientTs: 310,
      opId: 'c2',
    }));

    const out = compactOps(log.ops);
    expect(out).toHaveLength(2); // was 4
    const r1 = out.find(o => o.rowId === 'r1')!;
    expect(r1.kind).toBe('create');
    expect(r1.payload).toEqual({ id: 'r1', name: 'v2', box: 7 }); // merged final state
    expect(r1.clientTs).toBe(300); // stamped with last merged op

    // Compacted stream replays to the SAME state as the raw stream.
    const fromRaw = applyOps(emptyState(), log.ops).state;
    const fromCompact = applyOps(emptyState(), out).state;
    expect(liveRows(fromCompact, 'topics')).toEqual(liveRows(fromRaw, 'topics'));
  });

  it('delete after create removes the pair entirely; update→delete leaves a lone delete', () => {
    let log = makeOpLog('d1');
    ({ log } = appendOp(log, {
      table: 'topics',
      rowId: 'ephemeral',
      kind: 'create',
      payload: { id: 'ephemeral' },
      clientTs: 1,
      opId: 'e1',
    }));
    ({ log } = appendOp(log, {
      table: 'topics',
      rowId: 'ephemeral',
      kind: 'update',
      payload: { box: 1 },
      clientTs: 2,
      opId: 'e2',
    }));
    ({ log } = appendOp(log, {
      table: 'topics',
      rowId: 'ephemeral',
      kind: 'delete',
      clientTs: 3,
      opId: 'e3',
    }));
    ({ log } = appendOp(log, {
      table: 'exams',
      rowId: 'legacy',
      kind: 'update',
      payload: { name: 'x' },
      clientTs: 4,
      opId: 'l1',
    }));
    ({ log } = appendOp(log, {
      table: 'exams',
      rowId: 'legacy',
      kind: 'delete',
      clientTs: 5,
      opId: 'l2',
    }));

    const out = compactOps(log.ops);
    expect(out.map(o => `${o.table}/${o.rowId}/${o.kind}`)).toEqual(['exams/legacy/delete']);
    expect(out[0]!.opId).toBe('l2');

    // delete followed by a fresh create keeps both (row story restarts).
    let log2 = makeOpLog('d2');
    ({ log: log2 } = appendOp(log2, {
      table: 'topics',
      rowId: 'z',
      kind: 'delete',
      clientTs: 1,
      opId: 'z1',
    }));
    ({ log: log2 } = appendOp(log2, {
      table: 'topics',
      rowId: 'z',
      kind: 'create',
      payload: { id: 'z', fresh: true },
      clientTs: 2,
      opId: 'z2',
    }));
    expect(compactOps(log2.ops).map(o => o.kind)).toEqual(['delete', 'create']);
  });
});

describe('backfill queue (sync-enable)', () => {
  const snapshot = {
    topics: [
      { id: 't1', name: 'Algebra' },
      { id: 't2', name: 'Geometry' },
    ],
    exams: [{ id: 'x1', name: 'UT-1' }],
    plan_items: [{ uid: 'p1', done: true }],
  };

  it('emits one full-state create op per existing row', () => {
    const res = buildBackfill(snapshot, { deviceId: 'dev-1', enabledAt: 5000 });
    expect(res.ops).toHaveLength(4);
    expect(res.skipped).toEqual([]);
    expect(res.ops.map(o => `${o.table}:${o.rowId}`)).toEqual([
      'exams:x1',
      'plan_items:p1',
      'topics:t1',
      'topics:t2', // stable ordering
    ]);
    const p1 = res.ops.find(o => o.rowId === 'p1')!;
    expect(p1.kind).toBe('create');
    expect(p1.payload).toEqual({ uid: 'p1', done: true }); // uid picked up via idKeys
    expect(p1.clientTs).toBe(5000);
    // Applying the backfill materializes every row.
    const st = applyOps(emptyState(), res.ops).state;
    expect(Object.keys(liveRows(st, 'topics'))).toEqual(['t1', 't2']);
  });

  it('is idempotent: re-enabling sync yields zero NEW ops (deterministic opIds)', () => {
    const first = buildBackfill(snapshot, { deviceId: 'dev-1', enabledAt: 5000 });
    const second = buildBackfill(snapshot, {
      deviceId: 'dev-1',
      enabledAt: 9000,
      log: first.log,
    });
    expect(second.ops).toEqual([]); // nothing new queued…
    expect(second.log.ops.map(o => o.opId)).toEqual(first.log.ops.map(o => o.opId)); // …and identical ids
    // Even if the whole queue were re-sent, applyOps dedupes it away.
    const st = applyOps(emptyState(), first.ops);
    const re = applyOps(st.state, second.log.ops);
    expect(re.applied).toBe(0);
    expect(re.duplicates).toBe(4);
  });

  it('rows already present in the local log are skipped, others still backfilled', () => {
    let log = makeOpLog('dev-2');
    ({ log } = appendOp(log, {
      table: 'topics',
      rowId: 't1',
      kind: 'update',
      payload: { name: 'edited while sync off' },
      clientTs: 4000,
      opId: 'pre1',
    }));
    const res = buildBackfill(snapshot, { deviceId: 'dev-2', enabledAt: 5000, log });
    expect(res.skipped).toEqual(['t1']); // already tracked by the op-log
    expect(res.ops).toHaveLength(3);
  });

  it('refuses to silently drop rows without a recognizable id', () => {
    expect(() =>
      buildBackfill({ topics: [{ name: 'no-id' }] }, { deviceId: 'd', enabledAt: 1 }),
    ).toThrow(/no id/);
  });
});

describe('clock-skew tiebreak by deviceId', () => {
  /** Build an op with an explicit deviceId (appendOp would stamp the log's own). */
  const foreign = (
    opId: string,
    deviceId: string,
    payload: Record<string, unknown>,
    clientTs: number,
  ) => ({
    opId,
    deviceId,
    seq: 1,
    table: 'topics',
    rowId: 'r1',
    kind: 'update' as const,
    payload,
    clientTs,
  });

  it('identical timestamps resolve identically regardless of arrival order', () => {
    const a = foreign('tie-a', 'aaa', { who: 'A' }, 777);
    const b = foreign('tie-b', 'bbb', { who: 'B' }, 777);

    const ab = applyOps(emptyState(), [a, b]).state;
    const ba = applyOps(emptyState(), [b, a]).state;
    expect(ab).toEqual(ba); // deterministic either way
    // Greater deviceId wins the exact-tie.
    expect(liveRows(ab, 'topics')['r1']).toEqual({ who: 'B' });
    expect(liveRows(ba, 'topics')['r1']).toEqual({ who: 'B' });
  });

  it('skewed clocks still converge: older-timestamp edit loses even if it arrives later', () => {
    const slowEdit = foreign('skew2', 'slow', { box: 2 }, 5);
    const fastEdit = foreign('skew1', 'fast', { box: 1 }, 99_999);

    let s = applyOps(emptyState(), [slowEdit]).state; // slow device's edit lands first
    s = applyOps(s, [fastEdit]).state; // skewed-faster edit arrives afterwards and wins
    expect(liveRows(s, 'topics')['r1']).toEqual({ box: 1 });
  });
});
