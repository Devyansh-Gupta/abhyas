/**
 * Sync transport unit tests (P2) — pure Node, no network.
 * Covers: row mapping ↔ cloud column shapes, REST URL/query construction,
 * disabled-flag behavior, syncOnce push/pull orchestration with a fake
 * transport, cursor paging at the pull limit, and bookkeeping serialization.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendOp,
  applyOps,
  emptyState,
  makeOpLog,
  type OpLog,
  type SyncState,
} from '@abhyas/engine';
import {
  PULL_LIMIT,
  SUPABASE_URL as SUPABASE_URL_PLACEHOLDER,
  SYNC_LOG_TABLE,
  SYNC_SCHEMA,
  getSupabase,
  pullSyncLogQuery,
  restUrl,
  supabaseEnabled,
  syncLogRestPath,
  type SyncLogRow,
} from '../src/lib/supabase';
import {
  createSupabaseTransport,
  deserializeSyncState,
  fromSyncLogRow,
  serializeSyncState,
  syncOnce,
  toSyncLogRow,
  type SyncTransport,
} from '../src/repo/syncTransport';

// Node/vitest has no EXPO_PUBLIC_* env → the module must be in disabled mode here.
describe('supabase bootstrap (disabled mode)', () => {
  it('exports enabled=false (offline-only mode) in a bare Node env', () => {
    expect(supabaseEnabled).toBe(false);
    expect(SUPABASE_URL_PLACEHOLDER).toBe('');
  });

  it('getSupabase() resolves null when disabled', async () => {
    await expect(getSupabase()).resolves.toBeNull();
  });

  it('builds the abhyas.sync_log REST path and pull query', () => {
    expect(SYNC_SCHEMA).toBe('abhyas');
    expect(SYNC_LOG_TABLE).toBe('sync_log');
    expect(syncLogRestPath()).toBe('/rest/v1/abhyas.sync_log');
    expect(restUrl('https://auwtcvrrouycvhahcowy.supabase.co/', '/rest/v1/abhyas.sync_log')).toBe(
      'https://auwtcvrrouycvhahcowy.supabase.co/rest/v1/abhyas.sync_log',
    );
    expect(pullSyncLogQuery(1700)).toBe(
      `select=*&client_ts=gt.${1700}&order=client_ts.asc&limit=${PULL_LIMIT}`,
    );
  });
});

describe('sync_log row mapping', () => {
  const op = {
    opId: 'op-1',
    deviceId: 'dev-a',
    seq: 1,
    table: 'topics',
    rowId: 't1',
    kind: 'update' as const,
    payload: { box: 2 },
    clientTs: 1234,
  };

  it('projects SyncOp onto snake_case cloud columns', () => {
    const row = toSyncLogRow(op);
    expect(row).toEqual({
      op_id: 'op-1',
      device_id: 'dev-a',
      entity: 'topics',
      entity_id: 't1',
      op: 'update',
      payload: { box: 2 },
      client_ts: 1234,
    });
  });

  it('round-trips row → op input (seq stays local-only)', () => {
    const back = fromSyncLogRow(toSyncLogRow(op));
    expect(back.opId).toBe('op-1');
    expect(back.deviceId).toBe('dev-a');
    expect(back.table).toBe('topics');
    expect(back.rowId).toBe('t1');
    expect(back.kind).toBe('update');
    expect(back.clientTs).toBe(1234);
    expect('seq' in back).toBe(false);
  });

  it('applies pulled rows through applyOps (LWW lands)', () => {
    const row: SyncLogRow = {
      op_id: 'op-r1',
      device_id: 'dev-b',
      entity: 'topics',
      entity_id: 't1',
      op: 'create',
      payload: { id: 't1', subjectId: 'PHY', name: 'Kinematics' },
      client_ts: 2000,
    };
    const report = applyOps(emptyState(), [fromSyncLogRow(row)]);
    expect(report.applied).toBe(1);
    expect(report.state.tables['topics']!['t1']!.data).toEqual(row.payload);
  });
});

// ── fake transport harness ──────────────────────────────────────────────────────

interface FakeServer {
  rows: SyncLogRow[];
  failPushWith?: string;
  pushedBatches: SyncLogRow[][];
}

function fakeTransport(server: FakeServer): SyncTransport & { server: FakeServer } {
  return {
    server,
    async push(ops) {
      if (server.failPushWith) throw new Error(server.failPushWith);
      const rows = ops.map(toSyncLogRow);
      // conflict-do-nothing on op_id
      const known = new Set(server.rows.map(r => r.op_id));
      const fresh = rows.filter(r => !known.has(r.op_id));
      server.rows.push(...fresh);
      server.pushedBatches.push(rows);
      return rows.length;
    },
    async pull(since) {
      return server.rows
        .filter(r => r.client_ts > since)
        .sort((a, b) => a.client_ts - b.client_ts)
        .slice(0, PULL_LIMIT)
        .map(fromSyncLogRow);
    },
  };
}

function localLog(deviceId: string): OpLog {
  let log = makeOpLog(deviceId);
  const r1 = appendOp(log, {
    table: 'exams',
    rowId: 'e1',
    kind: 'create',
    payload: { id: 'e1', name: 'Unit Test' },
    clientTs: 100,
    opId: 'op-1',
  });
  log = r1.log;
  return log;
}

const remoteRow = (over: Partial<SyncLogRow>): SyncLogRow => ({
  op_id: 'op-x',
  device_id: 'dev-other',
  entity: 'topics',
  entity_id: 't9',
  op: 'create',
  payload: { id: 't9', subjectId: 'CHEM', name: 'Moles' },
  client_ts: 5000,
  ...over,
});

describe('syncOnce', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('pushes pending ops, pulls remote ops, applies them, advances cursor', async () => {
    const server: FakeServer = { rows: [remoteRow({ op_id: 'op-x1', client_ts: 400 })], pushedBatches: [] };
    const t = fakeTransport(server);
    const res = await syncOnce({
      transport: t,
      log: localLog('dev-a'),
      state: emptyState(),
      cursor: 100,
    });

    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.pushed).toBe(1); // replay-safe count = batch size
    expect(res.pulled).toBe(1);
    expect(res.applied).toBe(1);
    expect(res.cursor).toBe(400);
    // our exam create reached the wire (push-only for locals — syncNow
    // materializes them separately); the remote topic landed in state
    expect(server.rows.filter(r => r.entity === 'exams')).toHaveLength(1);
    expect(Object.keys(res.state.tables)).toEqual(['topics']);
  });

  it('is idempotent on replay: second run re-pushes but pulls nothing new', async () => {
    const server: FakeServer = { rows: [], pushedBatches: [] };
    const t = fakeTransport(server);
    const input = { transport: t, log: localLog('dev-a'), state: emptyState(), cursor: 0 };
    const first = await syncOnce(input);
    expect(first.pushed).toBe(1);

    const second = await syncOnce({ ...input, state: first.state, cursor: first.cursor });
    expect(second.ok).toBe(true);
    expect(second.pulled).toBe(0);
    expect(server.rows.filter(r => r.op_id === 'op-1')).toHaveLength(1); // deduped server-side
  });

  it('collects phase errors instead of throwing silently', async () => {
    const t = fakeTransport({ rows: [], pushedBatches: [], failPushWith: 'boom' });
    const res = await syncOnce({ transport: t, log: localLog('dev-a'), state: emptyState(), cursor: 0 });
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toContain('boom');
    expect(res.pushed).toBe(0);
  });

  it('keeps the cursor put when the pull page is full (more may share max ts)', async () => {
    const fullPage = Array.from({ length: PULL_LIMIT }, (_, i) =>
      remoteRow({ op_id: `op-f${i}`, entity_id: `r${i}`, client_ts: 900 }),
    );
    const server: FakeServer = { rows: fullPage, pushedBatches: [] };
    const res = await syncOnce({
      transport: fakeTransport(server),
      log: makeOpLog('dev-a'),
      state: emptyState(),
      cursor: 100,
    });
    expect(res.pulled).toBe(PULL_LIMIT);
    expect(res.cursor).toBe(100); // unchanged — page not drained
  });

  it('applies remote updates field-level (LWW) onto existing envelopes', async () => {
    // Seed via create + update so per-field stamps exist (update branch records them).
    const seed = applyOps(emptyState(), [
      {
        table: 'topics',
        rowId: 't1',
        kind: 'create',
        payload: { id: 't1', name: 'Seed', box: 0 },
        clientTs: 800,
        deviceId: 'dev-a',
        opId: 'seed-c',
      },
      {
        table: 'topics',
        rowId: 't1',
        kind: 'update',
        payload: { id: 't1', name: 'Old', box: 1 },
        clientTs: 1000,
        deviceId: 'dev-a',
        opId: 'seed-u',
      },
    ]).state;

    const server: FakeServer = {
      rows: [
        // 1100 > field stamp 1000 → box wins; 900 < field stamp 1000 → name patch loses
        remoteRow({ op_id: 'op-u', entity_id: 't1', op: 'update', payload: { box: 3 }, client_ts: 1100 }),
        remoteRow({ op_id: 'op-old', entity_id: 't1', op: 'update', payload: { name: 'Stale' }, client_ts: 900 }),
      ],
      pushedBatches: [],
    };
    const res = await syncOnce({
      transport: fakeTransport(server),
      log: makeOpLog('dev-a'),
      state: seed,
      cursor: 0,
    });
    expect(res.ok).toBe(true);
    const env = res.state.tables['topics']!['t1']!;
    expect(env.data['box']).toBe(3); // newer edit wins
    expect(env.data['name']).toBe('Old'); // stale patch loses
  });
});

describe('bookkeeping serialization', () => {
  it('round-trips SyncState through JSON', () => {
    const state: SyncState = applyOps(emptyState(), [
      {
        table: 'topics',
        rowId: 't1',
        kind: 'create',
        payload: { id: 't1', name: 'N' },
        clientTs: 10,
        deviceId: 'd1',
        opId: 'o1',
      },
    ]).state;
    const restored = deserializeSyncState(JSON.parse(JSON.stringify(serializeSyncState(state))));
    expect([...restored.appliedOpIds]).toEqual(['o1']);
    expect(restored.tables['topics']!['t1']!.data).toEqual({ id: 't1', name: 'N' });
    expect(restored.tables['topics']!['t1']!.deleted).toBe(false);
  });

  it('rejects corrupt blobs loudly', () => {
    expect(() => deserializeSyncState({ nope: true })).toThrow(/corrupt/);
  });
});
