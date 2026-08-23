# Abhyas — Architecture & Infrastructure Decision Record
_2026-08-22 · Questions that must be answered (or defaulted) before P0 scaffolding. Each has a recommendation + default so nothing blocks._

## Owner verdicts (2026-08-22, session 2)
| Q | Verdict |
|---|---|
| Preset curator | ✅ **No teammates — I (ox-alpha) am the team.** Recurring curation job + owner reviews diffs in-app |
| Login methods | ✅ **Google + email OTP** |
| Analytics | ✅ **Compulsory** analytics during pilot (privacy-respecting: aggregate events, no content, no ads; disclosed in onboarding) — supersedes F3 default of opt-in-only |
| SRS customization | ✅ Keep fixed [1,3,7,16,35] as base **+ simplified learning-style dial at onboarding & Settings** (see E2) |
| DPDP consent flow | ✅ **Dropped for now** — no parental-consent gating at signup; revisit before public launch / any store listing targeting minors. Privacy posture retained: local-first data, export/delete self-serve, no ads ever |

## How to read this
Every question: **Context → Options → Recommendation → Owner question.** Defaults are safe to build with; changing later is possible but costs rework, so early answers are cheap and late answers are expensive.

---

## A. Repository & tooling

### A1. Monorepo layout & package manager
- **Context**: PRD §11 commits to Expo + shared TS engine. Need concrete structure before first commit.
- **Options**: (a) single Expo app with `src/engine/` folder; (b) pnpm workspaces + Turborepo: `apps/mobile`, `apps/web`, `packages/engine`, `packages/db`, `packages/ui`; (c) Nx.
- **Recommendation**: **(b) pnpm + Turborepo**. Engine must be importable by web + mobile + tests identically; Turborepo caches test/typecheck runs; Nx is overkill for 2 apps.
- **Default if unanswered**: (b).
- **Owner Q**: OK to standardise on pnpm workspaces + Turborepo?

### A2. TypeScript strictness & lint baseline
- **Recommendation**: TS `strict: true` from day 1; ESLint (typescript-eslint) + Prettier; pre-commit via husky+lint-staged. Retro-fitting strictness costs more than starting strict.
- **Default**: strict, enforced in CI.

### A3. Testing stack
- **Context**: prototype already proved the pattern — golden tests over pure functions (51 assertions today).
- **Recommendation**: **Vitest** for engine/db packages (fast, workspace-native); Testing Library for React components; Detox/Maestro E2E deferred to v1.1 (manual checklist until then).
- **Default**: Vitest everywhere; golden tests ported from `tests/*.test.js` as first CI job.

## B. Data layer

### B1. Local database
- **Options**: expo-sqlite (official, simpler) vs op-sqlite (faster, more setup) vs WatermelonDB (framework, heavier).
- **Recommendation**: **expo-sqlite + Drizzle ORM** (typed schema, migrations). Volume is small (one student's data); simplicity wins. op-sqlite revisit only if profiling demands.
- **Default**: expo-sqlite + Drizzle.
- **Owner Q**: none needed unless you object.

### B2. Cloud & auth
- **Recommendation**: **Supabase** (Postgres + Auth + RLS + Edge Functions + Storage) as PRD §11 states. Auth methods at launch: **Google + email OTP** (both DPDP-friendly, low-friction for students). Phone-number auth deferred (costs + AADHAAR-adjacent sensitivity).
- **Owner Q**: Google + email OTP acceptable as the only login methods at launch?

### B3. Sync engine
- **Context**: decision #4 locked latest-wins-per-op + visible revertable change log.
- **Options**: hand-rolled op-log sync (full control, more work) vs PowerSync/ElectricSQL (off-the-shelf, less control over conflict UX).
- **Recommendation**: **hand-rolled op-log** (v1): `sync_log` table already in schema; ops commute except same-entity moves (latest-timestamp-wins + change-log entry, per decision #4). Revisit PowerSync at scale. The Settings "Recent changes" screen (owner refinement) reads the same op log — one source of truth.
- **Default**: hand-rolled.

### B4. Schema ownership & migrations
- **Recommendation**: Drizzle migrations in `packages/db`; every migration reviewed in PRs; seed script ships demo data for dev. Cloud schema via `supabase db push` from the same repo.

## C. App platform

### C1. Navigation & structure
- **Recommendation**: Expo Router (file-based). Tabs: Today / Plan / Focus / Subjects / Progress (+ Settings stack). Parent view = separate stack gated by role. Matches prototype IA 1:1.

### C2. State management
- **Options**: Redux Toolkit / Zustand / Jotai / React Query only.
- **Recommendation**: **Zustand** for app state + **TanStack Query** for server state. Minimal boilerplate, works fine with local-first (DB is source of truth; stores are projections).
- **Default**: Zustand + TanStack Query.

### C3. Styling system
- **Options**: NativeWind (Tailwind) / Tamagui / plain StyleSheet + theme tokens.
- **Recommendation**: **NativeWind v4** — the "Expressive Clarity" design language maps cleanly to Tailwind tokens; fast iteration; big community. Dark-first per design doc.
- **Owner Q**: any styling preference? (default NativeWind)

### C4. Web app scope at launch
- **Context**: PRD says Android now + web via react-native-web.
- **Options**: (a) ship web simultaneously; (b) mobile-first, web skeleton (login + read-only Today) at launch, full web v1.1.
- **Recommendation**: **(b)** — one codebase makes (a) tempting, but exam-season features (gap-day plans) are phone-native behaviors; web full parity can trail without hurting the beachhead (students are phone-first).
- **Default**: (b).

## D. Content pipeline (presets)

### D1. Preset authoring & hosting
- **Recommendation**: presets are **static versioned JSON in a git repo** (`packages/presets/`), shipped inside the app bundle for launch set + fetched updates from Supabase Storage. No CMS needed until T4 community scale. Authoring = PRs with a JSON-schema CI check.
- **RESOLVED (owner 2026-08-22)**: no human team exists — the agent is the team.

### D2. Preset freshness ops — RESOLVED as automation
- **Design**: two-layer curation:
  1. **Recurring agent job** (Hermes cron, ~weekly during session; monthly off-season): checks CBSE academic circulars page, datesheet announcements, rationalisation news → drafts diff proposals against `packages/presets/` JSON → opens a "preset update PR" with a human-readable change summary.
  2. **Owner review in-app**: the PR surfaces in a simple review queue (or the owner merges via git); app ships the update behind a versioned bundle + "what changed" card.
- **Cost**: zero marginal (agent time). **Failure mode**: stale presets between checks — mitigated by community "wrong topic?" reports (design doc §4) and the fact that every preset is student-editable anyway.
- **Escalation rule**: if the agent job detects a datesheet/rationalisation event it can't confidently parse, it notifies the owner instead of drafting.

## E. AI import (T3), SRS dial & paid tier
- **Context**: decision #5 accepted ₹99/mo breadth fence; AI import flagged as strongest Pro value (per-use server cost).

### E1. Syllabus photo/PDF extraction — RESOLVED with research (2026-08-22)
Owner directive: cheapest high-quality path; open-source or non-AI OCR welcome if better.
**Research findings (July 2026 pricing/accuracy):**
- **ML Kit on-device OCR: FREE, unlimited, offline**, production-grade, supports Devanagari + Latin — but returns raw text blocks only (no layout understanding)
- **Gemini 2.5 Flash-Lite vision: ~$0.27 per 1,000 pages** (258 tokens/page) — cheapest cloud reading layer by ~15× vs Mistral OCR ($4/1k); handles layout natively; free tier exists but data-used-for-training caveat
- Tesseract: free but accuracy collapses on real photos (skew, lighting); needs heavy preprocessing ownership

**DECISION — hybrid pipeline (cheapest-first cascade):**
1. **On-device ML Kit OCR first** (free): extract raw text from the photo
2. **Text cleanup via Gemini Flash-Lite text-mode** (~negligible cost — cleaning tokens is far cheaper than vision tokens): structure the raw lines into `{subject → topics[]}` JSON
3. **Vision fallback** (Gemini Flash-Lite vision) ONLY if step 1 yields too little text (blurry/garbled photo)
4. Student confirms draft before saving (PRD T3 rule, unchanged)

Cost profile: typical usage ≈ free (steps 1–2 pennies at scale). Pro quota framing shifts from "AI is expensive" to "generous free scans (e.g. 10/mo) + unlimited Pro" — stronger selling point than originally assumed.
- **RESOLVED**: DPDP consent flow dropped for now (owner verdict table above) — signup has no parental gate; privacy posture unchanged.

### E2. Learning-style dial for SRS — RESOLVED as design
- Owner: keep [1,3,7,16,35] base + simplified customization "based on learning ability."
- **Research**: FSRS's single most impactful user setting is **desired retention** (0.70–0.97; 90% default) — higher = shorter intervals/more reviews. One number captures "learning ability" honestly.
- **DESIGN — one question at onboarding (screen 6b), editable in Settings:**
  > *"How well do you remember what you study?"*
  `I forget fast — remind me sooner` · `About average` · `I remember well — less repetition`
- **Mechanics**: maps to a global **retention multiplier** applied to every INTERVALS value: Fast-forgetter ×0.7 → [1,2,5,11,25] · Average ×1.0 → [1,3,7,16,35] · Strong memory ×1.4 → [1,4,10,22,49]. One constant, golden-testable, explainable ("your reminders come ~30% sooner"). Per-subject override deferred to v1.1.
- The dial also nudges plan weighting (fast-forgetters get slightly more revision slots/day) — same constant reused.

## F. Compliance & trust — UPDATED by owner verdicts (2026-08-22)
- **F1 DPDP consent**: ✅ **DROPPED for now** — no parental-consent gating at signup. Privacy posture retained regardless: local-first data, self-serve export/delete, no ads, no content surveillance. Revisit before public store launch.
- **F2 Data export/delete**: self-serve export (JSON) + delete account in Settings from day 1. Default: yes (unchanged).
- **F3 Analytics**: ✅ **COMPULSORY during pilot** (owner verdict) — privacy-respecting implementation: aggregate events only (screen views, feature usage counts), never study content/notes/timer details; disclosed plainly in onboarding ("we collect anonymous usage stats to improve the app"); PostHog cloud or Supabase events table. No third-party ad SDKs ever.

## G. Release & ops
- **G1**: EAS Build (Expo) for Android APK/AAB; Play Console internal testing track for pilot. Default: yes.
- **G2**: Error tracking — Sentry free tier from day 1. Default: yes.
- **G3**: Environments — Supabase projects `dev` + `prod`; `main` branch → prod, PR previews → dev. Default: yes.

---

## Decision summary table

| # | Question | Verdict (2026-08-22) |
|---|---|---|
| A1 | pnpm + Turborepo monorepo | ✅ Default accepted |
| B1 | expo-sqlite + Drizzle | ✅ Default |
| B2 | Supabase; Google + email OTP | ✅ Confirmed by owner |
| B3 | Hand-rolled op-log sync + revertible change log | ✅ Confirmed earlier |
| C3 | NativeWind v4 | ✅ Default |
| C4 | Web = skeleton at launch | ✅ Default |
| D1/D2 | Presets in-repo; **agent cron job curates, owner reviews diffs** | ✅ Resolved — agent is the team |
| E1 | **Hybrid OCR**: ML Kit on-device → Flash-Lite text cleanup → vision fallback (~free at typical scale) | ✅ Resolved with research |
| E2 | **Learning-style dial**: 3-choice question → retention multiplier [×0.7 / ×1.0 / ×1.4] on INTERVALS | ✅ Resolved as design |
| F1 | DPDP consent flow | ✅ **Dropped for now** (revisit pre-store-launch) |
| F3 | Analytics | ✅ **Compulsory during pilot**, aggregate-only, disclosed |
| H1 | Backend cost posture: Supabase Free (2 projects incl. dev+prod split via one project + local dev) → Pro $25/mo only when real users land; spend-cap ON; Edge Functions for the rare vision fallback; no always-on compute beyond DB | ✅ Cheap-to-scale posture confirmed |

**All questions resolved or defaulted. P0 is unblocked.**

---

# Upstream review — 2026-08-23

External validation of every major decision against current official/upstream guidance
(Expo changelog, NativeWind docs, Drizzle/expo-sqlite guides, local-first sync practitioner
write-ups). Full evidence trail in session transcript; summary below.

## Verdict table

| Decision | Verdict | Evidence basis |
|---|---|---|
| Expo SDK 57 + RN 0.86.2 | ✅ Current | Official Expo changelog: SDK 57 (Jun 2026) = RN 0.86, React 19.2, non-breaking release; ≥57.0.9 fixes Hermes V1 memory regression affecting reanimated/worklets apps — our pin is safe |
| pnpm + Turborepo monorepo | ✅ Optimal for shape | Shared pure-TS engine tested identically across apps is the canonical use case; Nx overkill at 2 apps (ADR A1 reasoning confirmed) |
| expo-sqlite + Drizzle (#8) | ✅ Consensus default | 2026 local-first RN guides converge on this pair; enable `enableChangeListener` for reactive live queries; **gotcha**: Metro can't import Drizzle's `.sql` migrations without a metro.config asset-ext entry |
| Hand-rolled op-log sync vs PowerSync/ElectricSQL | ✅ Right at our scale — highest-risk area | Solo-dev practitioners with single-user data report record-level LWW suffices and sync libraries add unwanted server infra; but hand-rolled sync is where offline apps fail silently — see hard requirements below |
| Zustand (+ TanStack Query per C2) | ⚠️ Gap: TanStack Query not installed | Documented pattern post-#8: SQLite = truth via live queries; store shrinks to ephemeral state. Decide before #8 whether store becomes a projection or is dissolved |
| NativeWind v4 / Tailwind 3 | ⚠️ One major behind | v5 shipped (Tailwind v4 engine; requires RN 0.81+ ✓); migration reported mostly compatible. Scheduled for early migration — see follow-ups |
| Supabase free→vertical-scale posture | ✅ Matches best practice | No microservices/K8s until metrics demand; Google+email OTP low-friction defaults |

## Hard requirements added to sync work (P2 gate)

Practitioner consensus on what hand-rolled sync must have to be trustworthy:

1. **Idempotent ops** — retries after network failure must never double-apply (`op_id` keyed)
2. **Compaction** — create→update before first sync merges into a single create op
3. **Two-device convergence test** — simulated devices A/B interleave writes, both must converge identical
4. **Backfill on sync-enable** — records created while sync was off must queue on first enable

## Follow-ups recorded

- ✅ DONE 2026-08-23: NativeWind v4 → v5-preview migrated (commit 27f848c); Metro import must be 'nativewind/metro' subpath
- Install @tanstack/react-query when #8 lands; define store-as-projection boundary then
- ESLint/Prettier/husky (A2) still absent — either schedule or mark deferred in ADR to keep doc trustworthy
- pnpm linker: `.npmrc node-linker=hoisted` is correct for pnpm 9.x and validated by Expo monorepo guide (SDK 54+ supports isolated, but RN native libs still break it); when upgrading to pnpm ≥10, the setting moves to `nodeLinker: hoisted` inside pnpm-workspace.yaml. Escape hatch to restore strict isolation later: rnx-kit/metro-resolver-symlinks
- Gradle CI caching: gradle/actions/setup-gradle@v4 added (official mechanism); cold builds ~35 min, warm-cache target ~8-12 min. APK builds are workflow_dispatch-only — pushes rely on the fast turbo CI gate instead

---

# RESOLVED — Owner rulings 2026-08-22 (session 2)

## R1. Preset curator → **agent watchdog + owner approval**
Owner ruling: *"There's no teammates, you are my teammate. Maybe have a cron job to update/curate the presets?"*
- **Design**: a scheduled Hermes job (`preset-watchdog`, created this session, monthly) monitors official sources — CBSE curriculum volume page, datesheet notices, rationalisation circulars — and reports ONLY deltas into this chat, with a proposed preset action per delta. Judgment stays with owner (one-word reply applies/rejects); the agent does the watching, diffing and drafting.
- **Honest limit**: a cron cannot reliably interpret a brand-new policy's implications — it flags and drafts, never silently rewrites presets. Preset JSON changes ship as git PRs authored by the agent, approved by owner.
- Sources watched (from design doc §4): cbseacademic.nic.in curriculum pages, cbse.gov.in datesheet notices, NCERT rationalisation coverage.

## R2. Login methods → **Google + email OTP confirmed**

## R3. Analytics → **compulsory, engineered to stay lawful**
Owner ruling: *"Have compulsory analytics."*
- Implemented as **mandatory, privacy-minimal telemetry**: crash reports + coarse feature events (screen views, funnel steps), **no PII, no content, no marks**, random device-scoped ID, no third-party ad SDKs ever. Disclosed in one plain sentence in Settings ("We collect anonymous usage stats to fix bugs and improve planning").
- **Risk recorded (not blocking)**: DPDP §9 imposes extra duties for minors' data; compulsory analytics is defensible for aggregate/no-PII product metrics but must be revisited before any public launch — same trigger as the deferred consent flow below. Pilot-phase risk accepted by owner.
- Stack: PostHog (cloud EU) or self-host later; event taxonomy lives in `packages/db/analytics.md`.

## R4. DPDP consent flow → **deferred past pilot (owner call)**
Owner ruling: *"Don't have DPDP consent for now."*
- Consent UI/flow removed from v1 scope; schema keeps `users.consent*` columns so activation later is additive, not a migration.
- **Hard trigger recorded**: consent flow + parent-link age gate MUST land before public store release or any recruitment of unknown minors. Pilot = known/limited users only. This is now the top compliance debt, tracked in PRD risks.

## R5. Backend posture → **easy + cheap-to-scale confirmed**
Supabase free tier comfortably covers pilot (500 MB DB ≈ years of single-student rows; auth MAU far above need). Scale path is vertical-first (Supabase paid tiers) before any infra complexity. No Kubernetes, no microservices, no Redis until metrics demand.

## R6. AI/vision extraction → **on-device OCR first, LLM second, vision-LLM last**
Owner ruling: cheapest high-quality extraction; non-AI OCR welcome if it fits; beware knowledge-cutoff blindness to newer cheap models.
- **Tier V1 (default, FREE)**: **on-device OCR** (Google ML Kit Text Recognition v2 — free, offline, supports Latin + **Devanagari**, purpose-built for printed pages like textbook indexes). Output feeds our existing hardened TOC parser (`parseToc` lineage) → structured topics. **Zero marginal cost** for the canonical case.
- **Tier V2 (cheap assist)**: mini-class LLM cleanup pass (layout repair, two-column index merging, obvious junk filtering) behind Supabase Edge Function; still cheap (~fractions of a paisa-level per page class). Only invoked when V1 output looks malformed (heuristic: <2 topics detected on a dense image).
- **Tier V3 (Pro, fallback)**: vision-LLM direct scan for handwritten/messy photos. Provider deliberately abstracted behind `packages/engine/src/import/provider.ts` interface — model naming/pricing churn fast (knowledge-cutoff risk the owner flagged), so the *architecture* picks winners at implementation time with a benchmark script, not today.
- Free/Pro fence stays as decided: free gets generous V1+V2 quota; V3 counts against AI-import quota.

## R7. SRS intervals → **accepted, plus student-tunable learning profile**
Owner ruling: intervals fine; students should customise by learning ability, simply — maybe an assessment question at onboarding.
- **Design (goes to onboarding v2 §2.5)**: one-screen **Learning pace** picker with plain-language framing —
  - 🐢 *"I forget fast — remind me sooner"* → scale **×0.75** (intervals [1,2,5,12,26])
  - 🚶 *"About average"* → ×1.0 ([1,3,7,16,35])
  - 🐇 *"I remember well — space it out"* → ×1.25 ([1,4,9,20,44])
- Engine impact: `INTERVALS_BASE × profile.multiplier`, rounded; stored per-student; **adaptive nudge post-pilot**: after ≥30 rated reviews, if recall-rate >85% suggest stretching, <60% suggest tightening (one tap, never automatic).
- Golden tests extend: multiplier rounding boundaries + floor(1-day minimum).
- PRD: new acceptance row **M15 Learning pace**; onboarding budget unchanged (+1 screen, 1 tap).
