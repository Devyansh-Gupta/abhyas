# StudySync — Deck Gap Analysis
_Analysis of "StudySync – A Student Productivity App" (TDPCL 2025-26, 21 slides) against live market research. 2026-08-21._

## What the deck gets right (keep these)
- Strong problem framing: tool fragmentation → cognitive overhead (CLT), intention-action gap, SRL theory grounding.
- Honest limitations section (projection vs validation) — rare and credible.
- Ethics/DPDP-2023 + RLS privacy posture designed in, not bolted on.
- Rule-based transparency as a deliberate stance vs opaque AI.
- Correct diagnosis: EdTech optimizes content delivery, not productivity.

## Gaps found (ordered by severity)

### G-A · Conceptual — no retention/revision layer (SEVERE)
The 12-feature Phase-1 list plans **time** but not **memory**. For exam aspirants and DSA grinders, *what to revise next* is the core daily question (Anki's whole value prop). A planner without a memory model will schedule revision of already-mastered topics and neglect decaying ones.
**Fix**: add a lightweight mastery + revision-queue model per topic (SM-2-style or simpler box system), which then *feeds* the smart planner. This becomes the true moat: "the planner that knows what you're about to forget."

### G-B · Data model — no syllabus/topic granularity (SEVERE)
Features reference subjects, but rule-based scheduling needs a **syllabus tree** (subject → units → topics, with weight/exam-blueprint priority, status, last-reviewed) to generate meaningful daily plans. Without it, "smart planner" degenerates to a timetable filler.

### G-C · Stale claim — dual-role architecture (MODERATE)
G3 ("No app has dual-role architecture") is contradicted by MyStudyLife **Family Connect** (parent companion app, schedule visibility). Still defensible, but repositioned: StudySync shares **study analytics by student consent** (mastery, streaks, hours) — collaborative, not schedule-surveillance. Cite MSL in the literature review.

### G-D · Scope tension — personas (MODERATE)
Deck scopes to Indian UG/PG only; the product vision (user-stated) includes competitive-exam aspirants, DSA self-learners, and certification candidates. These differ in *planning shape* (exam-date backward planning vs roadmap progression vs syllabus coverage) but share one engine. Decision needed: beachhead persona first, others as templates on the same engine.

### G-E · Cold start / onboarding (MODERATE)
The planner is only useful after timetable + syllabus + exam dates are entered — classic abandonment trap. Hevy's lesson: value in the first 60 seconds (log a workout instantly). StudySync needs: photo/PDF timetable import, 3-question setup, and an instantly-generated sample plan before full data exists.

### G-F · Retention loop — no peer accountability (MODERATE)
Hevy's friend feed is a top-3 retention driver; StudySync has only the parent link. Peer streaks/study-room sharing (opt-in) is a cheap, high-impact later-phase addition. Deck's "habit formation" trend note under-explores this.

### G-G · Insights loop — no weekly review (MINOR)
Prototype shows mastery % but no reflective loop ("You studied 23h this week, 4-day streak, DBT is your weakest unit — 2 revisions queued"). Hevy-style monthly "wrapped" moments drive re-engagement.

### G-H · Architecture — offline-first vs Supabase tension (MODERATE)
Deck claims offline-first for tier-2/3 connectivity but centers on Supabase. Needs an explicit **local-first** design (on-device SQLite as source of truth + sync engine) or the offline claim collapses. Also: no perf budget stated (user wants performant): set targets — cold start <2s, 60fps lists, <50MB install.

### G-I · Business model — free/pro boundary undefined (MINOR)
"Subscription with premium features" is hand-waved. Hevy's proven pattern: generous free tier with a hard-but-fair cap (e.g., N active routines/subjects), Pro for unlimited + deep analytics. Define the fence before building paywall-adjacent features.

### G-J · Success metrics are feature-checklist (MINOR)
Phase-1 metrics verify construction, not value. Add product metrics: activation rate (% who complete setup + first session day-1), D7 retention, weekly plan-adherence %, revision-queue completion %.

## Prototype note (STUDEX screenshots, slides 17-19)
Rough dark-theme mobile prototype: PLAN/CLASSES/HABITS/TIMER/QUIZ/PROGRESS nav, day-chip planner, Pomodoro timer, mastery rings. Per user: **treat as a throwaway sketch — do not anchor design on it.** Its feature instincts (plan/timer/progress trinity) are right; the bar is Hevy-level polish.
