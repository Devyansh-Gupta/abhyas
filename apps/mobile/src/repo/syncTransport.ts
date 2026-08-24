/**
 * Sync transport (P2): wires the pure op-log engine (@abhyas/engine/sync) to the
 * cloud `abhyas.sync_log` table on Supabase.
 *
 * ── Mapping (cloud mirrors packages/db/src/schema.ts) ───────────────────────────
 *   SyncOp.opId     ↔ sync_log.op_id      (PK — conflict-do-nothing on upsert)
 *   SyncOp.deviceId ↔ sync_log.device_id
 *   SyncOp.table    ↔ sync_log.entity
 *   SyncOp.rowId    ↔ sync_log.entity_id
 *   SyncOp.kind     ↔ sync_log.op         ('create' | 'update' | 'delete')
 *   SyncOp.payload  ↔ sync_log.payload    (jsonb in the cloud schema)
 *   SyncOp.clientTs ↔ sync_log.client_ts  (LWW primary key)
 *   seq             ↔ n/a (per-device local sequencing only; never transmitted)
 *
 * ── Layering ────────────────────────────────────────────────────────────────────
 * • Pure core (row mapping, query building, state serialization, syncOnce) runs
 *   in plain Node — golden-tested under vitest against a fake transport.
 * • createSupabaseTransport() adapts a real SupabaseClient onto SyncTransport.
 * • syncNow() is the device entry point: guards on supabaseEnabled && session,
 *   backfills snapshot rows as deterministic create-ops (buildBackfill), pushes,
 *   pulls since the persisted cursor, applies remote ops through engine applyOps
 *   and projects the merged topics/exams back into the app store.
 */
import {
  applyOps,
  buildBackfill,
  genOpId,
  liveRows,
  type NewOpInput,
  type OpLog,
  type SyncOp,
  type SyncState,
} from '@abhyas/engine';
import { type Exam, type Topic } from '@abhyas/engine';
import { useApp } from '../store';
import {
  PULL_LIMIT,
  SYNC_LOG_TABLE,
  SYNC_SCHEMA,
  getSupabase,
  supabaseEnabled,
  type SupabaseClient,
  type SyncLogRow,
} from '../lib/supabase';
import type { Snapshot } from '../persistence';

// ── Pure row mapping ────────────────────────────────────────────────────────────

/** SyncOp → cloud sync_log row (pure; golden-tested). */
export function toSyncLogRow(op: SyncOp): SyncLogRow {
  return {
    op_id: op.opId,
    device_id: op.deviceId,
    entity: op.table,
    entity_id: op.rowId,
    op: op.kind,
    payload: op.payload,
    client_ts: op.clientTs,
  };
}

/** Cloud sync_log row → engine op input (no seq — per-device local only). */
export function fromSyncLogRow(row: SyncLogRow): NewOpInput {
  return {
    opId: row.op_id,
    deviceId: row.device_id,
    table: row.entity,
    rowId: row.entity_id ?? '',
    kind: row.op as SyncOp['kind'],
    payload: row.payload ?? {},
    clientTs: Number(row.client_ts) || 0,
  };
}

// ── Transport seam ──────────────────────────────────────────────────────────────

export interface SyncTransport {
  /** Upsert ops into abhyas.sync_log; conflicts on op_id do nothing. Rows pushed. */
  push(ops: readonly SyncOp[]): Promise<number>;
  /** Select sync_log where client_ts > since, ordered asc (≤ PULL_LIMIT rows). */
  pull(since: number): Promise<NewOpInput[]>;
}

export function createSupabaseTransport(client: SupabaseClient): SyncTransport {
  return {
    async push(ops): Promise<number> {
      if (ops.length === 0) return 0;
      const rows = ops.map(toSyncLogRow);
      const { error } = await client
        .schema(SYNC_SCHEMA)
        .from(SYNC_LOG_TABLE)
        .upsert(rows, { onConflict: 'op_id', ignoreDuplicates: true });
      if (error) throw new Error(`[sync] push failed: ${error.message}`);
      return rows.length;
    },

    async pull(since): Promise<NewOpInput[]> {
      const { data, error } = await client
        .schema(SYNC_SCHEMA)
        .from(SYNC_LOG_TABLE)
        .select('*')
        .gt('client_ts', since)
        .order('client_ts', { ascending: true })
        .limit(PULL_LIMIT);
      if (error) throw new Error(`[sync] pull failed: ${error.message}`);
      return (data ?? []).map(r => fromSyncLogRow(r as unknown as SyncLogRow));
    },
  };
}

// ── Bookkeeping serialization (AsyncStorage-backed, JSON-safe) ──────────────────

interface SerializedSyncState {
  tables: Record<string, Record<string, unknown>>;
  appliedOpIds: string[];
}

/** SyncState → JSON-safe plain object (pure). */
export function serializeSyncState(state: SyncState): SerializedSyncState {
  const tables: SerializedSyncState['tables'] = {};
  for (const [t, rows] of Object.entries(state.tables)) {
    tables[t] = {};
    for (const [id, env] of Object.entries(rows)) {
      tables[t][id] = {
        data: env.data,
        ts: env.ts,
        deviceId: env.deviceId,
        deleted: env.deleted,
        lastOpId: env.lastOpId,
        fieldStamps: env.fieldStamps,
      };
    }
  }
  return { tables, appliedOpIds: [...state.appliedOpIds] };
}

/** JSON-safe object → SyncState (pure). Throws on malformed input — never silent. */
export function deserializeSyncState(raw: unknown): SyncState {
  const r = raw as SerializedSyncState;
  if (!r || typeof r !== 'object' || !r.tables || !Array.isArray(r.appliedOpIds)) {
    throw new Error('[sync] corrupt sync-state bookkeeping — refusing to load.');
  }
  const tables: SyncState['tables'] = {};
  for (const [t, rows] of Object.entries(r.tables)) {
    tables[t] = {};
    for (const [id, envRaw] of Object.entries(rows)) {
      const env = envRaw as import('@abhyas/engine').RowEnvelope;
      tables[t][id] = {
        data: env.data ?? {},
        ts: env.ts ?? 0,
        deviceId: env.deviceId ?? '',
        deleted: Boolean(env.deleted),
        lastOpId: env.lastOpId ?? '',
        fieldStamps: env.fieldStamps,
      };
    }
  }
  return { tables, appliedOpIds: new Set(r.appliedOpIds) };
}

// ── syncOnce: one push+pull round-trip over the transport ───────────────────────

export interface SyncOnceInput {
  transport: SyncTransport;
  /** Local op-log whose ops should reach the cloud (replays are safe). */
  log: OpLog;
  /** Materialized sync state (idempotency set + envelopes) to apply pulls onto. */
  state: SyncState;
  /** Pull cursor: last fully-drained client_ts. */
  cursor: number;
}

export interface SyncOnceResult {
  ok: boolean;
  /** Human-readable failure reasons ([] when clean) — callers must render these. */
  errors: string[];
  pushed: number;
  pulled: number;
  /** Ops newly applied from the pull (duplicates were skipped by opId). */
  applied: number;
  duplicates: number;
  /** Next cursor: max pulled client_ts when the page drained, else unchanged. */
  cursor: number;
  log: OpLog;
  state: SyncState;
}

/**
 * One sync round-trip. Push is conflict-do-nothing on op_id, so re-pushing the
 * whole local log every run is safe; pulls page on strictly-greater client_ts and
 * the cursor only advances when a full page drained (no loss at PULL_LIMIT).
 * Phase failures are collected into `errors` (F21/F24) — neither phase is silent.
 */
export async function syncOnce(input: SyncOnceInput): Promise<SyncOnceResult> {
  const { transport, log, state } = input;
  let cursor = input.cursor;
  const errors: string[] = [];

  // Push: replay-safe upserts.
  let pushed = 0;
  try {
    pushed = await transport.push(log.ops);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  // Pull: page since cursor, apply through the engine's LWW/idempotency path.
  let pulledOps: NewOpInput[] = [];
  try {
    pulledOps = await transport.pull(cursor);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  let report = { applied: 0, duplicates: 0, state };
  if (pulledOps.length > 0) {
    report = applyOps(state, pulledOps);
    const maxTs = Math.max(...pulledOps.map(o => o.clientTs ?? 0));
    // Advance only when the page was smaller than the limit — otherwise more
    // rows share this max timestamp and must be refetched next round.
    if (pulledOps.length < PULL_LIMIT) cursor = maxTs;
  }

  return {
    ok: errors.length === 0,
    errors,
    pushed,
    pulled: pulledOps.length,
    applied: report.applied,
    duplicates: report.duplicates,
    cursor,
    log,
    state: report.state,
  };
}

// ── Device wrapper: guards, backfill, persistence, store projection ─────────────

export type SyncNowOutcome =
  | ({ skipped: false } & SyncOnceResult)
  | { skipped: true; reason: string };

const K_DEVICE = 'abhyas.sync.deviceId';
const K_CURSOR = 'abhyas.sync.cursor';
const K_STATE = 'abhyas.sync.state';

async function storage(): Promise<{
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}> {
  // Dynamic import keeps this file Node-testable.
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return AsyncStorage;
}

/**
 * Run one guarded sync cycle from the app store:
 * disabled/offline/not-signed-in ⇒ `{skipped:true, reason}` (visible to caller).
 * Local rows created while offline are pushed as deterministic backfill creates
 * (buildBackfill ids are stable ⇒ double-push dedupes server-side); remote ops
 * land through applyOps (field-level LWW) and the merged topics/exams project
 * back into the Zustand store, then persist() through the SQLite adapter.
 * Sessions are intentionally out of scope this slice (no stable row id yet).
 */
export async function syncNow(): Promise<SyncNowOutcome> {
  if (!supabaseEnabled) return { skipped: true, reason: 'supabase-disabled' };
  const client = await getSupabase();
  if (!client) return { skipped: true, reason: 'client-unavailable' };
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return { skipped: true, reason: 'not-signed-in' };

  const kv = await storage();

  // Stable per-install device id (drives LWW tie-breaks and backfill op ids).
  let deviceId = await kv.getItem(K_DEVICE);
  if (!deviceId) {
    deviceId = `dev-${genOpId()}`;
    await kv.setItem(K_DEVICE, deviceId);
  }

  const snap = useApp.getState();
  const enabledAt = Date.now();
  const backfill = buildBackfill(
    { exams: snap.exams.map(e => ({ ...e })), topics: snap.topics.map(t => ({ ...t })) },
    { deviceId, enabledAt },
  );

  // Load bookkeeping; a corrupt blob fails loudly instead of resetting silently.
  let state: SyncState = { tables: {}, appliedOpIds: new Set() };
  const rawState = await kv.getItem(K_STATE);
  if (rawState) state = deserializeSyncState(JSON.parse(rawState));
  const cursor = Number((await kv.getItem(K_CURSOR)) ?? '0') || 0;

  // Materialize our own backfilled rows so projection below includes local data.
  state = applyOps(state, backfill.ops).state;

  const result = await syncOnce({
    transport: createSupabaseTransport(client),
    log: { deviceId, ops: backfill.ops },
    state,
    cursor,
  });

  // Persist bookkeeping regardless of partial phase errors (push replays safely),
  // but only advance stored cursor/state from the returned values.
  await kv.setItem(K_STATE, JSON.stringify(serializeSyncState(result.state)));
  await kv.setItem(K_CURSOR, String(result.cursor));

  if (result.errors.length > 0) {
    console.error('[sync] completed with errors:', result.errors.join(' | '));
  }

  projectToStore(result.state);
  return { skipped: false, ...result };
}

// ── Store projection helpers ────────────────────────────────────────────────────

function asTopic(row: Record<string, unknown>): Topic | null {
  if (
    typeof row.id === 'string' &&
    typeof row.subjectId === 'string' &&
    typeof row.name === 'string'
  ) {
    return row as unknown as Topic;
  }
  return null;
}

function asExam(row: Record<string, unknown>): Exam | null {
  if (typeof row.id === 'string' && typeof row.name === 'string' && typeof row.kind === 'string') {
    return row as unknown as Exam;
  }
  return null;
}

/**
 * Project the materialized sync state's live topics/exams into the Zustand store.
 * Rows failing shape validation are logged loudly (never dropped silently).
 */
export function projectToStore(state: SyncState): void {
  const topicRows = Object.values(liveRows(state, 'topics'));
  const examRows = Object.values(liveRows(state, 'exams'));

  const topics: Topic[] = [];
  for (const r of topicRows) {
    const t = asTopic(r);
    if (t) topics.push(t);
    else console.error('[sync] projected topic failed validation:', r);
  }
  const exams: Exam[] = [];
  for (const r of examRows) {
    const e = asExam(r);
    if (e) exams.push(e);
    else console.error('[sync] projected exam failed validation:', r);
  }

  if (topics.length > 0 || exams.length > 0) {
    useApp.setState({ topics, exams });
  }
}

/** Convenience: current snapshot minus derived fields (for tests/debug tooling). */
export function snapshotTables(): Pick<Snapshot, 'topics' | 'exams'> {
  const s = useApp.getState();
  return { topics: s.topics, exams: s.exams };
}
