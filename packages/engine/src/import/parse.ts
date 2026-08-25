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

/** Collapse letter-spaced OCR artifacts: "QU E S TI N S" -> "QUESTIONS".
 * Word boundaries (2+ spaces) are preserved; only single-space runs of short caps tokens are joined. */
export function collapseLetterSpaced(line: string): string {
  const words = line.trim().split(/\s{2,}/);
  return words
    .map((word) => {
      const noSpaces = word.replace(/ /g, '');
      // Only join when what remains reads as spaced-out caps/digits (>=3 uppercase letters)
      // and most of its space-separated fragments are 1-2 chars.
      if (!/^[A-Z0-9&'’\-]+$/.test(noSpaces)) return word;
      const upper = noSpaces.match(/[A-Z]/g);
      if (upper === null || upper.length < 3) return word;
      const tokens = word.split(' ');
      const shortTokens = tokens.filter((t) => t.length <= 2).length;
      if (shortTokens / tokens.length >= 0.5) return noSpaces;
      return word;
    })
    .join('  ');
}

const SUBSECTION_DETECT = /^\d+\.\d+\.?\s+[A-Z]/i;

function isSubsectionLine(line: string): boolean {
  // e.g. "2.1 Combination Reaction" — a topic under the current subject, not a header.
  return SUBSECTION_DETECT.test(line) && !line.endsWith(':');
}

function isHeaderLine(line: string): boolean {
  if (isSubsectionLine(line)) return false;
  if (line.endsWith(':')) return true;
  if (SUBJECT_PREFIX_DETECT.test(line)) return true;
  return isAllCapsHeader(collapseLetterSpaced(line));
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

/** Strip "1." / "1)" / "2.1" / "•" / "-" style prefixes and collapse whitespace. */
function normalizeTopic(line: string): string {
  return normalize(line.replace(/^\d+(?:\.\d+)*[.)]?\s+/, '').replace(/^[•▪◦*–—-]\s+/, ''));
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Parse raw OCR lines into subjects + topics using v0 heuristics:
 * - Subject headers: ALL-CAPS lines (>=3 uppercase letters), lines ending with ':',
 *   or lines starting with "Subject"/"Sub" followed by ':', whitespace, or '-'.
 * - Topic lines: non-empty lines under a header that aren't headers themselves.
 * - Numbering/bullets stripped from topic names (incl. "2.1" subsection numbers); whitespace collapsed.
 * - Letter-spaced OCR caps ("QU E S TI N S") collapsed before ALL-CAPS header detection.
 * - "N.M Title" subsection lines are topics, not headers (unless they end with ':').
 * - >60% question-mark topics -> exercise-page review hint warning.
 * - Non-empty lines before the first header are ignored (counted in a warning).
 * - Zero subjects found -> visible retry warning (no silent failure).
 */
export function parseSyllabusText(lines: string[]): ParsedImport {
  const subjects: ParsedImport['subjects'] = [];
  const warnings: string[] = [];
  let current: { name: string; topics: string[] } | null = null;
  let preHeaderCount = 0;

  for (const raw of lines) {
    const line = collapseLetterSpaced(raw.trim());
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

  const totalTopics = subjects.reduce((n, s) => n + s.topics.length, 0);
  const questionTopics = subjects.reduce(
    (n, s) => n + s.topics.filter((t) => t.endsWith('?')).length,
    0,
  );
  if (totalTopics > 0 && questionTopics / totalTopics > 0.6) {
    warnings.push(
      'This looks like an exercise/questions page rather than a topic list — review carefully before importing.',
    );
  }

  if (preHeaderCount > 0) {
    warnings.push(`${preHeaderCount} lines before first subject ignored`);
  }
  if (subjects.length === 0) {
    warnings.push('No subject headers detected — try better lighting or a clearer photo');
  }

  return { subjects, warnings };
}
