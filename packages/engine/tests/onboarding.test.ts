import { describe, it, expect } from 'vitest';
import { initOnboarding, reduce, canAdvance, MAX_SUBJECTS, type OnboardingState, type SubjectPick } from '../src/onboarding.js';

const pick = (emoji: string, name = emoji): SubjectPick => ({ emoji, name, kind: 'core' });
const withState = (over: Partial<OnboardingState>): OnboardingState =>
  ({ ...initOnboarding(), ...over });

describe('onboarding state machine (M1 gates)', () => {
  it('board+class gate step 1', () => {
    let s = initOnboarding();
    s = reduce(s, { t: 'next' });
    expect(canAdvance(s)).toBe(false);
    s = reduce(s, { t: 'setBoard', board: 'CBSE' });
    expect(canAdvance(s)).toBe(false);
    s = reduce(s, { t: 'setClass', cls: 10 });
    expect(canAdvance(s)).toBe(true);
  });

  it('stream required only for 11–12', () => {
    let s: OnboardingState = withState({ board: 'CBSE', cls: 12 });
    s = { ...s, step: 2 };
    expect(canAdvance(s)).toBe(false); // needs stream
    s = reduce(s, { t: 'setStream', s: 'Science' });
    expect(canAdvance(s)).toBe(true);
    let s10: OnboardingState = withState({ board: 'CBSE', cls: 10, step: 2 });
    expect(canAdvance(s10)).toBe(false); // step 2 = subjects for 9–10: needs ≥1
    s10 = reduce(s10, { t: 'toggleSubject', pick: pick('📐') });
    expect(canAdvance(s10)).toBe(true);
  });

  it('subject review: ≥1 and ≤8 active; toggle removes without deleting', () => {
    let s: OnboardingState = { ...initOnboarding(), board: 'CBSE', cls: 10, subjects: [pick('📐'), pick('⚗️')], step: 3 };
    s = reduce(s, { t: 'toggleSubject', pick: pick('📐') }); // remove
    const active = s.subjects.filter(x => !x.removed);
    expect(active.length).toBe(1);
    expect(s.subjects.length).toBe(2); // still present (undoable)
    s = reduce(s, { t: 'toggleSubject', pick: pick('📐') }); // re-add
    expect(s.subjects.every(x => !x.removed)).toBe(true);
  });

  it('addCustom dedupes case-insensitively and respects the cap', () => {
    let s: OnboardingState = { ...initOnboarding(), board: 'CBSE', cls: 10, subjects: [pick('📐', 'Mathematics')], step: 3 };
    s = reduce(s, { t: 'addCustom', name: '  mathematics ' });
    expect(s.subjects.length).toBe(1); // dupe rejected
    for (let i = 2; i <= MAX_SUBJECTS; i++) {
      s = reduce(s, { t: 'addCustom', name: `Elective ${i}` });
    }
    expect(s.subjects.filter(x => !x.removed).length).toBe(MAX_SUBJECTS);
    const before = s.subjects.length;
    s = reduce(s, { t: 'addCustom', name: 'One more' });
    expect(s.subjects.length).toBe(before); // cap enforced: 9th subject rejected
    expect(canAdvance(s)).toBe(true);       // exactly 8 active is allowed (≤ MAX)
  });

  it('coverage + baseline capture mid-year state', () => {
    let s: OnboardingState = { ...initOnboarding(), subjects: [pick('📐')], step: 4 };
    s = reduce(s, { t: 'setCoverage', emoji: '📐', frac: 0.5 });
    s = reduce(s, { t: 'setBaseline', emoji: '📐', pct: 82 });
    expect(s.coverage['📐']).toBe(0.5);
    expect(s.baseline['📐']).toBe(82);
  });
});
