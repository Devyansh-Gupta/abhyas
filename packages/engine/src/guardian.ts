/**
 * Parent Link flow (P2) — invite generation + guardian summary, pure TS.
 *
 * Student side: `createGuardianInvite` mints a shareable code (signed payload +
 * deep link). Guardian side: `decodeGuardianCode` verifies it and
 * `guardianSummary` derives the read-only view-model from live store data —
 * mastery reuses masteryBySubject (#7), never reimplemented in UI.
 *
 * Transport note: signing is local integrity-only (tamper-evident codes) with a
 * default app salt. The real link handshake (Supabase, credentials pending)
 * plugs in behind this seam later — swap the secret / add server verification
 * without changing call sites.
 */
import { masteryBySubject, type SubjectMastery } from './mastery';
import { type StreakState } from './streak';
import { type Topic } from './types';

/** Signed invite payload. Day numbers are store dayIndex values (device-relative). */
export interface GuardianInvitePayload {
  studentId: string;
  /** dayIndex when generated */
  issuedDay: number;
  /** validity window in days from issue */
  ttlDays: number;
  /** disambiguator so same-day re-invites get distinct ids/codes */
  n: number;
}

export interface GuardianInvite {
  id: string;
  /** shareable signed code — the deep-link path segment */
  code: string;
  /** abhyas://guardian/<code> — opens the read-only summary route */
  deepLink: string;
  payload: GuardianInvitePayload;
  /** issuedDay + ttlDays; past this the code is rejected as expired */
  expiresDay: number;
}

export const GUARDIAN_LINK_TTL_DAYS = 30;

/**
 * Local signing salt — integrity/tamper-evidence only, NOT a security secret.
 * The transport adapter replaces this at real handshake time (P2 sync).
 */
export const GUARDIAN_DEFAULT_SECRET = 'abhyas-guardian-local-v1';

// --- portable primitives (no btoa/TextEncoder — Hermes + node safe) --------

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.codePointAt(i)!;
    if (c > 0xffff) i++; // surrogate pair consumed
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64Url(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += B64[b2 & 63];
  }
  return out;
}

function fromBase64Url(s: string): number[] | null {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null; // illegal character
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  return out;
}

function utf8FromBytes(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]!;
    let cp: number;
    if (b < 0x80) { cp = b; i += 1; }
    else if (b < 0xe0) { cp = ((b & 31) << 6) | (bytes[i + 1]! & 63); i += 2; }
    else if (b < 0xf0) { cp = ((b & 15) << 12) | ((bytes[i + 1]! & 63) << 6) | (bytes[i + 2]! & 63); i += 3; }
    else { cp = ((b & 7) << 18) | ((bytes[i + 1]! & 63) << 12) | ((bytes[i + 2]! & 63) << 6) | (bytes[i + 3]! & 63); i += 4; }
    out += String.fromCodePoint(cp);
  }
  return out;
}

/** FNV-1a 32-bit → fixed-width base36 tag. Deterministic across runtimes. */
export function guardianSign(data: string, secret: string): string {
  let h = 0x811c9dc5;
  const mix = (s: string): void => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  mix(data);
  mix('\u0000');
  mix(secret);
  return (h >>> 0).toString(36).padStart(7, '0');
}

// --- invite minting / verification ------------------------------------------

export interface CreateGuardianInviteOpts {
  studentId: string;
  dayIndex: number;
  ttlDays?: number;
  nonce?: number;
  secret?: string;
}

export function createGuardianInvite(opts: CreateGuardianInviteOpts): GuardianInvite {
  const ttlDays = opts.ttlDays ?? GUARDIAN_LINK_TTL_DAYS;
  const secret = opts.secret ?? GUARDIAN_DEFAULT_SECRET;
  const payload: GuardianInvitePayload = {
    studentId: opts.studentId,
    issuedDay: opts.dayIndex,
    ttlDays,
    n: opts.nonce ?? 0,
  };
  const body = base64Url(utf8Bytes(JSON.stringify(payload)));
  const code = `${body}.${guardianSign(body, secret)}`;
  return {
    id: `g_${guardianSign(code, 'id')}`,
    code,
    deepLink: `abhyas://guardian/${code}`,
    payload,
    expiresDay: opts.dayIndex + ttlDays,
  };
}

export type GuardianDecodeResult =
  | { ok: true; payload: GuardianInvitePayload; expiresDay: number }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired'; detail: string };

/** Verify a shared code against the expected signing secret and today's dayIndex. */
export function decodeGuardianCode(
  code: string,
  opts: { todayDay: number; secret?: string },
): GuardianDecodeResult {
  const parts = code.trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: 'malformed', detail: 'code is not <body>.<signature>' };
  }
  const [body, sig] = parts;
  if (guardianSign(body, opts.secret ?? GUARDIAN_DEFAULT_SECRET) !== sig) {
    return { ok: false, reason: 'bad_signature', detail: 'signature mismatch — code was edited or made up' };
  }
  const bytes = fromBase64Url(body);
  if (!bytes) return { ok: false, reason: 'bad_signature', detail: 'body is not decodable' };
  let payload: GuardianInvitePayload;
  try {
    const raw = JSON.parse(utf8FromBytes(bytes)) as Partial<GuardianInvitePayload>;
    if (
      typeof raw.studentId !== 'string' || raw.studentId.length === 0 ||
      typeof raw.issuedDay !== 'number' || !Number.isFinite(raw.issuedDay) ||
      typeof raw.ttlDays !== 'number' || !(raw.ttlDays > 0) ||
      typeof raw.n !== 'number'
    ) {
      return { ok: false, reason: 'malformed', detail: 'payload fields missing or wrong-typed' };
    }
    payload = { studentId: raw.studentId, issuedDay: raw.issuedDay, ttlDays: raw.ttlDays, n: raw.n };
  } catch {
    return { ok: false, reason: 'malformed', detail: 'payload is not valid JSON' };
  }
  const expiresDay = payload.issuedDay + payload.ttlDays;
  if (opts.todayDay > expiresDay) {
    return { ok: false, reason: 'expired', detail: `valid through day ${expiresDay}, today is ${opts.todayDay}` };
  }
  return { ok: true, payload, expiresDay };
}

// --- guardian summary (read-only view-model) ---------------------------------

/** Structural twin of the store's SessionLogEntry — keeps the engine RN-free. */
export interface FocusSession { day: number; min: number }

/** Sum of focus minutes in the trailing 7-day window ending at endDay (inclusive). */
export function weeklyFocusMinutes(sessions: readonly FocusSession[], endDay: number): number {
  const from = endDay - 6;
  return sessions.reduce((a, s) => (s.day >= from && s.day <= endDay ? a + s.min : a), 0);
}

export interface GuardianSummary {
  subjects: SubjectMastery[];
  totalTopics: number;
  masteredTopics: number;
  streakCurrent: number;
  streakLongest: number;
  weeklyFocusMinutes: number;
}

/** Everything the guardian screen shows — derived here so UI renders only. */
export function guardianSummary(input: {
  topics: readonly Topic[];
  sessions: readonly FocusSession[];
  streak: StreakState;
  dayIndex: number;
}): GuardianSummary {
  return {
    subjects: masteryBySubject(input.topics),
    totalTopics: input.topics.length,
    masteredTopics: input.topics.filter(t => t.box >= 5).length,
    streakCurrent: input.streak.current,
    streakLongest: input.streak.longest,
    weeklyFocusMinutes: weeklyFocusMinutes(input.sessions, input.dayIndex),
  };
}
