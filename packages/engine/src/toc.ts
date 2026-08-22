/**
 * TOC parser — T2 acquisition tier (ported from onboarding prototype, F4/F25 contract).
 *
 * Contract:
 *  - splits on newlines AND inline numbering ("...equations 4. Quadratic...")
 *  - strips leading numbering (1. / 2) / 3]) and trailing punctuation
 *  - pre-number fragments are PRESERVED (data-loss prevention, F25)
 */
export function parseToc(raw: string): string[] {
  const norm = raw.replace(/(\S)\s+(\d{1,2})\.\s+/g, '$1\n$2. ');
  return norm
    .split('\n')
    .map(s => s.replace(/^\s*\d{1,2}[.)\]]?\s*/, '').replace(/\s*[.)\]]\s*$/, '').trim())
    .filter(Boolean);
}
