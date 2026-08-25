// P3 OCR import — phase 1 heuristic syllabus parser.
// Pure, deterministic, no device/RN/network deps. v0 heuristics per docs/p3-ocr-research.md.

export interface ParsedImport {
  subjects: Array<{ name: string; topics: string[] }>;
  warnings: string[];
}

const SUBJECT_PREFIX_DETECT = /^(subject|sub)\b[:\s-]/i;
const SUBJECT_PREFIX_STRIP = /^(subject|sub)\b[:\s-]+/i;

/** ALL-CAPS: only uppercase letters plus & ' - and spaces allowed, at least 3 uppercase letters. */
function isAllCapsHeader(line: string): boolean {
  if (!/^[A-Z&'’\- ]+$/.test(line)) return false;
  const upper = line.match(/[A-Z]/g);
  return upper !== null && upper.length >= 3;
}

function isHeaderLine(line: string): boolean {
  if (line.endsWith(':')) return true;
  if (SUBJECT_PREFIX_DETECT.test(line)) return true;
  return isAllCapsHeader(line);
}

/** Derive the subject display name from a header line. */
function headerName(line: string): string {
  let name: string;
  if (line.endsWith(':')) {
    name = line.slice(0, -1);
  } else if (SUBJECT_PREFIX_DETECT.test(line)) {
    name = line.replace(SUBJECT_PREFIX_STRIP, '');
    if (!name.trim()) name = line;
  } else {
    name = line;
  }
  return normalize(name);
}

/** Strip "1." / "1)" / "•" / "-" style prefixes and collapse whitespace. */
function normalizeTopic(line: string): string {
  return normalize(line.replace(/^\d+\s*[.)]\s*/, '').replace(/^[•▪◦*–—-]\s+/, ''));
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Parse raw OCR lines into subjects + topics using v0 heuristics:
 * - Subject headers: ALL-CAPS lines (>=3 uppercase letters), lines ending with ':',
 *   or lines starting with "Subject"/"Sub" followed by ':', whitespace, or '-'.
 * - Topic lines: non-empty lines under a header that aren't headers themselves.
 * - Numbering/bullets stripped from topic names; whitespace collapsed.
 * - Non-empty lines before the first header are ignored (counted in a warning).
 * - Zero subjects found -> visible retry warning (no silent failure).
 */
export function parseSyllabusText(lines: string[]): ParsedImport {
  const subjects: ParsedImport['subjects'] = [];
  const warnings: string[] = [];
  let current: { name: string; topics: string[] } | null = null;
  let preHeaderCount = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isHeaderLine(line)) {
      current = { name: headerName(line), topics: [] };
      subjects.push(current);
      continue;
    }
    if (current === null) {
      preHeaderCount++;
      continue;
    }
    current.topics.push(normalizeTopic(line));
  }

  if (preHeaderCount > 0) {
    warnings.push(`${preHeaderCount} lines before first subject ignored`);
  }
  if (subjects.length === 0) {
    warnings.push('No subject headers detected — try better lighting or a clearer photo');
  }

  return { subjects, warnings };
}
