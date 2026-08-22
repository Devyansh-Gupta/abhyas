# Abhyas — Onboarding v2 & Exam Mode Design
_2026-08-22 · Responds to owner brainstorm: mid-year joins, prior-marks baselines, preset review, electives, exam-season planning._

## 0. Research grounding (what the data says)

| Finding | Source | Design implication |
|---|---|---|
| CBSE 12 has **40+ subjects**; streams (Sci/Comm/Hum) each with compulsory + elective menus | CBSE scheme of studies; subject-code census | A preset cannot be one fixed list — it must be a **menu with defaults** |
| **Physical Education (616k) outnumbers most sciences**; Painting 74k, Home Sci 61k, Psychology 15k | CBSE candidate counts 2017 (latest public split) | Elective picker ordered by popularity; "popular" badge reduces choice anxiety |
| Percentage = **best of 5**, 6th subject is insurance/bonus | gradehunt, collegedunia | App can project best-5 % from entered marks — high-value, low-cost |
| Syllabus is **rationalised repeatedly** (cyclotron, logic gates, Communication Systems deleted; NCERT editions change) | CBSE circulars, Jagran Josh | Presets versioned per academic year; stable topic IDs survive renames/deletions |
| Schools finish syllabus at **different times** (Delhi DoE: English Core "by Sep 05") and teach in **different orders** | DoE termwise syllabi | "Where are you?" calibration is mandatory for mid-year joins, useful for everyone |
| Boards: **datesheet released late Oct, revised Dec 29**; papers spread over ~8 weeks with irregular gap days; practicals in Jan (Nov for winter-bound schools) | CBSE datesheet coverage | Exam entities need editable dates + gap-day planning; expect revisions mid-prep |
| **Class 10 boards now twice a year** (Feb + Apr/May, 2026 reform) | CBSE guidance sites | Board exam windows multiply; window-model (not single date) is the right primitive |
| School-year rhythm: UT-1 (May/Jly), mid-terms (Sep), UT-2 (Nov), **Pre-board-1 (Dec), Pre-board-2 (Jan)**, finals (Mar) | Sample school calendars | Exam templates can pre-fill typical windows per month |
| Competitors (ClosGrid, STiDY, Planora, Sylly) all solve cold-start via **syllabus paste/AI import**; Anki solves cramming via filtered decks | competitor scan | Confirms T2/T3 priority and exam-sprint mode as table stakes |

## 1. Core reframe: **the preset is a draft, not an installation**

Owner directive: *customizable everything, but simple enough that nobody abandons onboarding.*

Principle: **defaults first, edit anytime, never a wall of forms.**
- The preset loads pre-ticked and visibly editable — review is the flow, not an extra step.
- Hard budget: onboarding stays ≤7 screens; each new capability costs ≤1 screen and ≤2 taps.
- Everything reachable later: Subjects tab gains the same editor used at onboarding.

## 2. Onboarding v2 flow

```
1. Persona            (unchanged)
2. Board & class      (unchanged)
3. Stream             NEW · 11–12 only: Science / Commerce / Humanities / Vocational
                      (Class 9–10 skip: fixed subjects nationally)
4. Subject review     REWORKED · see 2.1
5. Progress check     NEW · "Where are you?" per subject — 1 tap each, skippable
6. Baseline marks     NEW · optional; seeds mastery from past scores
7. Exams              NEW · any upcoming exams? window or exact dates
8. Rhythm             school hours OR exam-season capacity (replaces hours step)
```

### 2.1 Subject review (screen 4) — answers "my school has a different subject"
- Compulsory subjects pre-ticked (languages per board rule: one of English/Hindi mandatory).
- Electives grouped by stream, **sorted by national popularity**, top-6 visible, "show all 40+" expander.
- Every chip: tap to toggle · long-press/left-swipe → remove · "+ Add subject not listed" free-text row.
- Live counter: "5 subjects · within CBSE limit ✓" (warn >6, block >8 with explanation).
- Renaming inline (tap name). Removing a preset subject is one tap with instant undo toast — no confirm modal.
- Elective flag recorded (`core | elective`) — drives later weighting and best-of-5 projection.

### 2.2 Progress check (screen 5) — answers "starting mid-semester"
Per subject, one question: **"How far through is school?"** → chips:
`Not started · Quarter · Half · Three-quarters · Finished`
- Smart default from today's date (session Apr→Mar): January ⇒ ~70% pre-selected. One tap to accept, one to change.
- Effect: covered chapters enter a **backlog pool** (eligible for gradual review scheduling, labelled "catching up"), NOT fabricated as mastered. Future chapters drive the forward plan immediately.
- Skippable per-screen ("Plan everything →") for September joiners.

### 2.3 Baseline marks (screen 6) — answers "submit marks from before I started"
- "Got recent scores? Enter them to calibrate your revision queue." Optional, skippable.
- Per subject: score % (+ optional exam name/date). Feeds the **existing** marks-recalibration engine (saveTest path): <40% drops boxes / flags due-now, ≥80% promotes. Revision queue starts realistic instead of empty.
- Marks tagged `baseline:true` → Progress charts draw a **baseline marker**; header shows "since baseline: +8%".

### 2.4 Exams (screen 7) — answers "there was no exam prompt"
Three entry paths, all valid:
1. **School exam** — name + month (window) · e.g. "Half-yearly · September"
2. **Board** — preset window auto-filled (Feb–Apr for XII; Feb & Apr–May for X post-reform), refine later
3. **Competitive** — nationally fixed dates prefilled (JEE Main Jan & Apr attempts, NEET May, CUET May–Jun)
Minimum viable input: **one exam + one month.** Exact dates optional, editable whenever datesheets drop.

## 3. Exam Season Mode

Toggle appears automatically when the nearest exam <45 days, manually anytime.

| Regular mode | Exam Season mode |
|---|---|
| Slots derived from timetable periods | Slots derived from **daily capacity slider** (h/day) + time-of-day preference |
| Forward : revision ≈ 60:40 | Shifts toward revision as D-day approaches |
| New-content scheduling unrestricted | **"Finish syllabus by" deadline** computed backwards from window start; past it, only revision + past papers |
| Streak rule normal | Unchanged (habit anchor during chaos) |

- **Gap-day engine**: with exact dates, rest days between Paper(n) and Paper(n+1) become full-day plans for Paper(n+1)'s subjects — the single highest-value exam feature (gaps are irregular: 0–6 days).
- **Window model**: exam = `{kind, subjectIds, windowStart, windowEnd?, exactDates?}`. Unknown dates → urgency from window midpoint; the day dates land, one edit re-solves everything (datesheet-revision-proof).
- **Post-paper**: subject auto-archives (topics exit rotation), streak survives, plan pivots to remaining papers.

## 4. Preset data: sourcing & freshness (owner Q: "where will latest data come from?")

- **Source of truth**: official curriculum volumes (released Mar–Apr for next session), datesheets (Oct–Dec), rationalisation circulars. Team-curated JSON per `board×class×academicYear`, semver'd.
- **Student syllabus = instantiated copy** with provenance: `{presetVersion, manualEdits[]}`. App updates NEVER mutate an active syllabus silently.
- **Year rollover**: non-blocking card "2026-27 syllabus available — see what changed"; diff view (added/removed/renamed via stable topic IDs); opt-in adoption.
- **Community correction**: "Wrong topic?" report on any topic → moderation queue → preset patch (feeds T4 sharing later).
- **Honest limit**: launch covers CBSE 9–12 + ICSE 9–10 + 2 major state boards + competitive foundations; long tail = T2 paste builder (now first-class via this flow) + T3 photo import.

## 5. Scope guards (anti-overload checklist)
- No question in v2 onboarding requires typing (except elective free-text and optional marks).
- Mid-year path adds exactly ONE screen (progress chips) + optional marks.
- Exam minimum = name + month. Everything else has a default.
- All editors reappear in Settings/Subjects — nothing is onboarding-only.
