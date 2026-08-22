# StudySync — Product Requirements Document (v1 Draft)
_Status: DRAFT for review · 2026-08-21 · Owner: Ayush Kumar · Prepared from TDPCL deck + market research (`research/`)_

---

## 1. One-liner

**StudySync is the study companion that plans your day, times your focus, tracks what you've mastered, and tells you what to revise before you forget it** — one app instead of the 4–6 students juggle today, with parents brought in as supporters, not surveillants.

## 2. Vision & positioning

- **Category**: personal academic operating system (planning + focus + retention + progress), NOT content delivery. We compete with fragmentation, not with Physics Wallah.
- **Wedge (the moat)**: the revision engine. No planner models memory; no SRS plans your day. StudySync connects them: *"the planner that knows what you're about to forget."*
- **Design bar**: Hevy — atomic logging (≤2 taps), routines-as-templates, progress made visible and celebrated, generous free tier, fast and offline-capable.
- **Trust posture**: transparent rule-based planning (no opaque ML), student-consented parent visibility, DPDP-2023 compliant by design.

## 3. Evidence base (summary)

| Finding | Source |
|---|---|
| Students juggle 4–6 disconnected apps; cognitive overhead | Deck (AISHE/IAMAI data) + confirmed landscape |
| Planners (MyStudyLife 10M+) schedule classes, not learning; its Family Connect already does parent schedule-visibility | mystudylife.com/tour |
| SRS apps (Anki/Quizlet) own retention but are disconnected from daily planning | Anki vs Quizlet comparisons |
| Timers (Forest 15M+) prove gamified consistency works, zero academic context | Deck + Forest stats |
| Self-learners crave ordered roadmaps + visible progress (NeetCode 1M+) | neetcode.io |
| Hevy's retention DNA: fast logging, templates, rings/streaks, friend feed, fair free tier | App Store/Play reviews, teardowns |

Full detail: `research/competitive-landscape.md`, gap analysis: `research/deck-gap-analysis.md`.

## 4. Goals

1. **G1** — A student can go from install → personalized daily study plan in **under 3 minutes**.
2. **G2** — Every study session is logged with ≤2 taps and rolls up into per-topic mastery.
3. **G3** — The app surfaces a daily revision queue driven by mastery decay, and the planner schedules it automatically.
4. **G4** — Marks/test results entered by the student map to topics, so mastery reflects reality, not vibes.
5. **G5** — A linked parent sees progress, the study plan, and test results — read-only, student-invited, respectful.
6. **G6** — Works offline (tier-2/3 reality); syncs when connected; feels instant (Hevy-bar performance).
7. **G7** — Ship v1 to real users (pilot) with activation/retention instrumentation.

## 5. Non-goals (v1)

- ❌ Content delivery: no video lectures, no marketplace, no tutoring/chat.
- ❌ iOS native build (design accommodates it later; Android + web only).
- ❌ Institutional/LMS integrations (Bolt-on later; manual setup first).
- ❌ Ads, data sale, or any child-directed tracking/advertising (DPDP hard line).
- ❌ Opaque AI scheduling — rules are inspectable; AI-assisted *input* (syllabus import) allowed later.
- ❌ Peer social feed (deferred to post-v1; designed-for, not built).

## 6. Users & modes

One engine, three experience modes (shared data model, different templates/vocabulary):

| Mode | Primary user | Planning shape | Parent role |
|---|---|---|---|
| **School Lite (Cl. 5–8)** | Younger student | Simple: subjects + daily plan + fun streaks | Strong (consent required, richer view) |
| **School Board (Cl. 9–12)** ⭐ beachhead | Board + entrance aspirant | Exam-date backward planning, syllabus coverage %, test series marks | Standard read-only |
| **Higher Ed (UG/PG)** | Degree student | Semester/credit rhythm, internal-mark weighting, self-directed electives | Optional light view |

⭐ **Beachhead rationale**: Class 9–12 has the sharpest pain (high-stakes exams, structured syllabi, engaged parents, existing marks cadence) and overlaps competitive-exam prep (JEE/NEET inherit the same engine). Modes 1 and 3 ship as templates after the core proves out. *(Open question Q1 below — confirm beachhead.)*

**Anti-persona**: professionals seeking corporate PM tools; content consumers wanting lectures.

## 7. The product loop (core concept)

```
   ┌────────────────────────────────────────────────┐
   │                                                │
   ▼                                                │
 PLAN ──► FOCUS ──► LOG ──► MASTERY ──► REVISE ─────┘
 (daily    (timer    (≤2     (topic      (queue feeds
  plan)     +topic)   taps)    levels)     tomorrow's plan)
   │                                        ▲
   └── TESTS/MARKS recalibrate mastery ─────┘
                    │
              PROGRESS (rings, streaks, trends — shared with parent)
```

Every feature must serve one of these loops. Anything that doesn't is out of v1.

## 8. Feature specification (MoSCoW)

### MUST have (v1 core)

| # | Feature | Acceptance criteria |
|---|---|---|
| M1 | **Onboarding wizard** | Mode select → class/board (or course/sem) → subjects from preset library **or quick-custom builder** (see §8b) → editable topic list → timetable quick-entry → **first plan generated**. Median completion < 3 min; niche-board path < 5 min. |
| M1a | **Subject review & electives** (_added 2026-08-22_, see `docs/design-onboarding-v2.md` §2.1) | Preset loads as a **pre-ticked editable draft**: compulsory subjects pre-selected, electives grouped by stream sorted by popularity, add/remove/rename inline with undo toast; "+ subject not listed" free-text; live count vs board limit. No preset path (state boards etc.) routes through the same editor via T2 paste — one review surface for all paths. |
| M1b | **Mid-year calibration** (_added 2026-08-22_, design §2.2) | Per subject: "How far has school reached?" chips (Not started…Finished) with date-smart default; skippable in one tap. Covered chapters become a labelled backlog pool (catching-up), never silently marked mastered. |
| M1c | **Baseline marks** (_added 2026-08-22_, design §2.3) | Optional: enter recent scores (+ exam name) per subject at onboarding; feeds the existing marks→mastery engine so the revision queue starts realistic; tagged `baseline:true`, Progress shows "since baseline" delta. |
| M1d | **Exams at onboarding** (_added 2026-08-22_, design §2.4) | Minimum input = exam name + month window; board windows prefilled from preset metadata; competitive dates (JEE/NEET/CUET) offered when relevant persona/board selected. Exact dates optional and editable later. |
| M14 | **Exam Season mode** (_added 2026-08-22_, design §3) | Auto-suggested <45 days before nearest exam window (manual toggle anytime): capacity slider replaces class-derived slots; finish-syllabus-by deadline computed backwards; gap-day plans between papers once exact dates entered; subjects auto-archive post-paper. Streak rules unchanged during exam season. |
| M2 | **Timetable** | Recurring weekly template per weekday + term dates + holiday pause; conflicts detected. **Day overrides** (one-off move/cancel/add) without touching the template; permanent edits regenerate future plans only — logged history immutable. Planner re-solves automatically on any change. |
| M3 | **Smart daily plan (rules-based)** | Generates tomorrow's plan nightly + on demand from: revision queue (top priority), upcoming exams/deadlines (weighted by proximity+weightage), weak topics (low mastery), timetable free slots, user energy preferences (morning/evening). Fully explainable: every plan item shows "why am I seeing this?" |
| M4 | **Focus timer** | Presets (25/50/90 + custom), bound to a topic, keeps running with screen off, logs session on completion; partial sessions loggable in 2 taps. |
| M5 | **Topic mastery** | Per-topic level derived from: session hours, self-rated confidence at session end (1-tap), quiz/test marks mapped to topic. Levels: New → Learning → Shaky → Solid → Mastered. Manual override allowed. |
| M6 | **Revision queue (SRS-lite)** | Topics resurface on a spaced schedule adjusted by mastery level + confidence + test performance. Queue visible, items auto-inserted into daily plan. Deterministic algorithm (documented intervals), tunable later. |
| M7 | **Tests & marks** | Student enters tests (unit/midterm/practice), marks per subject; optional topic mapping. Trend chart per subject. |
| M8 | **Progress dashboard** | Today ring (plan completion), streak calendar, per-subject mastery bars + trend arrows, weekly hours. Hevy-style celebration moments (streak milestones). |
| M9 | **Parent link** | Student generates invite code → parent account binds (verify relationship at signup for minors). Parent view: progress summary, current plan, marks history. Read-only. Student can pause sharing (visible to parent). |
| M10 | **Auth & roles** | Email/Google auth; roles: student, parent. Minors require verifiable parental consent at signup (DPDP §9). |
| M11 | **Offline-first storage + sync** | Local DB is source of truth; queued writes sync to cloud; last-write-wins per field with conflict surfacing on plan items. Airplane-mode session logging works fully. |
| M12 | **Notifications** | Plan-ready morning digest, session reminders, streak-save nudge. Quiet hours enforced (default 22:00–06:30). |

### SHOULD have (v1 if capacity allows, else v1.1)

- S1 Weekly review ("Your week": hours, adherence, weakest topic, next-week suggestion)
- S2 Assignments/homework with deadlines feeding the planner
- S3 Light/dark themes (dark default)
- S4 Syllabus import from image/PDF (AI-assisted input, human-confirms output)
- S5 Home-screen widget (today's next block)

### COULD have (post-v1 backlog)

- C1 Peer accountability: opt-in friend streaks/study rooms
- C2 Competitive-exam overlay (JEE/NEET test-series analytics, PYQ tagging)
- C3 Certification mode (exam-date templates for AWS/CA/UPSC-style prep)
- C4 Wearable/watch timer companion
- C5 Planner explanation tuning ("why" cards A/B)

### WON'T have (v1) — see §5.

## 8b. Content & syllabus strategy (_added 2026-08-21_)

**Principle: the syllabus is user-owned data; presets are accelerators, never gatekeepers.** The planner/SRS engine consumes any `{subject → topics (+ optional weights)}` list. No feature may require a canonical national-curriculum database to exist.

| Tier | Mechanism | Covers |
|---|---|---|
| **T1 Preset library** | Versioned JSON bundles (`cbse·class10·science@2026-27`), fetched on selection, cached offline (~KBs each). Launch set: CBSE 6–12 core subjects, ICSE 9–10, 2 state boards, JEE/NEET foundations. Always editable after load. | Mainstream 80% |
| **T2 Quick custom builder** | Type subjects; **paste the textbook's table-of-contents → auto-split into topics** (every textbook has an index page). | Niche boards / non-standard textbooks; target setup <5 min |
| **T3 AI-assisted import** | Photo/PDF of syllabus or date-sheet → draft topic tree → **student confirms before saving** (input accelerator, not authority). (= SHOULD item S4) | Scanned/printed syllabi |
| **T4 Community sharing** | Publish/import custom trees ("used by 3 students"), topic-names-only, lightly moderated. Long tail becomes self-populating over time. | Everything else, compounding |

Rules: (1) **We store topic names + structure + optional weights only — never textbook content** (copyright-safe, tiny payloads). (2) Presets are versioned per academic year; updates surface as diffs ("2 renamed, 1 added — apply?"); mastery history stays bound to stable topic IDs. (3) **UG/PG honesty**: course variety is unbounded — ship popular presets (common B.Tech/BCA/B.Com semester cores) plus T2/T4; full UG/PG templates land post-beachhead regardless.

## 9. UX blueprint (Hevy principles → StudySync)

**Design principles**
1. **Atomic actions**: any core action ≤2 taps from home (start session, log done, rate confidence).
2. **Templates over blank pages**: never show an empty planner; presets everywhere (syllabus, routine weeks like "School day", "Exam sprint").
3. **Progress is the product**: rings/bars/trends on every surface; celebrate streaks and mastery-ups with micro-animations.
4. **Calm density**: one primary action per screen; progressive disclosure for settings; teen-readable type scale; WCAG AA contrast.
5. **Speed budget**: cold start <2s mid-range Android (e.g., 4GB RAM class), 60fps scroll on main lists, tap→response <100ms, install <50MB.
6. **Explainability**: every auto-decision carries a "why" affordance.

**Navigation (mobile)**: Today (home) · Plan (week) · Subjects (topics+mastery) · Timer (center action) · Progress. Parent app/view: Progress · Plan · Marks (read-only).

**Key flows**
- *First run*: 3 questions → preset syllabus checklist → timetable sketch → "Here's your plan for today" (pre-filled, editable). Value shown before completeness demanded.
- *Study session*: Today → tap planned block → timer starts → end → confidence 1-tap → ring fills, mastery may tick up, next block suggested.
- *Test day*: enter marks → subjects trend updates → weak topics auto-flagged → revision queue grows → tomorrow's plan explains why.

## 10. Data model (logical sketch)

```
users(id, role: student|parent, name, class_band, board, consent*)
guardian_links(id, student_id, parent_id, status: invited|active|paused, consented_at)
terms(id, student_id, name, start_date, end_date, holidays[])
subjects(id, student_id, name, color, exam_weight, target_marks,
         kind: core|elective|additional,        -- elective flag (best-of-5 projection)
         origin: preset|custom|import|community)
topics(id, subject_id, parent_id/*syllabus tree*/, name, weight,
       mastery_level, confidence_last, ease, due_at, last_reviewed_at,
       coverage: unstarted|in_progress|covered,  -- mid-year calibration (M1b)
       backlog: bool,                            -- covered-but-not-yet-revised pool
       source_ref: preset_topic_id)              -- stable ID for year-rollover diffs
exams(id, student_id, name, kind: school|board|competitive,
      window_start, window_end?,                 -- window model; exact dates optional
      subject_ids[], datesheet_confirmed: bool)  -- gap-day planning when confirmed
class_sessions(id, student_id, subject_id, weekday, start_time, end_time, room)
study_sessions(id, student_id, topic_id, started_at, minutes, focus_rating,
               confidence_self, source: timer|manual)
plans(id, student_id, date, status)
plan_items(id, plan_id, topic_id, kind: revise|study|class|break,
           start_time, minutes, reason_code, done)
assessments(id, student_id, subject_id, name, date, max_marks, marks)
assessment_topics(id, assessment_id, topic_id, marks_obtained)  -- optional mapping
revisions(id, student_id, topic_id, due_at, interval, box_level)
preset_bundles(id, board, grade, subject, acad_year, version, json_url, downloads)
-- topics.source ∈ preset|custom|import|community  (+ preset_ref when applicable)
timetable_overrides(id, student_id, date, class_session_id, action: move|cancel|add,
                    new_start, new_end, reason)   -- day-level exceptions; template untouched
streaks(student_id, current, longest, last_active_date)
sync_log(device_id, entity, op, payload, applied_at)
```
*Rule-based planner and SRS intervals live in a shared TypeScript package (`@studysync/engine`) used by both apps; pure functions, unit-tested.*

## 11. Architecture direction

- **Client**: Expo / React Native — Android build now, web via Expo Router + react-native-web (single codebase, one language). Alternative considered: separate Next.js web + Expo mobile (more surface, duplicated logic) — rejected for team size.
- **Local-first**: SQLite on device (expo-sqlite/op-sqlite) as source of truth; thin sync worker → Supabase (Postgres + RLS + Auth + Storage). RLS policies: student owns rows; guardian_link grants read-only select on progress/plan/marks views. This reconciles the deck's offline-first claim with its Supabase choice.
- **Engine package**: planner + SRS as deterministic TS functions with golden tests; versioned so behavior changes are auditable.
- **Notifications**: Expo push (local scheduled first; server push post-pilot).
- **Perf practices**: FlashList for lists, Hermes engine, lazy routes, images/svg optimized, startup work deferred; perf CI gate on cold-start budget.

## 12. Success metrics (product, not feature-checklist)

| Metric | Target (pilot, 8 weeks) |
|---|---|
| Activation: install → first generated plan | ≥60% within 24h; median <3 min |
| Activation: first logged session | ≥50% day-1 |
| D7 retention | ≥35% |
| W4 retention | ≥20% |
| Plan adherence (done/planned) | ≥55% weekly median |
| Revision queue completion | ≥60% of due items |
| Parent links activated | ≥30% of minor accounts |
| Crash-free sessions | ≥99.5% |

## 13. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **DPDP §9 (children <18)**: verifiable parental consent required; no behavioural monitoring/targeted ads of children | HIGH | Consent flow at signup for minors; no ads ever; position streaks/mastery as user-facing tools (user's own data); formal legal review deferred until pre-public-launch (owner briefed 2026-08-21); parent-view framed as consented support |
| **Preset drift / wrong data** (_added 2026-08-22_): board changes syllabus mid-year, preset outdated, student's school differs from canonical list | MED-HIGH | Preset = editable draft (M1a) + provenance fields (subjects.origin, topics.source_ref) + year-versioned bundles with diffable rollover + community "wrong topic?" reporting; the app never claims authority over the student's actual school reality |
| **Exam dates uncertainty** (_added 2026-08-22_): datesheets released late Oct & revised Dec; Class 10 boards now twice-yearly | MED | Window-model exams (start month suffices), exact dates optional with one-tap re-solve when they land; gap-day engine activates only on confirmed datesheets |
| Scope breadth (3 modes at once) | HIGH | Beachhead Class 9–12; other modes are config templates, gated behind flags |
| Cold start abandonment | HIGH | Preset syllabus library; value-before-completeness onboarding (M1 criteria) |
| Sync conflicts / data loss | MED | Local-first with op log; LWW per field except plan_items (merge + surface); export-all button |
| Team capacity (5 students, semester timeline) | MED | MoSCoW discipline; SHOULD items pre-approved to drop; engine tested separately from UI |
| Syllabus coverage of niche boards/textbooks | MED | Tiered strategy (§8b): presets for the mainstream, paste-the-index builder for the long tail, community sharing compounds coverage; presets editable + versioned |
| MyStudyLife/ incumbents close the gap | LOW-MED | Speed: revision-engine wedge is architecturally hard for them; ship pilot fast |

## 14. Roadmap

| Phase | Duration | Outcome |
|---|---|---|
| **P0 Foundations** | ~2 wk | Monorepo (apps/mobile, apps/web, packages/engine, packages/db), auth, schema + RLS, CI, design tokens + component kit |
| **P1 Core loops** | 4–6 wk | M1–M8 on Android, engine v1 (planner rules + SRS-lite), **content tiers T1-seed (CBSE 9–12 core) + T2 custom builder**, internal dogfooding |
| **P2 Trust & sync** | 3–4 wk | M9–M12, offline sync hardening, parent view, polish pass against perf budgets |
| **P3 Soft validation** | 4+ wk | Team + friends/family real usage (no recruited cohort), metrics instrumented; faculty demo pack updated with observed data |
| **P4 Expand** | post-pilot | Higher-Ed + School-Lite templates, S-items, C-backlog grooming |

## 15. Decision record

**Accepted (user, 2026-08-21)**
- Audience: Class 5–12 and UG/PG (broader than deck's UG/PG-only scope).
- Platform: Web + Android.
- Revision/memory layer: core to v1.
- Parent visibility in v1: progress, study plan, marks/test results.

**Rejected alternatives**
- Web-only PWA (weak notifications/offline); Flutter (team JS/TS leverage); deferring SRS to v2 (removes the moat); deferring parent dashboard entirely (contradicts audience expansion).

**Resolved (2026-08-21, round 2)**
- **Q1 Beachhead**: ✅ Class 9–12 confirmed as first mode.
- **Q2 DPDP minor-consent**: owner briefed in plain language (§13 risk row); formal legal review deferred until pre-public-launch.
- **Q3 Name**: keep "StudySync" as working title. ⚠️ Collision found: McGraw Hill's "StudySync" is an established grades 6–12 ELA curriculum brand (US state contracts into 2026–2028, marketed internationally incl. India/MEA), plus same-named indie apps on both stores. Rename strongly advised before public launch — candidates in `research/design-language.md` appendix.
- **Q4 Pilot recruitment**: ❌ cancelled by owner. No recruited cohort; validation = team dogfooding + friends/family soft usage (§14 P3).

**Resolved (2026-08-21, round 3)**
- **Brand**: owner selected **Abhyas** as the app name (StudySync remains the faculty/TDPCL project title). Rename rollout tracked in the P0 branding pass.
- **Content strategy**: adopted tiered syllabus acquisition (§8b) — resolves niche-board / non-standard-textbook / UG-PG coverage questions.
- **Timetable change-handling**: weekly template + day-override model codified in M2 (§8); prototype Plan tab updated to demonstrate.

## 16. Verification shape (what "done" means for v1)

- All MUST features pass their acceptance criteria in §8, demonstrated on a mid-range Android device in airplane mode where applicable.
- Engine golden tests: given a fixture student (timetable, syllabus, marks, history), planner output matches expected plan; SRS intervals match documented table.
- RLS verified by adversarial queries (parent cannot read non-shared tables; paused link blocks reads).
- Perf budgets measured in CI on a reference device profile.
- Pilot instrumented: metrics in §12 flowing to a dashboard before recruitment starts.
