# Abhyas — Master Implementation Plan
_Single source of truth for what remains. Kanban mirror: GitHub Projects "Abhyas Roadmap". Update both when status changes._
_Repo: github.com/Devyansh-Gupta/abhyas · Docs: docs/PRD.md (scope), docs/design-onboarding-v2.md, docs/adr-infrastructure.md (stack decisions)_

## The product in one line
Derived daily study plans from the student's real timetable + a spaced-revision engine + marks-driven mastery — Android first (Expo), web preview, local-first with optional sync.

## Phase map

### PHASE 0 — Foundation ✅ DONE (P0, issues #1–3)
- Monorepo: pnpm + Turborepo · apps/mobile (Expo 57) · apps/web (Vite) · packages/{engine,db,presets}
- CI gate on every push: turbo typecheck + test (10 tasks, 50 assertions)
- Engine: SRS ladder, planner, streak break semantics, marks recalibration, carry policy, TOC parser — all golden-tested ports of the prototype
- DB: Drizzle SQLite schema (PRD §10 + v2 fields), integrity-tested

### PHASE 1 — Core loop usable on-device ← CURRENT (P1)
| # | Task | Status | Proof required to close |
|---|---|---|---|
| #4 | Onboarding v2 wizard | 🔄 code done; F29 fix verifying | Headless walk: persona→CBSE 10→subjects pre-ticked→coverage→style→Today seeded w/ preset topics |
| #8 | SQLite persistence (repo layer) | ⏳ | Kill app → reopen → state intact |
| #5✅ | Today screen + derived plan | ✅ | done |
| #6✅ | Focus timer + confidence sheet | ✅ | done |
| #7 | Subjects / Progress / Parent tabs | ⏳ | Bars move after rating; progress reflects sessionLog |
| — | Plan tab: week strip + timetable editor | ⏳ | Move/cancel period → plan re-solves |
| #9 | Exam Season mode + gap-day engine | ⏳ | Exam window → capacity slider → dated plan |

### PHASE 2 — Accounts & sync (P2)
- Supabase auth (Google + email OTP per ADR B2) · cloud mirror of local DB · op-log sync (latest-wins + revertible change log UI in Settings) · parent LINK flow (read-only view exists already)

### PHASE 3 — Acquisition & delight (P3)
- T3 AI import: ML Kit OCR on-device → Flash-Lite text cleanup → vision fallback (ADR E1 cascade)
- Preset library expansion beyond CBSE seed (ICSE/state boards; cron-assisted curation per ADR D2)
- Widgets (exam countdown, today ring), streak freezes UX, PDF export

### PHASE 4 — Polish & pilot (P4)
- Analytics opt-in events (ADR F2), empty-state polish, Hevy-level visual pass, Play Store internal track

## Definition of Done (every task)
1. Typecheck + full test suite green (`pnpm exec turbo run typecheck test`)
2. Behavior verified by execution — headless browser walk (web export) or unit test asserting the contract; screenshots only supplement, never substitute
3. Issue closed with comment linking the proof; kanban card moved
4. No silent defaults: every failure mode has visible feedback (F21/F24 rule)

## Verification toolchain (established)
- `pnpm exec expo export --platform web --output-dir ./dist` then `npx serve -sl 8085 ./dist` (the `-s` SPA flag is mandatory — routes 404 without it)
- Headless walks: `node e2e-*.cjs` via playwright-core + Helium Chromium (`C:/Program Files/imput/Helium`)
- Store logic: vitest against Zustand directly (no DOM needed)
