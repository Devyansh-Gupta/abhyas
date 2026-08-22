/**
 * Streak engine — OR-rule with break semantics (decision #2, F22/F23 fixes ported).
 *
 * Contract:
 *  - day qualifies: ≥1 completed block OR ≥ STREAK_RULE_MIN_MINUTES focus minutes
 *  - rollover: qualifying day → streak+1 (if not already counted today), missed=0
 *  - non-qualifying day → missed+1; 2 consecutive misses ⇒ streak=0 + broke flag
 *  - day boundary is DEVICE time (owner decision 2026-08-22) — engine takes dates, caller owns clocks
 */
import { STREAK_RULE_MIN_MINUTES } from './types.js';

export interface DayActivity {
  blocksDone: number;
  focusMinutes: number;
}

export interface StreakState {
  current: number;
  longest: number;
  /** consecutive non-qualifying days at last rollover */
  missed: number;
  /** streak already incremented for the current day */
  countedToday: boolean;
}

export const initialStreak = (): StreakState => ({ current: 0, longest: 0, missed: 0, countedToday: false });

export function qualifies(a: DayActivity): boolean {
  return a.blocksDone >= 1 || a.focusMinutes >= STREAK_RULE_MIN_MINUTES;
}

export interface RolloverResult {
  state: StreakState;
  broke: boolean;
}

/** Close out a day and move to the next. Pure. */
export function rollover(state: StreakState, activity: DayActivity): RolloverResult {
  let broke = false;
  let next: StreakState;

  if (qualifies(activity)) {
    const current = state.countedToday ? state.current : state.current + 1;
    next = { current, longest: Math.max(state.longest, current), missed: 0, countedToday: false };
  } else {
    const missed = state.missed + 1;
    if (missed >= 2) {
      next = { current: 0, longest: state.longest, missed: 0, countedToday: false };
      broke = true;
    } else {
      next = { ...state, missed, countedToday: false };
    }
  }
  return { state: next, broke };
}

/** Live bump during the day (first qualifying event today). Mutates nothing. */
export function bumpToday(state: StreakState, activity: DayActivity): StreakState {
  if (state.countedToday || !qualifies(activity)) return state;
  const current = state.current + 1;
  return { current, longest: Math.max(state.longest, current), missed: 0, countedToday: true };
}
