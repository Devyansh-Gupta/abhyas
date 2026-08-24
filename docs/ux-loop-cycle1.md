# Abhyas UX Improvement Loop — Cycle 1 Diagnosis

**Date:** 2026-08-24 · **Method:** on-device drive (MEmu, release APK 32702713917) + rendered-surface inspection + Hevy design-spec research (DESIGN-expo.md)

## Verdict
Functional skeleton is solid (5 tabs, derived plan, SRS rating, timetable re-solve). The gap to "Hevy-level" is **finish, hierarchy, and momentum** — not features.

## Defect list (ranked by impact)

### A. Momentum & motivation layer missing (biggest gap vs Hevy)
1. **No progress ring on Today.** Hevy's core loop is a live set table + rest ring. Our Today is a flat checklist; % today is a tiny text label. Fix: circular ring in header (done/total blocks), accent-colored, animated.
2. **No "next up" hero card.** First block should be a large card: "Up next 16:00 · Trigonometry · 40m" with a big Start button deep-linking to Focus with the topic bound. Currently the first card looks identical to all others.
3. **Streak is a number, not a moment.** Hevy makes PRs gold badges + haptics. Our 🔥0 is static text. Fix: streak flame with weekly dot-row (7 dots M..S), celebrate on increment.
4. **Zero micro-interactions.** No haptics on check-off, no checkmark animation, no transition when plan re-solves. Hevy: success haptic + wash animation per set.

### B. Information hierarchy defects (Today)
5. **Hardcoded "Thu, 21 Aug · CBSE Class 10"** — literally a string literal in index.tsx line 19. Must be live date + actual board/class from store.
6. **"0 blocks · derived from timetable, revisions & exams" shown pre-onboarding** — meaningless before setup; also "derived" jargon appears twice on the screen. Fix: hide meta line when plan empty; replace "· derived" with a subtle "auto-planned" or drop.
7. **Every block card is identical weight.** No visual difference between the next-up block and the 6th. Fix: next-up card gets accent border + "NOW/NEXT" chip; done cards get green wash + strikethrough title (Hevy's completed-row wash pattern).
8. **"Why: Not started yet" is noise** — the reason line shows the same text on every card pre-session. Fix: only show reason when it's informative (exam-linked, carried, backlog).

### C. Typography & polish
9. **No brand font.** System default everywhere; Hevy ships Inter + tabular-nums on all numbers (timers reflow without it). Fix: expo-font Inter, tabular-nums on timer/stat/percent text.
10. **Emoji as icon system** (🔥🏆⏱📚📅 in Progress cards, 😵‍💫🚶💪 rating chips). Reads cheap vs a real icon set. Fix: @expo/vector-icons Ionicons with consistent weight/size; keep emoji only in playful empty-states if desired.
11. **Tab bar icons inconsistent** (custom TabIcon set, mixed visual weight). Fix: single Ionicons set, filled when focused, 22px, accent tint.
12. **Progress stat cards are flat boxes.** No elevation, no alpha washes. Fix: Hevy-style translucent washes (accent 16% bg for active, done 16% for completed stats), hairline dividers.

### D. Workflow gaps
13. **Focus screen topic chips unbound.** "no topic bound — session still logs" is a confession, not UX. Fix: tapping a Today card's Start opens Focus pre-bound; chips show bound state.
14. **Rating flow disconnected from timer.** After Finish, user must navigate to Subjects to rate. Fix: rating prompt surfaces immediately post-session (modal on Focus).
15. **No empty-state delight.** Welcome text is one grey line. Fix: illustration/emoji + 3-step mini-guide (1. Pick board 2. Tick subjects 3. Get today's plan).

## What's already good (keep)
- Dark palette is close to Hevy's canvas (#0E1116 identical!)
- Card radius/spacing rhythm consistent
- Timetable week strip + free-time summary is a genuinely good feature
- Mastery box-ladder (5 dots) is a clear metaphor

## Cycle 1 scope (fix lanes)
- **L1 (engine-safe, high impact):** live date, hide pre-onboarding meta, next-up hero card, done-wash + strikethrough, reason-line gating — index.tsx only
- **L2:** Ionicons swap across tab bar + Progress cards + rating chips; Inter font + tabular-nums
- **L3:** progress ring on Today header; haptics on check/rating
- **L4:** Focus pre-binding from Today + post-session rating modal
Verification: served-surface gates at 2 viewports + on-device screenshot comparison + full turbo gate.
