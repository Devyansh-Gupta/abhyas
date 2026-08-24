/**
 * Supabase client bootstrap (P2 auth + sync lane).
 *
 * ── Node/vitest safety ──────────────────────────────────────────────────────────
 * react-native-url-polyfill and @react-native-async-storage/async-storage both
 * pull React Native at import time, so they are imported dynamically inside
 * getSupabase() — never at module top level (same pattern as src/repo/sqlite.ts).
 * Importing this module in plain Node is safe; only the RN pieces stay lazy.
 *
 * ── Disabled mode (no silent failure) ───────────────────────────────────────────
 * When EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are absent the module exports
 * `supabaseEnabled = false` and getSupabase() resolves null; the app keeps working
 * offline-only. One visible warning is logged exactly once so the disabled state
 * is never silent (F21/F24).
 */
import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js';

export type { SupabaseClient };

export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
/** Supabase project ref (also the subdomain of SUPABASE_URL when set). */
export const SUPABASE_PROJECT_ID = process.env.EXPO_PUBLIC_SUPABASE_PROJECT_ID ?? '';

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!supabaseEnabled) {
  // One visible warning — offline-only mode is a deliberate state, not a silent one.
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing — ' +
      'cloud sync + sign-in are DISABLED; the app runs offline-only.',
  );
}

// ── abhyas schema constants (cloud mirrors packages/db/src/schema.ts) ───────────

export const SYNC_SCHEMA = 'abhyas';
export const SYNC_LOG_TABLE = 'sync_log';
/** Pull page size — syncOnce() keeps the cursor put until a full page drains. */
export const PULL_LIMIT = 500;

/** Cloud `abhyas.sync_log` row shape (snake_case columns; payload jsonb). */
export interface SyncLogRow {
  op_id: string;
  device_id: string;
  entity: string;
  entity_id: string;
  /** create | update | delete */
  op: string;
  payload: Record<string, unknown>;
  client_ts: number;
}

/** REST path for the sync_log table (pure; exported for tests). */
export function syncLogRestPath(): string {
  return `/rest/v1/${SYNC_SCHEMA}.${SYNC_LOG_TABLE}`;
}

/** Full REST URL against a given project base (pure; exported for tests). */
export function restUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

/**
 * PostgREST query string for the pull cursor (pure; exported for tests):
 * strictly-greater-than keeps replays idempotent, asc order feeds applyOps.
 */
export function pullSyncLogQuery(since: number): string {
  const params = new URLSearchParams({
    select: '*',
    client_ts: `gt.${since}`,
    order: 'client_ts.asc',
    limit: String(PULL_LIMIT),
  });
  return params.toString();
}

// ── Client factory ──────────────────────────────────────────────────────────────

let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Lazily build the supabase-js client with an AsyncStorage-backed auth storage.
 * Resolves null whenever Supabase is unconfigured or initialization fails —
 * callers must branch on null (and surface it) rather than assume connectivity.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled) return Promise.resolve(null);
  if (clientPromise) return clientPromise;
  clientPromise = createExpoClient().catch((err: unknown) => {
    console.error('[supabase] client initialization failed:', err);
    return null;
  });
  return clientPromise;
}

async function createExpoClient(): Promise<SupabaseClient> {
  // Dynamic imports keep this module Node-safe (see header note).
  await import('react-native-url-polyfill/auto');
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // native app — no redirect URL to parse
    },
  });
}
