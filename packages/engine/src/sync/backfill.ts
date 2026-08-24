/**
 * Backfill queue (P2 sync gate req #4): when a user turns sync ON, every record
 * created while sync was OFF must be pushed as a create op — otherwise other
 * devices never learn the row exists.
 *
 * Pure TS; no RN imports, no network. The caller hands over the current snapshot
 * as `Record<table, row[]>` (the same shape the SQLite repo already projects) and
 * gets deterministic SyncOps back.
 *
 * ── Design decisions ─────────────────────────────────────────────────────────────
 * • Deterministic opIds (`bf:<deviceId>:<table>:<rowId>`): re-running sync-enable —
 *   or enabling twice before the first push completes — yields byte-identical ops,
 *   so applyOps' opId dedupe makes the whole queue idempotent end to end.
 * • Rows are backfilled as CREATE ops carrying their full current state (compaction
 *   semantics: from the cloud's perspective the row simply comes into existence).
 *   clientTs = enabledAt stamps the batch uniformly; LWW still lets any newer remote
 *   edit win over the backfill.
 */

import type { NewOpInput, OpLog, SyncOp } from './oplog';
import { appendOp } from './oplog';

/** Snapshot projection: table name → rows (each row keyed by its id column). */
export type BackfillSnapshot = Record<string, readonly Record<string, unknown>[]>;

export interface BackfillOptions {
  deviceId: string;
  /** 'sync enabled at' marker (ms epoch). Stamps every backfilled op. */
  enabledAt: number;
  /**
   * Existing local log to append onto (supplies per-device seq continuation and
   * lets us skip rows that already have ops). Optional.
   */
  log?: OpLog;
  /** Id-column candidates checked in order (plan_items uses `uid`). */
  idKeys?: readonly string[];
}

const DEFAULT_ID_KEYS = ['id', 'uid', 'rowId'] as const;

export interface BackfillResult {
  /** Log extended with the backfill create-ops (new object when ops were added). */
  log: OpLog;
  /** The generated backfill ops, in stable (table, then row order) order. */
  ops: SyncOp[];
  /** Row ids skipped because they already appear in the local log. */
  skipped: string[];
}

function rowIdOf(row: Record<string, unknown>, idKeys: readonly string[]): string | null {
  for (const k of idKeys) {
    const v = row[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/**
 * Produce backfill create-ops for every snapshot row not already represented in
 * the local log. Pure: inputs are never mutated.
 */
export function buildBackfill(snapshot: BackfillSnapshot, opts: BackfillOptions): BackfillResult {
  const idKeys = opts.idKeys ?? DEFAULT_ID_KEYS;
  let log: OpLog = opts.log ?? { deviceId: opts.deviceId, ops: [] };
  const knownRows = new Set(log.ops.map(o => `${o.table}\u0000${o.rowId}`));

  const ops: SyncOp[] = [];
  const skipped: string[] = [];

  // Stable iteration: table name asc, then original row order within the table.
  const tables = Object.keys(snapshot).sort();
  for (const table of tables) {
    for (const row of snapshot[table] ?? []) {
      const rid = rowIdOf(row, idKeys);
      if (rid === null) {
        throw new Error(
          `[backfill] row in table '${table}' has no id under [${idKeys.join(', ')}] — refusing to drop data silently`,
        );
      }
      if (knownRows.has(`${table}\u0000${rid}`)) {
        skipped.push(rid);
        continue;
      }
      knownRows.add(`${table}\u0000${rid}`);
      const input: NewOpInput = {
        table,
        rowId: rid,
        kind: 'create',
        payload: { ...row },
        clientTs: opts.enabledAt,
        // Deterministic identity ⇒ double-enable / retry is a no-op downstream.
        opId: `bf:${opts.deviceId}:${table}:${rid}`,
      };
      const res = appendOp(log, input);
      log = res.log;
      ops.push(res.op);
    }
  }

  return { log, ops, skipped };
}
