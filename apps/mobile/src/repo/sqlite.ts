/**
 * SQLite persistence adapter (#8 slice 1) — wires the app store's persistence seam
 * (src/persistence.ts) to on-device storage.
 *
 * Runtime stack: expo-sqlite (`openDatabaseSync('abhyas.db')`) + drizzle-orm/expo-sqlite,
 * using the shared tables from packages/db/src/schema.ts.
 *
 * ── Mapping decisions (documented per issue #8 brief) ────────────────────────────
 * • topics / exams / study_sessions map near-1:1 onto their @abhyas/db tables.
 *   `student_id` is the constant 'local' — v1 is single-device, single-student.
 * • Exam optional arrays (subjectIds, exactDates) are stored as JSON text columns,
 *   exactly as the shared schema defines them.
 * • SessionLogEntry {day, min} has NO wall-clock timestamp, so the array ordinal is
 *   stashed in both the zero-padded row id and `started_at`. Load sorts by id, which
 *   makes snapshot→rows→snapshot order-preserving and deterministic.
 * • Plan "done" flags → **kv table** (my call, per brief option b). Snapshot excludes
 *   the full plan (it is rebuilt from topics/exams/dayIndex on hydrate+advanceDay),
 *   so writing plan_items rows would mean inventing kind/durationMin/date data that
 *   was never persisted. Instead the scalar/aux state (dayIndex, learningStyle,
 *   streak JSON, doneUids JSON) lives in a repo-local `app_kv(key, value)` table
 *   declared below. It is NOT added to packages/db/src/schema.ts because that file
 *   is outside this slice's ownership; it can be promoted into the shared schema
 *   when the cloud-sync slice lands.
 *
 * ── Failure policy (F21/F24 — no silent failure) ────────────────────────────────
 * Every load/save error is logged visibly via console.error; load() resolves null so
 * the app boots with empty state instead of crashing or failing silently.
 *
 * ── Node/vitest safety ───────────────────────────────────────────────────────────
 * expo-sqlite and drizzle-orm/expo-sqlite are imported dynamically inside
 * buildExpoClient(), never at module top level. The pure mappers and the adapter
 * core only touch drizzle-orm/sqlite-core (pure JS), so tests run in plain Node
 * against an injected in-memory SqliteRepoClient.
 */
import { sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  topics as topicsTable,
  exams as examsTable,
  studySessions,
} from '../../../../packages/db/src/schema';
import { initialStreak, type Exam, type LearningStyle, type StreakState, type Topic } from '@abhyas/engine';
import type { PersistenceAdapter, Snapshot } from '../persistence';

/**
 * Repo-local key/value extension table (see mapping decisions above).
 * Declared here rather than in packages/db/src/schema.ts (ownership boundary);
 * same drizzle-orm/sqlite-core runtime, additive DDL owned by this adapter.
 */
const appKv = sqliteTable('app_kv', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type TopicRow = typeof topicsTable.$inferSelect;
export type ExamRow = typeof examsTable.$inferSelect;
export type SessionRow = typeof studySessions.$inferSelect;
export interface KvRow {
  key: string;
  value: string;
}

/** Flat projection of everything this adapter reads/writes, one level above SQL. */
export interface RawState {
  topicRows: TopicRow[];
  examRows: ExamRow[];
  sessionRows: SessionRow[];
  kvRows: KvRow[];
}

/** Tiny storage interface so the mappers/adapter are unit-testable in Node. */
export interface SqliteRepoClient {
  read(): Promise<RawState>;
  write(raw: RawState): Promise<void>;
}

const STUDENT_ID = 'local';

const KV_KEYS = {
  dayIndex: 'dayIndex',
  learningStyle: 'learningStyle',
  streak: 'streak',
  doneUids: 'doneUids',
  subjectMeta: 'subjectMeta',
  dailyHours: 'dailyHours',
  timeFormat: 'timeFormat',
} as const;

// ─── Pure mappers ───────────────────────────────────────────────────────────────

/** Snapshot → row shapes. Pure; no DB access. */
export function toRows(s: Snapshot): RawState {
  const topicRows: TopicRow[] = s.topics.map(t => ({
    id: t.id,
    studentId: STUDENT_ID,
    subjectId: t.subjectId,
    name: t.name,
    weight: t.weight,
    box: t.box,
    dueIn: t.dueIn,
    coverage: t.coverage,
    backlog: t.backlog,
    sourceRef: t.sourceRef ?? null,
  }));

  const examRows: ExamRow[] = s.exams.map(e => ({
    id: e.id,
    studentId: STUDENT_ID,
    name: e.name,
    kind: e.kind,
    windowStart: e.windowStart,
    windowEnd: e.windowEnd ?? null,
    exactDates: e.exactDates ? JSON.stringify(e.exactDates) : null,
    subjectIds: JSON.stringify(e.subjectIds),
    datesheetConfirmed: e.datesheetConfirmed,
  }));

  const sessionRows: SessionRow[] = s.sessions.map((entry, i) => ({
    // Ordinal-encoded id + started_at preserve array order across the round-trip
    // (SessionLogEntry carries no real timestamp — see header note).
    id: `${STUDENT_ID}_s${String(i).padStart(6, '0')}`,
    studentId: STUDENT_ID,
    // c5 L6: multi-topic sessions store all bound ids comma-joined in the
    // existing nullable column — single-topic/unbound rows are unchanged.
    topicId: entry.topicIds && entry.topicIds.length > 1 ? entry.topicIds.join(',') : null,
    startedAt: i,
    minutes: entry.min,
    confidenceSelf: null,
    source: 'manual',
    dayIndex: entry.day,
  }));

  const kvRows: KvRow[] = [
    { key: KV_KEYS.dayIndex, value: String(s.dayIndex) },
    { key: KV_KEYS.learningStyle, value: s.learningStyle },
    { key: KV_KEYS.streak, value: JSON.stringify(s.streak) },
    { key: KV_KEYS.doneUids, value: JSON.stringify([...s.doneUids]) },
    // Only persisted when present — snapshots without it round-trip without it.
    ...(s.subjectMeta
      ? [{ key: KV_KEYS.subjectMeta, value: JSON.stringify(s.subjectMeta) }]
      : []),
    // c5 F6/F7 settings preferences — written only when present, so pre-c5
    // snapshots round-trip without them (same contract as subjectMeta).
    ...(s.dailyHours !== undefined
      ? [{ key: KV_KEYS.dailyHours, value: String(s.dailyHours) }]
      : []),
    ...(s.timeFormat !== undefined
      ? [{ key: KV_KEYS.timeFormat, value: s.timeFormat }]
      : []),
  ];

  return { topicRows, examRows, sessionRows, kvRows };
}

/** Row shapes → Snapshot. Returns null when storage has never been written. */
export function fromRows(raw: RawState): Snapshot | null {
  const kv = new Map(raw.kvRows.map(r => [r.key, r.value]));
  // A save always writes the kv scalars, so empty kv ⇒ nothing ever persisted.
  if (
    kv.size === 0 &&
    raw.topicRows.length === 0 &&
    raw.examRows.length === 0 &&
    raw.sessionRows.length === 0
  ) {
    return null;
  }

  const topics: Topic[] = raw.topicRows.map(r => ({
    id: r.id,
    subjectId: r.subjectId,
    name: r.name,
    box: r.box,
    dueIn: r.dueIn,
    weight: r.weight,
    coverage: r.coverage,
    backlog: r.backlog,
    sourceRef: r.sourceRef ?? undefined,
  }));

  const exams: Exam[] = raw.examRows.map(r => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    windowStart: r.windowStart,
    windowEnd: r.windowEnd ?? undefined,
    exactDates: r.exactDates ? (JSON.parse(r.exactDates) as string[]) : undefined,
    subjectIds: JSON.parse(r.subjectIds) as string[],
    datesheetConfirmed: r.datesheetConfirmed,
  }));

  // Sort by ordinal-encoded id so the original sessions array order survives.
  const sorted = [...raw.sessionRows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sessions = sorted.map(r => {
    // c5 L6: comma-joined topicIds round-trip back onto the optional field.
    if (r.topicId && r.topicId.includes(',')) return { day: r.dayIndex, min: r.minutes, topicIds: r.topicId.split(',') };
    return { day: r.dayIndex, min: r.minutes };
  });

  let streak: StreakState = initialStreak();
  const streakRaw = kv.get(KV_KEYS.streak);
  if (streakRaw !== undefined) streak = JSON.parse(streakRaw) as StreakState;

  let doneUids: string[] = [];
  const doneRaw = kv.get(KV_KEYS.doneUids);
  if (doneRaw !== undefined) doneUids = JSON.parse(doneRaw) as string[];

  let subjectMeta: Snapshot['subjectMeta'] = {};
  const metaRaw = kv.get(KV_KEYS.subjectMeta);
  if (metaRaw !== undefined) subjectMeta = JSON.parse(metaRaw) as NonNullable<Snapshot['subjectMeta']>;

  // c5 F6/F7: optional settings prefs — absent on pre-c5 kv storage → defaults.
  const dailyHoursRaw = kv.get(KV_KEYS.dailyHours);
  const timeFormatRaw = kv.get(KV_KEYS.timeFormat);
  const prefs = {
    ...(dailyHoursRaw !== undefined ? { dailyHours: Number(dailyHoursRaw) } : {}),
    ...(timeFormatRaw !== undefined ? { timeFormat: timeFormatRaw as Snapshot['timeFormat'] } : {}),
  };

  const base = {
    topics,
    exams,
    sessions,
    doneUids,
    dayIndex: Number(kv.get(KV_KEYS.dayIndex) ?? '0'),
    learningStyle: (kv.get(KV_KEYS.learningStyle) ?? 'average') as LearningStyle,
    streak,
  };
  // subjectMeta stays ABSENT (not {}) when never saved — keeps round-trip
  // deep-equality with snapshots from before this field existed.
  return { ...base, ...prefs, ...(metaRaw !== undefined ? { subjectMeta } : {}) };
}

// ─── Adapter ─────────────────────────────────────────────────────────────────────

/**
 * Build the adapter. `client` defaults to a lazily-initialized real expo-sqlite +
 * drizzle client ('abhyas.db'); tests inject an in-memory SqliteRepoClient instead.
 */
export function createSqliteAdapter(client?: SqliteRepoClient): PersistenceAdapter {
  let resolvedClient: Promise<SqliteRepoClient> | null = null;
  // ── c5 L1b: NPE guard ─────────────────────────────────────────────────────
  // After a dev-client reload / force-stop race, expo-sqlite's native handle
  // can be stale — initSync/write rejects with "NativeDatabase.initSync has
  // been rejected → NullPointerException". Policy:
  //   • a failed save marks the adapter DEGRADED and keeps the snapshot queued
  //     in memory (never lose data silently);
  //   • the NEXT save drops the cached client promise and retries ONE re-init;
  //   • if that still fails, the error surfaces via console.error (F21/F24)
  //     plus the store's lastSaveError flag for later UI display.
  let degraded = false;
  let queued: Snapshot | null = null;

  const getClient = (): Promise<SqliteRepoClient> => {
    if (client) return Promise.resolve(client);
    if (degraded) {
      resolvedClient = null; // stale handle — force ONE fresh re-init
      degraded = false;
    }
    resolvedClient ??= buildExpoClient().catch((err: unknown) => {
      resolvedClient = null; // never cache a failed init
      throw err;
    });
    return resolvedClient;
  };

  return {
    async load(): Promise<Snapshot | null> {
      try {
        const c = await getClient();
        return fromRows(await c.read());
      } catch (err) {
        // F21/F24: visible failure, graceful boot — never a silent swallow.
        console.error('[sqlite-repo] load failed — booting with empty state:', err);
        return null;
      }
    },

    save(snapshot: Snapshot): void {
      queued = snapshot; // latest-wins: a newer successful save supersedes
      void getClient()
        .then(c => c.write(toRows(snapshot)))
        .then(() => {
          if (queued === snapshot) queued = null; // flushed to disk
        })
        .catch((err: unknown) => {
          degraded = true; // next save re-inits once before giving up again
          console.error('[sqlite-repo] save failed — snapshot kept in memory for retry:', err);
          // Visible-error path: store flag the UI can show later (c5 L1b).
          void import('../store').then(m =>
            m.setLastSaveError(err instanceof Error ? err.message : String(err)),
          );
        });
    },
  };
}

// ─── Real (device) client — expo-sqlite + drizzle, imported lazily ──────────────

async function buildExpoClient(): Promise<SqliteRepoClient> {
  // Dynamic imports keep this module importable in Node (vitest) — see header note.
  const [{ openDatabaseSync }, { drizzle }] = await Promise.all([
    import('expo-sqlite'),
    import('drizzle-orm/expo-sqlite'),
  ]);

  // enableChangeListener keeps on-device reactive queries available for later
  // slices; harmless when unused (#8 stack notes).
  const sqlite = openDatabaseSync('abhyas.db', { enableChangeListener: true });
  const db = drizzle(sqlite);

  // Additive DDL: the three shared tables + the local kv extension.
  // (drizzle-kit migrations land with the sync slice; #8 owns idempotent bootstrap.)
  db.run(sql`CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY NOT NULL, student_id TEXT NOT NULL, subject_id TEXT NOT NULL,
    name TEXT NOT NULL, weight REAL NOT NULL DEFAULT 5, box INTEGER NOT NULL DEFAULT 0,
    due_in INTEGER NOT NULL DEFAULT -1, coverage TEXT NOT NULL DEFAULT 'unstarted',
    backlog INTEGER NOT NULL DEFAULT 0, source_ref TEXT
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY NOT NULL, student_id TEXT NOT NULL, name TEXT NOT NULL,
    kind TEXT NOT NULL, window_start TEXT NOT NULL, window_end TEXT, exact_dates TEXT,
    subject_ids TEXT NOT NULL, datesheet_confirmed INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY NOT NULL, student_id TEXT NOT NULL, topic_id TEXT,
    started_at INTEGER NOT NULL, minutes INTEGER NOT NULL, confidence_self INTEGER,
    source TEXT NOT NULL DEFAULT 'timer', day_index INTEGER NOT NULL DEFAULT 0
  )`);
  db.run(sql`CREATE TABLE IF NOT EXISTS app_kv (
    key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL
  )`);

  return {
    async read(): Promise<RawState> {
      return {
        topicRows: await db.select().from(topicsTable).all(),
        examRows: await db.select().from(examsTable).all(),
        sessionRows: await db.select().from(studySessions).all(),
        kvRows: await db.select().from(appKv).all(),
      };
    },

    async write(raw: RawState): Promise<void> {
      // expo-sqlite's drizzle dialect is 'sync' — transaction callback runs
      // synchronously; the async shell keeps the SqliteRepoClient signature.
      await Promise.resolve().then(() => {
        db.transaction(tx => {
          for (const row of raw.topicRows) {
            tx.insert(topicsTable)
              .values(row)
              .onConflictDoUpdate({ target: topicsTable.id, set: row })
              .run();
          }
          for (const row of raw.examRows) {
            tx.insert(examsTable)
              .values(row)
              .onConflictDoUpdate({ target: examsTable.id, set: row })
              .run();
          }
          // Sessions are a whole-array replace: delete stale rows, insert current.
          tx.delete(studySessions).run();
          for (const row of raw.sessionRows) {
            tx.insert(studySessions).values(row).run();
          }
          for (const row of raw.kvRows) {
            tx.insert(appKv)
              .values(row)
              .onConflictDoUpdate({ target: appKv.key, set: row })
              .run();
          }
        });
      });
    },
  };
}
