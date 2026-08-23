# Abhyas — Pedagogy & Instructional Design

_The learning-science layer under the product. Everything here is implemented in
`packages/engine` and golden-tested; this doc explains WHY, for the team, faculty
pitches, and future contributors. Curriculum-design brief per docs/MASTER-PLAN.md._

## Learners (audience brief)
- **Primary beachhead:** CBSE Class 9–12 students (exam-pressure years; phone-first).
- **Accepted scope:** Class 5–12 + UG/PG (schema accommodates; presets expand later).
- **Prerequisites assumed:** none — onboarding calibrates from zero (persona → board →
  subjects → coverage → baseline marks → exams → learning pace).
- **Constraints:** ≤15 min/day typical budget; shared/low-end Android devices; intermittent
  connectivity (local-first is a pedagogical requirement, not just architecture).

## Learning model (what the engine encodes)

### 1. Spaced retrieval (SRS ladder)
- Intervals [1,3,7,16,35] days — Leitner-style boxes; confidence rating 1–3 after each
  revision moves a topic down/up the ladder (`applyRating`).
- **Why retrieval, not re-reading:** testing effect is among the most replicated findings
  in learning science; the product's core loop (rating recall after trying) IS retrieval practice.
- **Learning-pace dial (R7):** one multiplier ×0.7/×1.0/×1.4 on every interval — an honest,
  explainable approximation of FSRS's desired-retention parameter without exposing the math.
  Golden tests pin rounding boundaries and the 1-day floor.

### 2. Derived planning (capacity-aware)
- `buildDayPlan` solves today's plan from: due revisions first, then new topics weighted by
  topic weight + subject examWeight, capped by daily capacity.
- Revisions outrank new content — forgetting is more expensive than falling behind on coverage.
- Carry policy (≤2 forward-work items, revisions never carried) keeps backlog visible but bounded:
  a plan that silently snowballs teaches helplessness; a bounded carry teaches recovery.

### 3. Marks→mastery recalibration (`marks.ts`)
- Test scores are evidence, not verdicts: `recalibrate` adjusts topic weights after assessments,
  shifting future plan share toward weak areas (baseline flag marks the first datum per subject).

### 4. Streaks that don't punish honesty
- `streak.ts` break semantics: a day with any logged focus or completed block preserves the
  streak (effort counts, not perfection). Rollover returns `broke` explicitly so UI can show
  a recovery path, never a silent reset (F21/F24 no-silent-failure rule).

## Scope & sequence (product surfaces → pedagogy)

| Stage | Surface | Instructional job | Completion evidence |
|---|---|---|---|
| Calibrate | Onboarding v2 | coverage + baseline + pace → starting state that isn't a guess | Today seeded with preset topics at correct coverage |
| Daily loop | Today + Focus | 1 revision-first plan; timer session; confidence rating | plan items done; SRS state advanced |
| Weekly | Plan tab | timetable-aware capacity; exam windows shape the week | move/cancel period → plan re-solves |
| Mastery | Subjects/Progress | bars = weighted mastery; trend visible | bar delta after rating (walk-verified) |
| Exam season | #9 mode | capacity slider + gap-day dated plan | dated plan respects gaps (golden tests) |

## Assessment plan (how we know the product teaches)
- **Formative (in-product):** confidence self-ratings (1–3) per revision; recall-rate per topic
  (feeds R7 adaptive nudge post-pilot); plan completion rate.
- **Summative (product-level, pilot):** retention proxy = % revisions rated ≥2; streak
  survival ≥7 days; marks trajectory on logged assessments vs baseline.
- **Instrumentation:** aggregate events only (R3) — screen views, funnel steps; never content.

## Differentiation & accessibility assumptions
- Pace dial = primary differentiation (3 plain-language choices, editable in Settings).
- Devanagari + Latin support required end-to-end (OCR cascade already supports both).
- Dark-first design; contrast tokens fixed in @theme; reflow-safe layouts for small screens.
- Open question (recorded, unresolved): per-subject pace override — deferred v1.1 per ADR E2.

## Rejected alternatives (kept for the record)
- Full FSRS scheduler in v1 — rejected: opaque to students, harder to explain to parents;
  multiplier dial captures most of the benefit at 1/10 the complexity.
- Gamified XP/levels — rejected: competes with streak semantics, risks hollow engagement;
  mastery bars carry the motivation instead.
