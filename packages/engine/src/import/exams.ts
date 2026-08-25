// Cycle-5 L4 (F4) — exam timetable parser.
// Pure, deterministic, no device/RN/network deps (same contract as parse.ts).
//
// Input: raw OCR lines from a datesheet/timetable photo (e.g. the MCA IA-1
// fixture: day/date/session rows with subject-code+name cells).
// Output: one exam per (date × subject) pair, plus conservative warnings —
// anything without a date is never invented into an exam.

export interface ParsedExam {
  name: string;
  /** ISO yyyy-mm-dd (year inferred from the line, else the current year) */
  date?: string;
  /** normalized session hint: FN / AN / morning / afternoon / Session I|II / raw time range */
  session?: string;
}

export interface ParsedExamTimetable {
  exams: ParsedExam[];
  warnings: string[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** 03.09.2026 / 3-9-26 / 03/09 — day first (Indian datesheet convention). */
const NUM_DATE = /\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?\b/;
/** 03.09.2026 (Thursday) → strip the parenthesised weekday for name extraction. */
const WEEKDAY_TAIL = /\s*\((?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\)\s*$/i;
/** 3 Sep 2026 / 3rd September / Sep 3 */
const MONTH_DATE =
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})(?:\s*,?\s*(\d{2,4}))?\b|\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{2,4}))?\b/;

/** FN / AN / morning / afternoon / Session I|II / 1|2 / "2.10 PM - 3.10 PM" */
const SESSION_PATTERNS: Array<{ re: RegExp; label: (m: RegExpMatchArray) => string }> = [
  { re: /\bFN\b/, label: () => 'FN' },
  { re: /\bAN\b/, label: () => 'AN' },
  { re: /\bmorning\b/i, label: () => 'morning' },
  { re: /\bafternoon\b/i, label: () => 'afternoon' },
  { re: /\bsession\s+(I{1,3}|IV|V|1|2|3|4|5)\b/i, label: m => `Session ${(m[1] ?? '').toUpperCase()}` },
  {
    // "2.10 PM - 3.10 PM" / "10:00 AM–12:30 PM" — a time range implies the session
    re: /\b\d{1,2}[.:]\d{2}\s*(?:AM|PM)\s*[-–—to]+\s*\d{1,2}[.:]\d{2}\s*(?:AM|PM)\b/i,
    label: m => m[0].replace(/\s+/g, ' ').trim(),
  },
];

function detectSession(line: string): string | undefined {
  for (const { re, label } of SESSION_PATTERNS) {
    const m = line.match(re);
    if (m) return label(m);
  }
  return undefined;
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** Normalize a matched date to ISO; unknown/2-digit years map into 2000s. */
function isoFrom(day: number, month: number, year?: number): string {
  const y = year === undefined ? new Date().getFullYear() : year < 100 ? 2000 + year : year;
  return `${y}-${two(month)}-${two(day)}`;
}

function matchDate(line: string): string | undefined {
  const num = line.match(NUM_DATE);
  if (num) {
    const day = parseInt(num[1] ?? '', 10);
    const month = parseInt(num[2] ?? '', 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return isoFrom(day, month, num[3] ? parseInt(num[3], 10) : undefined);
    }
  }
  const mo = line.match(MONTH_DATE);
  if (mo) {
    // group layout: [full, day, monName, yr] | [full, monName, day, yr] (2nd alt)
    const dayRaw = mo[1] ?? mo[4];
    const monRaw = (mo[2] ?? mo[5] ?? '').toLowerCase().slice(0, 5);
    const day = dayRaw ? parseInt(dayRaw, 10) : NaN;
    const month = MONTHS[monRaw.slice(0, 3)] ?? MONTHS[monRaw];
    const yrRaw = mo[3] ?? mo[6];
    if (month !== undefined && !Number.isNaN(day) && day >= 1 && day <= 31) {
      return isoFrom(day, month, yrRaw ? parseInt(yrRaw, 10) : undefined);
    }
  }
  return undefined;
}

/** Subject display name: drop trailing "(25MCAIAI301)" codes, weekday tails, bullets. */
function subjectName(text: string): string {
  let s = text
    .replace(WEEKDAY_TAIL, '')
    .replace(/\s*\((?:[A-Z0-9]{5,})\)\s*$/, '') // trailing subject-code parens
    .replace(/^[•▪◦*–—-]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // "Open Elective - FINANCIAL LITERACY" → keep the subject part after the kind prefix
  const elective = s.match(/^(?:open\s+elective|elective|generic\s+elective)\s*[-–:]\s*(.+)$/i);
  if (elective && elective[1]) s = elective[1].trim();
  return s;
}

/**
 * Parse raw OCR lines into dated exam entries.
 * Rules:
 *  - a line containing a date starts/extends the "current date"; any subject
 *    text on that line (after the date) becomes an exam immediately;
 *  - following non-date, non-empty lines attach to the current date as
 *    additional papers (multi-session days), unless they carry their own date;
 *  - lines before the first date are skipped and counted into a warning;
 *  - a line with a session hint but no date (e.g. a TIME/DATE header row) is
 *    remembered and applied to the next exam that lacks its own session;
 *  - zero exams → visible retry warning (no silent failure).
 */
export function parseExamTimetable(lines: string[]): ParsedExamTimetable {
  const exams: ParsedExam[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let currentDate: string | undefined;
  let pendingSession: string | undefined;

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    const date = matchDate(line);
    if (date) {
      currentDate = date;
      const after = line.replace(NUM_DATE, ' ').replace(MONTH_DATE, ' ');
      const text = subjectName(after);
      const session = detectSession(line);
      if (session) pendingSession = session;
      if (text) {
        exams.push({ name: text, date, session: session ?? pendingSession });
        pendingSession = undefined;
      }
      continue;
    }

    const session = detectSession(line);
    // header-ish lines ("TIME / DATE 2.10 PM - 3.10 PM") carry a session for the rows below
    if (session && currentDate === undefined) {
      pendingSession = session;
      continue;
    }

    const text = subjectName(line);
    if (!text) continue;
    if (currentDate === undefined) {
      skipped++;
      continue;
    }
    exams.push({ name: text, date: currentDate, session: session ?? pendingSession });
    pendingSession = undefined;
  }

  if (skipped > 0) warnings.push(`skipped ${skipped} non-date lines`);
  if (exams.length === 0) {
    warnings.push('No dated exam rows detected — try better lighting or a clearer photo');
  }

  return { exams, warnings };
}
