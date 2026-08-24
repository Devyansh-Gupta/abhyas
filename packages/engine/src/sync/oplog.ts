/**
 * Client-side op-log sync engine (P2 sync lane, docs/MASTER-PLAN.md PHASE 2).
 *
 * Pure TypeScript: no React Native imports, no network calls, no I/O. A transport
 * adapter plugs in later by carrying `SyncOp[]` batches between devices/servers;
 * everything here operates on plain data so vitest golden tests run in Node.
 *
 * ── Design decisions ─────────────────────────────────────────────────────────────
 * • Row shape reference is packages/db/src/schema.ts `syncLog` (op_id PK, device_id,
 *   entity/entity_id, op, payload JSON, client_ts for latest-wins). Field names here
 *   stay camelCase mirrors of those columns (opId, deviceId, entity→table, entityId→rowId,
 *   clientTs) so the future SQLite/Supabase adapter is a 1:1 mapping.
 * • Ordering / conflict resolution: last-write-wins by the tuple
 *   (clientTs, deviceId, opId) — lexicographically GREATER deviceId breaks exact-tie
 *   clocks deterministically on every device (no wall-clock dependence beyond clientTs).
 * • Idempotency: every op carries a unique opId; applyOps() skips opIds it has already
 *   applied, so transport-level retries and replays are no-ops (gate req #1).
 * • Compaction (gate req #2): create→update merges into one create carrying the final
 *   state; create→…→delete drops the pair entirely (the row never existed remotely);
 *   update→delete collapses to a lone delete; delete→create restarts the row story.
 *   Intended for the sender BEFORE its first push of a row; opIds of absorbed ops
 *   disappear from the wire (they were never sent), which is why compaction runs once,
 *   pre-push, not after ops are public.
 * • Updates carry PARTIAL payloads (shallow-merged); creates carry the FULL row.
 * • Deletes are tombstoned (kept in state with deleted:true, last-known data retained)
 *   so a late, older create cannot resurrect a deleted row.
 */

// ─── Op types ────────────────────────────────────────────────────────────────────

export type OpKind = 'create' | 'update' | 'delete';

/** One sync operation — mirrors packages/db `sync_log` columns (camelCase). */
export interface SyncOp {
  /** Unique, retry-safe identity (UUID). Already-applied opIds are no-ops. */
  opId: string;
  deviceId: string;
  /** Per-device monotonic sequence (1-based) — transport cursors page on this. */
  seq: number;
  /** Entity/table name (e.g. 'topics', 'exams'). */
  table: string;
  /** Primary key of the target row ('uid' for plan_items-style tables). */
  rowId: string;
  kind: OpKind;
  /** Full row (create) / shallow partial patch (update) / ignored (delete). */
  payload: Record<string, unknown>;
  /** Author-side wall-clock ms; primary latest-wins key. */
  clientTs: number;
}

/** Input accepted by applyOps/appendOp — transport-assigned fields are optional here. */
export type OpInput = Pick<SyncOp, 'table' | 'kind'> &
  Partial<Pick<SyncOp, 'rowId' | 'payload' | 'clientTs' | 'opId' | 'deviceId' | 'seq'>>;

/** Input accepted by appendOp — server-assigned fields are generated. */
export type NewOpInput = OpInput;

/** A device's local op-log. */
export interface OpLog {
  deviceId: string;
  ops: SyncOp[];
}

let opIdCounter = 0;

/**
 * Generate an opId. Uses crypto.randomUUID when available (device runtime);
 * falls back to a counter-based id so pure environments stay functional.
 * Tests should pass explicit opIds for determinism.
 */
export function genOpId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  opIdCounter += 1;
  return `op-${Date.now().toString(36)}-${opIdCounter.toString(36)}`;
}

export function makeOpLog(deviceId: string): OpLog {
  return { deviceId, ops: [] };
}

/** Pure append: returns a NEW log (with the new op) plus the op itself. */
export function appendOp(log: OpLog, input: NewOpInput): { log: OpLog; op: SyncOp } {
  const maxSeq = log.ops.reduce((m, o) => Math.max(m, o.seq), 0);
  const op: SyncOp = {
    opId: input.opId ?? genOpId(),
    deviceId: log.deviceId,
    seq: maxSeq + 1,
    table: input.table,
    rowId: input.rowId ?? '',
    kind: input.kind,
    payload: input.payload ?? {},
    clientTs: input.clientTs ?? 0,
  };
  return { log: { deviceId: log.deviceId, ops: [...log.ops, op] }, op };
}

// ─── Compaction (gate req #2: create→update merge before first push) ─────────────

/**
 * Compact a device's ops per row before its first push.
 *
 * Per (table,rowId), folding ops in seq order:
 *   create, update*            → single create whose payload is the merged final state
 *                                 (carries the LAST merged op's clientTs/opId)
 *   create …, delete           → removed entirely (nothing ever existed remotely)
 *   update*, delete            → lone delete (intermediate patches are noise)
 *   delete, create             → the delete stands, then the create restarts the story
 *
 * Retained ops keep their original seq (gaps are fine — transports cursor on seq);
 * relative order across rows is preserved. Pure: input is not mutated.
 */
export function compactOps(ops: readonly SyncOp[]): SyncOp[] {
  // Group per row, preserving first-appearance order of each row.
  const rowOrder: string[] = [];
  const groups = new Map<string, SyncOp[]>();
  for (const op of ops) {
    const key = `${op.table}\u0000${op.rowId}`;
    let g = groups.get(key);
    if (!g) {
      g = [];
      groups.set(key, g);
      rowOrder.push(key);
    }
    g.push(op);
  }

  const out: SyncOp[] = [];
  for (const key of rowOrder) {
    const compacted: SyncOp[] = [];
    for (const op of groups.get(key)!) {
      const last = compacted[compacted.length - 1];
      switch (op.kind) {
        case 'create':
          // Push as-is — even right after a delete: a standalone delete implies
          // the row existed remotely, so both ops must travel (delete, then the
          // fresh create restarts its story). A purely local create…delete pair
          // was already collapsed at the delete branch above.
          compacted.push({ ...op });
          break;
        case 'update':
          if (last && (last.kind === 'create' || last.kind === 'update')) {
            // Merge into the running create/update: final state, latest stamp.
            last.payload = { ...last.payload, ...op.payload };
            last.clientTs = op.clientTs;
            last.opId = op.opId;
          } else {
            // Update against a pre-existing base (or after a delete) — keep standalone.
            compacted.push({ ...op });
          }
          break;
        case 'delete':
          if (compacted.length > 0 && compacted[0]!.kind === 'create') {
            // The pair cancels: this row never existed outside the device.
            compacted.length = 0;
          } else {
            // Collapse any prior standalone updates into the lone delete.
            compacted.length = 0;
            compacted.push({ ...op });
          }
          break;
      }
    }
    out.push(...compacted);
  }
  return out;
}

// ─── Materialized state + apply (gate req #1: idempotency; LWW resolution) ───────

/** Envelope wrapping one row's materialized value plus its LWW stamps. */
export interface RowEnvelope {
  /** Last-known row data (retained even when tombstoned so winning patches can merge). */
  data: Record<string, unknown>;
  ts: number;
  deviceId: string;
  deleted: boolean;
  lastOpId: string;
  /**
   * Per-field LWW stamps (field → {ts, deviceId, lastOpId}). Present once any
   * field-merged update has landed; rows only touched by create/delete omit it.
   * Guarantees two devices applying the same op SET in different orders reach
   * identical per-field winners — the convergence requirement.
   */
  fieldStamps?: Record<string, OpKey>;
}

/** Materialized, merged view of all applied ops. Deterministic given an op set. */
export interface SyncState {
  tables: Record<string, Record<string, RowEnvelope>>;
  /** Applied-op identity set — the idempotency guard. */
  appliedOpIds: Set<string>;
}

export function emptyState(): SyncState {
  return { tables: {}, appliedOpIds: new Set() };
}

/** Live (non-deleted) rows of one table, cloned, keyed by rowId. */
export function liveRows(
  state: SyncState,
  table: string,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const rows = state.tables[table];
  if (!rows) return out;
  for (const [rowId, env] of Object.entries(rows)) {
    if (!env.deleted) out[rowId] = { ...env.data };
  }
  return out;
}

function tableOf(state: SyncState, table: string): Record<string, RowEnvelope> {
  return (state.tables[table] ??= {});
}

/** LWW ordering key — SyncOps and row envelopes both project onto this. */
export interface OpKey {
  ts: number;
  deviceId: string;
  id: string;
}

function keyOfOp(o: Pick<SyncOp, 'clientTs' | 'deviceId' | 'opId'>): OpKey {
  return { ts: o.clientTs, deviceId: o.deviceId, id: o.opId };
}

function keyOfEnv(e: RowEnvelope): OpKey {
  return { ts: e.ts, deviceId: e.deviceId, id: e.lastOpId };
}

/** LWW tuple: greater wins. Ties on clientTs break by deviceId, then opId. */
export function isNewerKey(
  a: Pick<SyncOp, 'clientTs' | 'deviceId' | 'opId'>,
  b: Pick<SyncOp, 'clientTs' | 'deviceId' | 'opId'>,
): boolean {
  return compareKeys(keyOfOp(a), keyOfOp(b)) > 0;
}

function compareKeys(a: OpKey, b: OpKey): number {
  if (a.ts !== b.ts) return a.ts - b.ts;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export interface ApplyReport {
  /** New state (a structural copy — inputs are never mutated). */
  state: SyncState;
  /** Ops newly applied. */
  applied: number;
  /** Ops skipped because their opId was already applied (retries/replays). */
  duplicates: number;
}

/**
 * Apply a batch of (remote or local) ops onto a state.
 *
 * • Idempotent by opId: duplicates inside the batch and against history are skipped
 *   and counted — retry-safe (gate req #1).
 * • Ops replay in ascending (clientTs, deviceId, opId) order; each op lands only if
 *   its key is strictly newer than the target row's current stamp (LWW):
 *     create → inserts, or replaces an older/tombstoned row; older creates are dropped
 *              (a late old create cannot resurrect a deleted or newer row)
 *     update → shallow-merges payload into the row when newer; unknown row ⇒ the patch
 *              materializes the row (base row lives on another device we haven't heard
 *              from yet — explicit policy, not a silent failure)
 *     delete → tombstones when newer (data retained for audit/winning-patch merge)
 */
export function applyOps(state: SyncState, ops: readonly (SyncOp | NewOpInput)[]): ApplyReport {
  // Transport-assigned fields (deviceId, seq) may be absent on locally-authored
  // inputs; defaults keep the pure core testable without a transport.
  const normalized: SyncOp[] = ops.map((o, i) => ({
    deviceId: ('deviceId' in o && o.deviceId) || 'unknown',
    seq: ('seq' in o && o.seq) || i + 1,
    opId: o.opId ?? `anon-${i}`,
    table: o.table,
    rowId: o.rowId ?? '',
    kind: o.kind,
    payload: o.payload ?? {},
    clientTs: o.clientTs ?? 0,
  }));
  const seen = new Set(state.appliedOpIds);
  const tables: Record<string, Record<string, RowEnvelope>> = {};
  for (const [t, rows] of Object.entries(state.tables)) {
    tables[t] = {};
    for (const [id, env] of Object.entries(rows)) {
      tables[t][id] = { ...env, data: { ...env.data } };
    }
  }

  const ordered = [...normalized].sort(
    (a, b) =>
      a.clientTs - b.clientTs ||
      (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0) ||
      (a.opId < b.opId ? -1 : a.opId > b.opId ? 1 : 0),
  );

  let applied = 0;
  let duplicates = 0;

  const stamp = (o: SyncOp) => ({ ts: o.clientTs, deviceId: o.deviceId, lastOpId: o.opId });

  for (const op of ordered) {
    if (seen.has(op.opId)) {
      duplicates += 1;
      continue;
    }
    seen.add(op.opId);

    const rows = (tables[op.table] ??= {});
    const env = rows[op.rowId];
    const key = keyOfOp(op);

    if (op.kind === 'create') {
      if (!env || compareKeys(key, keyOfEnv(env)) > 0) {
        rows[op.rowId] = { data: { ...op.payload }, deleted: false, ...stamp(op) };
      } else if (compareKeys(key, keyOfEnv(env)) === 0) {
        // Identical stamp (same op reaching us twice under two opIds): merge fields.
        const fs: Record<string, OpKey> = {};
        for (const [f, v] of Object.entries(op.payload)) {
          if (!(f in env.data) || compareKeys(key, env.fieldStamps?.[f] ?? keyOfEnv(env)) >= 0) {
            env.data[f] = v;
            fs[f] = key;
          }
        }
        env.fieldStamps = { ...env.fieldStamps, ...fs };
      }
      applied += 1;
      continue;
    }

    if (op.kind === 'update') {
      if (!env) {
        // Patch for a row we've never seen: materialize it (see doc header).
        const fs: Record<string, OpKey> = {};
        for (const f of Object.keys(op.payload)) fs[f] = key;
        rows[op.rowId] = {
          data: { ...op.payload },
          deleted: false,
          ...stamp(op),
          fieldStamps: fs,
        };
      } else {
        // Field-level LWW merge — the convergence guarantee: each field adopts
        // this patch's value only where the patch is newer than that field's
        // current stamp. Concurrent edits to DIFFERENT fields both survive.
        let mergedAny = false;
        const fs = { ...(env.fieldStamps ?? {}) };
        for (const [f, v] of Object.entries(op.payload)) {
          const fkey = env.fieldStamps?.[f];
          if (!fkey || compareKeys(key, fkey) >= 0) {
            env.data[f] = v;
            fs[f] = key;
            mergedAny = true;
          }
        }
        if (mergedAny) {
          // Row-level stamp advances only if this is the newest touch overall
          // (keeps create/delete arbitration intact).
          if (compareKeys(key, keyOfEnv(env)) > 0) {
            Object.assign(env, stamp(op));
            env.deleted = false; // winning edit outranks an older delete
          }
          env.fieldStamps = fs;
        } else if (!env.deleted && compareKeys(key, keyOfEnv(env)) === 0) {
          // No new fields, but identical-stamp replay of an unmergeable update:
          // still counts as applied (idempotent by opId anyway).
        }
      }
      applied += 1;
      continue;
    }

    // delete
    if (!env) {
      rows[op.rowId] = { data: {}, deleted: true, ...stamp(op) };
    } else if (compareKeys(key, keyOfEnv(env)) > 0) {
      Object.assign(env, stamp(op));
      env.deleted = true; // data + fieldStamps retained deliberately (tombstone)
    }
    applied += 1;
  }

  return { state: { tables, appliedOpIds: seen }, applied, duplicates };
}
