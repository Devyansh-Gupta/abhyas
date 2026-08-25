/**
 * #8 slice 1 — SQLite persistence adapter unit tests (Node, no DOM/native).
 *
 * The DB is abstracted behind SqliteRepoClient inside src/repo/sqlite.ts, so these
 * tests exercise the pure mappers (toRows/fromRows) and the adapter guard logic with
 * fixture rows / an in-memory client. expo-sqlite itself is never imported here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PersistenceAdapter, Snapshot } from '../src/persistence';
import type { Topic, Exam } from '@abhyas/engine';
import {
  createSqliteAdapter,
  fromRows,
  toRows,
  type RawState,
  type SqliteRepoClient,
} from '../src/repo/sqlite';

const topicWithRef: Topic = {
  id: 'quadratic',
  subjectId: '📐',
  name: 'Quadratic Equations',
  box: 2,
  dueIn: 3,
  weight: 10,
  coverage: 'in_progress',
  backlog: false,
  sourceRef: '10-maths/ch4/t1',
};
const topicBare: Topic = {
  id: 'trig',
  subjectId: '🧪',
  name: 'Trigonometry Basics',
  box: 0,
  dueIn: -1,
  weight: 12,
  coverage: 'unstarted',
  backlog: true,
};

const examFull: Exam = {
  id: 'half-yearly',
  name: 'Half Yearly — Maths',
  kind: 'school',
  windowStart: '2026-09-14',
  windowEnd: '2026-09-20',
  exactDates: ['2026-09-16'],
  subjectIds: ['📐', '🧪'],
  datesheetConfirmed: true,
};
const examBare: Exam = {
  id: 'jee-mock',
  name: 'JEE Mock 1',
  kind: 'competitive',
  windowStart: '2026-11-01',
  subjectIds: ['📐'],
  datesheetConfirmed: false,
};

const snapshot: Snapshot = {
  topics: [topicWithRef, topicBare],
  exams: [examFull, examBare],
  sessions: [
    { day: 1, min: 25 },
    { day: 0, min: 40 },
    { day: 3, min: 15 },
  ],
  doneUids: ['t_quadratic', 't_trig'],
  dayIndex: 3,
  learningStyle: 'strong_memory',
  streak: { current: 4, longest: 6, missed: 1, countedToday: true },
};

const emptyState: RawState = { topicRows: [], examRows: [], sessionRows: [], kvRows: [] };

/** In-memory client that stores exactly what write() receives. */
function makeMemoryClient(initial: RawState = emptyState) {
  let state = initial;
  const client: SqliteRepoClient & { state(): RawState } = {
    async read() {
      return structuredClone(state);
    },
    async write(raw) {
      state = structuredClone(raw);
    },
    state() {
      return state;
    },
  };
  return client;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sqlite repo mappers (#8 slice 1)', () => {
  it('round-trips snapshot → rows → snapshot with deep equality', () => {
    const rows = toRows(snapshot);
    expect(fromRows(rows)).toEqual(snapshot);
  });

  it('round-trips rows → snapshot → rows for fixture rows built via toRows', () => {
    const rows = toRows(snapshot);
    const again = toRows(fromRows(rows)!);
    expect(again).toEqual(rows);
  });

  it('preserves session array order across the round-trip', () => {
    const restored = fromRows(toRows(snapshot))!;
    expect(restored.sessions).toEqual([
      { day: 1, min: 25 },
      { day: 0, min: 40 },
      { day: 3, min: 15 },
    ]);
  });

  it('maps optional fields to nullable columns and back (sourceRef/windowEnd/exactDates)', () => {
    const rows = toRows(snapshot);
    const t2 = rows.topicRows.find(r => r.id === 'trig')!;
    expect(t2.sourceRef).toBeNull();
    const e2 = rows.examRows.find(r => r.id === 'jee-mock')!;
    expect(e2.windowEnd).toBeNull();
    expect(e2.exactDates).toBeNull();
    // JSON columns round-trip as arrays
    const e1 = rows.examRows.find(r => r.id === 'half-yearly')!;
    expect(JSON.parse(e1.subjectIds)).toEqual(['📐', '🧪']);
    expect(JSON.parse(e1.exactDates!)).toEqual(['2026-09-16']);
  });

  it('returns null for never-persisted storage (all tables empty)', () => {
    expect(fromRows(emptyState)).toBeNull();
  });
});

describe('sqlite adapter (#8 slice 1)', () => {
  it('save() then load() through an injected client restores the snapshot', async () => {
    const client = makeMemoryClient();
    const adapter: PersistenceAdapter = createSqliteAdapter(client);

    adapter.save(snapshot);
    // save() is fire-and-forget; flush microtasks before asserting.
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    await expect(adapter.load()).resolves.toEqual(snapshot);
  });

  it('load() resolves null on a fresh database and logs nothing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = createSqliteAdapter(makeMemoryClient());

    await expect(adapter.load()).resolves.toBeNull();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('load() catches client errors: logs visibly and resolves null (F21/F24)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom: SqliteRepoClient = {
      read: () => Promise.reject(new Error('disk I/O exploded')),
      write: () => Promise.reject(new Error('unreachable')),
    };
    const adapter = createSqliteAdapter(boom);

    await expect(adapter.load()).resolves.toBeNull();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(String(errSpy.mock.calls[0]?.[0])).toContain('[sqlite-repo] load failed');
    expect(errSpy.mock.calls[0]?.[1]).toBeInstanceOf(Error);
  });

  it('save() swallows client errors without throwing or rejecting (logged visibly)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom: SqliteRepoClient = {
      read: () => Promise.resolve(emptyState),
      write: () => Promise.reject(new Error('db locked')),
    };
    const adapter = createSqliteAdapter(boom);

    expect(() => adapter.save(snapshot)).not.toThrow();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(String(errSpy.mock.calls[0]?.[0])).toContain('[sqlite-repo] save failed');
  });

  // ── c5 L1b: NPE guard — degraded adapter, queued snapshot, one re-init ────
  it('save() failure keeps the snapshot queued and a later healthy save flushes the newer one', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let healthy = false;
    let written: RawState[] = [];
    const flaky: SqliteRepoClient = {
      read: () => Promise.resolve(emptyState),
      write: raw => {
        if (!healthy) return Promise.reject(new Error('NativeDatabase.initSync rejected'));
        written.push(raw);
        return Promise.resolve();
      },
    };
    const adapter = createSqliteAdapter(flaky);

    adapter.save(snapshot); // fails → degraded, queued in memory
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(written).toHaveLength(0);
    expect(errSpy.mock.calls.some(c => String(c[0]).includes('kept in memory'))).toBe(true);

    const next = { ...snapshot, dayIndex: 7 }; // newer state arrives while degraded
    healthy = true;
    adapter.save(next); // triggers ONE re-init; succeeds and supersedes
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(written).toHaveLength(1);
    expect(written[0]!.kvRows.find(r => r.key === 'dayIndex')!.value).toBe('7');
  });

  it('degraded state recovers: a write that failed once succeeds on the next save attempt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    let writes = 0;
    const flaky: SqliteRepoClient = {
      read: () => Promise.resolve(emptyState),
      write: raw => {
        writes += 1;
        return fail ? Promise.reject(new Error('NPE')) : Promise.resolve();
      },
    };
    const adapter = createSqliteAdapter(flaky);
    adapter.save(snapshot);
    await new Promise<void>(resolve => setTimeout(resolve, 0)); // save #1 fails
    expect(writes).toBe(1);
    fail = false;
    adapter.save({ ...snapshot, dayIndex: 3 }); // degraded → fresh attempt
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(writes).toBe(2);
  });
});
