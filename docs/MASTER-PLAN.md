# Abhyas — Master Implementation Plan
_Single source of truth for what remains. Kanban mirror: GitHub Projects "Abhyas Roadmap". Update both when status changes._
_Repo: github.com/Devyansh-Gupta/abhyas · Docs: docs/PRD.md (scope), docs/CODEGRAPH.md (code map), docs/design-onboarding-v2.md, docs/adr-infrastructure.md (stack decisions + upstream review), docs/pedagogy.md (instructional design), docs/agents/AGENTS-BOARD.md (multi-agent roles)_

## The product in one line
Derived daily study plans from the student's real timetable + a spaced-revision engine + marks-driven mastery — Android first (Expo), web preview, local-first with optional sync.

## Status snapshot — 2026-08-23

| Area | State | Evidence |
|---|---|---|
| CI gate (`turbo typecheck+test`) | ✅ green, 10 tasks, 54 tests | runs 32633534877, 32638843561 |
| APK Build workflow | ✅ FIXED & GREEN — installable debug APK on every push | run 32638843560 success (was failing: pnpm conflict → icon ENOENT → pnpm isolation → reanimated/RN mismatch → runner disk) |
| Onboarding v2 wizard | 🔄 screenFor() state-machine refactor pushed; F29 walk pending | commit 34e043a |
| Persistence seam (#8 prep) | ✅ adapter interface + hydrate/persist merged, tested | commit `feat(#8 prep)`, 4 new tests |
| Styling | ✅ migrated NativeWind v4 → v5-preview (Tailwind v4 CSS-first); tokens verified in compiled CSS | commit 27f848c |
| Store scaffolding | ✅ dead code removed, behavior identical | commit 2ba63a7 |
| Architecture decisions | ✅ externally validated (upstream review appendix in ADR) | docs/adr-infrastructure.md |
| Code intelligence | ✅ docs/CODEGRAPH.md generated from source reads | this repo |

## Phase map

### PHASE 0 — Foundation ✅ DONE (P0, issues #1–3)
Monorepo · CI · engine golden tests · Drizzle schema. Details in git history.

### PHASE 1 — Core loop usable on-device ← CURRENT (P1)

Priority order below reflects dependency + risk (adapter seam BEFORE UI expansion):

| # | Task | Role | Status | Acceptance criteria (testable) | Verification command / method |
|---|---|---|---|---|---|
| #4 | Onboarding v2 wizard | app-builder + verifier | ✅ F29 walk 8/8 PASS | Headless walk completes persona→CBSE10→pre-ticked subjects→coverage→style→Today seeded with preset topics | expo export web → serve -sl 8085 → playwright walk script PASS (d7ae4b6: fixed empty Today handoff; e2e-onboarding.cjs reusable) |
| — | **Store persistence adapter seam** (prerequisite slice of #8) | data-layer | ✅ merged 0ae06b7 | `useApp` accepts injectable persistence; existing actions route through it; all current tests pass unchanged | turbo suite green + new seam unit test |
| #8 | SQLite persistence (repo layer) | data-layer | 🔄 code merged, on-device proof pending | Kill app → reopen → topics/plan/streak intact; Drizzle migrations run on device DB; live queries feed Today | schema tests + device kill/reopen manual proof + turbo green (9 repo tests in gate) |
| #7 | Subjects / Progress tabs (parent view → P2 link flow) | app-builder | ✅ b39775e | Bars render from store mastery; rating a topic moves its bar; Progress reflects sessionLog counts | headless walk asserting bar delta after rateTopic (gate green; mastery helper golden-tested) |
| — | Plan tab: week strip + timetable editor | app-builder | ✅ 46f581c | Move/cancel a period → derived plan re-solves within same frame | headless walk e2e-plan.cjs 8/8 PASS (free-time delta asserted); planner golden tests green |
| #9 | Exam Season mode + gap-day engine | engine-builder | ✅ b111fbb (engine slice; UI slider deferred) | Exam window input → capacity slider → dated revision plan respects gaps | new engine golden tests (examSeason.ts, gap-day boost/taper/capacity extremes) + UI smoke pending P1 exit pass |

**Exit criteria for P1:** a student can onboard, see a derived plan today AND tomorrow, focus-timer a session, watch mastery bars move, and lose nothing on app restart.

### PHASE 2 — Accounts & sync (P2)
- Supabase auth (Google + email OTP per ADR B2) · cloud mirror of local DB · op-log sync.
- **Hard requirements gate (from upstream review, non-negotiable):**
  1. Idempotent ops (retry-safe, op_id keyed)
  2. Create→update compaction before first push
  3. Two-simulated-device convergence test must exist and pass before any real sync ships
  4. Backfill queue on sync-enable for records made while sync off
- Parent LINK flow (read-only view exists already).

### PHASE 3 — Acquisition & delight (P3)
- T3 AI import: ML Kit OCR on-device → Flash-Lite text cleanup → vision fallback (ADR E1 cascade; provider abstracted behind `packages/engine/src/import/provider.ts`).
- Preset library expansion beyond CBSE seed (ICSE/state boards; agent cron-assisted curation per ADR D2/R1).
- Widgets (exam countdown, today ring), streak freezes UX, PDF export.

### PHASE 4 — Polish & pilot (P4)
- Analytics opt-in→pilot-compulsory events (ADR F2/R3, PostHog EU), empty-state polish, Hevy-level visual pass on v5 styling, Play Store internal track.
- **Pre-launch compliance debt (tracked, blocking store release):** DPDP consent flow + parent-link age gate (ADR R4).

## Definition of Done (every task)
1. Typecheck + full test suite green (`pnpm exec turbo run typecheck test`)
2. Behavior verified by execution — headless browser walk (web export) or unit test asserting the contract; screenshots only supplement, never substitute
3. Issue closed with comment linking the proof; kanban card moved; THIS file's table updated in same change
4. No silent defaults: every failure mode has visible feedback (F21/F24 rule)

## Verification toolchain (established)
- `pnpm exec expo export --platform web --output-dir ./dist` then `npx serve -sl 8085 ./dist` (the `-s` SPA flag is mandatory — routes 404 without it)
- Headless walks: `node e2e-onboarding.cjs`, `node e2e-plan.cjs` via playwright-core + Helium Chromium (`C:/Program Files/imput/Helium`)
- Store logic: vitest against Zustand directly (no DOM needed)

### Known limitation (follow-up): #8 persistence on web preview
SQLite hydration throws `SharedArrayBuffer is not defined` under plain `serve` (needs COOP/COEP cross-origin isolation headers) → falls back to empty-state boot by design (F21/F24 logged visibly). Android unaffected; walks assert UI logic, not persistence. If web-preview parity for #8 ever matters, serve with COOP/COEP headers (e.g. `npx serve --config` with headers, or a tiny Node static server setting `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`).
- Full gate: `pnpm exec turbo run typecheck test` (10 tasks) — CI-enforced

## Multi-agent operating model
Specialized roles (engine-builder, app-builder, data-layer, verifier, docs-curator)
with self-contained briefs live in `docs/agents/AGENTS-BOARD.md`. Dispatch protocol,
live board state, and evidence rules are maintained there. Orchestrator verifies
every returned result by re-running the gate before merge — agent claims are not evidence.

## Long-term arc (post-P4 sketch)
1. **Retention moat deepening** — adaptive nudge post-pilot (R7: recall-rate >85% suggest stretch, <60% tighten); FSRS-informed desired-retention dial refinement.
2. **Content flywheel** — community preset contributions with schema-CI + owner approval; wrong-topic report loop feeding curation cron.
3. **Parent surface maturity** — read-only weekly digest, pause visibility (guardian_links.status transitions already modeled).
4. **Exam-season excellence** — datesheet photo → exam window extraction (reuses T3 OCR cascade), automatic replan.
5. **Scale posture** — vertical Supabase scaling only; PowerSync revisit trigger = multi-device conflict reports > threshold or realtime parent view demand.
