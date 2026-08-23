# Abhyas — Codebase Knowledge Graph

_Generated 2026-08-23 from direct file reads (not an indexed graph; regenerate after structural changes)._
_Purpose: navigation + impact analysis for engineering tasks. Each edge below was verified in source._

## 1. Package dependency graph

```
apps/mobile ──→ @abhyas/engine (workspace:*)
     │     └──→ @abhyas/presets (workspace:^)
     ├──→ zustand · nativewind@5-preview · expo-router 57
apps/web    ──→ @abhyas/engine
packages/db      (standalone: drizzle-orm/sqlite-core) ← NOT yet imported by any app
packages/presets → @abhyas/engine (types only, in topicsFromPreset)
packages/engine  (leaf — no workspace deps)
```

**Key structural fact:** `packages/db` has zero consumers. Issue #8 will create the first
app↔db edge; nothing else needs to change for it to slot in.

## 2. Engine module map (`packages/engine/src/`)

| Module | Exports | Consumed by | Tests |
|---|---|---|---|
| `types.ts` | Topic, Exam, PlanItem, LearningStyle, StreakState, DayActivity | everything | — |
| `srs.ts` | `applyRating(state, rating, style)` — box ladder [1,3,7,16,35]×style multiplier | store.rateTopic, store.finishFocus | srs.test |
| `planner.ts` | `buildDayPlan(topics, exams, dayOffset, {excludeTopicIds})` | store.advanceDay, web Today | planner.test |
| `streak.ts` | `initialStreak()`, `bumpToday(streak, activity)` | store.logSession/finishFocus | streak.test |
| `rollover.ts` | `computeCarry(plan, done)` → ≤2 forward, revisions dropped; `rollover(streak, activity)` | store.advanceDay | marks-rollover-toc.test |
| `marks.ts` | `recalibrate(...)` — marks→mastery weight adjustment | onboarding.tsx (deep import ⚠) | marks-rollover-toc.test |
| `toc.ts` | TOC text parser | prototype lineage; future OCR import | toc test |
| `onboarding.ts` | `initOnboarding`, `reduce`, `canAdvance`, `screenFor`, `stepCount`, MAX_SUBJECTS | onboarding.tsx (**deep import ⚠**) | onboarding.test |

⚠ = imports bypass the barrel via `@abhyas/engine/src/<mod>`; works but couples app to internal layout.
Fix is additive: export both modules from `index.ts`.

## 3. App store wiring (`apps/mobile/src/store.ts`, Zustand)

```
checkItem(uid) ─────────────→ logSession(topicId, durationMin)
logSession ────→ sessions[] append · streak.bumpToday
rateTopic(uid, r) → srs.applyRating (rev items only) + fixed 25-min session entry
finishFocus({topicId, minutes, rating?}) → sessions append · bumpToday · optional applyRating
addExam(exam) ───────────────→ exams[]
advanceDay() ──→ computeCarry → rollover(streak) → buildDayPlan(tomorrow, minus carried)
                 → returns {carried, droppedRevisions, droppedForward, broke}
```

State shape: topics / exams / sessions / plan / doneUids(Set) / dayIndex / learningStyle / streak.
**Persistence: none — memory only until #8.**

## 4. Screen map (`apps/mobile/app/`)

| Route | Status | Reads/Writes |
|---|---|---|
| `_layout` | done | theme only (#0E1116/#151B23/#8B7CF6 tokens mirror global.css @theme) |
| `onboarding` | #4 F29 verifying | engine.onboarding state machine · presets.topicsFromPreset · marks.recalibrate |
| `(tabs)/index` (Today) | ✅ #5 closed | store.plan, checkItem, rateTopic |
| `(tabs)/focus` | ✅ #6 closed | store.finishFocus |
| `(tabs)/plan·progress·subjects` | placeholders (#7 open) | — |
| Parent view | schema-ready (guardian_links), no UI | — |

## 5. Data model (`packages/db/src/schema.ts`) — 9 tables

users · guardian_links · subjects · topics · exams · class_sessions · study_sessions ·
plan_items · sync_log

Invariants encoded in schema comments: emoji-as-subject-id (v1 parity), plan_items.uid =
`t_<topicId>` stable across re-solves (F21), sync_log = op-log for latest-wins + revertible
change log (decision #4).

Engine `Topic` ↔ db `topics`: same field names (box, dueIn, coverage, backlog) — #8 mapping should be near-1:1.

## 6. Content pipeline (`packages/presets/`)

3 CBSE seed bundles (10-science, 10-maths, 12-physics) → JSON validated by preset.schema.json
→ `presetsFor(board, cls)` → `topicsFromPreset(preset, coverage)` → engine Topic[] at onboarding
completion. Expansion path (ADR D2): more bundles are data-only PRs; loader untouched.

## 7. Verification surfaces

- `pnpm exec turbo run typecheck test` — 10 tasks, the CI gate
- Headless walk: expo export web → `npx serve -sl 8085 dist` → playwright-core scripts (Helium Chromium)
- Store logic: vitest against Zustand directly (no DOM)

## 8. Change-impact cheatsheet

| Touching… | Also affects | Must keep green |
|---|---|---|
| engine/srs intervals or dial | planner spacing, onboarding screen 6b copy, golden tests | srs/planner tests |
| store action signatures | all tabs + store.test + headless walks | turbo suite + web export walk |
| schema.ts (db) | future migrations; keep engine Topic fields aligned | schema.test |
| global.css @theme | every styled component; _layout navTheme duplicates tokens | visual smoke (web export) |
| onboarding state machine | wizard UI + tests | onboarding.test |
