# StudySync — Design Language Research & Decision
_2026-08-21 · Research basis: live sources (Google/Material, UX case studies, dark-mode guides, app teardowns). Companion artifact: `prototype/studysync-concept.html`._

## 1. The verdict

**Adopt "Expressive Clarity"**: **Material 3 Expressive** as the foundation (components, motion, accessibility), **Duolingo's motivation layer** (streaks, warm copy, celebration), and **Hevy's data-density discipline** (dark-first, rings, atomic actions) — tuned for a study context: calm enough for 90-minute focus, energetic enough to make a teen open it twice a day.

Why this stack and not something else:
- M3 Expressive is **research-backed** (Google's most-tested design update ever): expressive layouts made key actions findable **4× faster** in eye-tracking studies; 87% of 18–24s prefer expressive design. It ships accessible-by-default (tap targets, contrast).
- Duolingo proves **loss-aversion streaks + character warmth + chunked progression** retain students at 150M+ scale — the exact psychology StudySync needs for daily return.
- Hevy proves **dark-first, data-forward, ≤2-tap logging** feels premium to the exact user taste the owner admires.
- Dark-mode guides converge on: never pure black/white, desaturate accents on dark, elevation via surface lightness (not shadows), design dark first.

## 2. Source findings

### Material 3 Expressive (Google, 2025)
- **Expressive = hierarchy**: color, shape, size, motion, containment exist to *draw attention to what matters* (one primary action per screen).
- **Springy motion**: natural spring animations, shape-morphing elements, haptic-coupled feedback; motion communicates physics, not decoration.
- **Emphasized typography**: strong header/body contrast for faster parsing.
- **Dynamic color**: seed-color → tonal palettes; bold colors improve element separation.
- **Accessibility exceeds standards**: larger buttons (e.g., Send above keyboard found 4× faster), high-contrast containment.

### Duolingo (150M+ users)
- **Streaks = loss aversion**: the single strongest retention mechanic; protect-it-at-all-costs framing.
- **Clever, warm copy**: the product has a voice; errors feel kind, wins feel celebrated.
- **Chunked progression**: lessons are 2–3 minutes; progress bars always visible; "daily goal" ring.
- **Character/mascot warmth**: personality drives teen attachment (StudySync analog: subject icons + micro-copy voice, no mascot needed v1).
- **Friends quests**: social accountability lifts retention (deferred to C1, designed for).

### Hevy (4.8★, 1M+)
- Dark-first surfaces, cards with clear containment; **rings and bars are the emotional payload**.
- Logging is **atomic** (seconds, not forms); templates remove blank-page cost.
- Center-of-nav primary action; stats one tap away; celebration on PRs/streaks.

### Dark mode best practice (Toptal/atmos/eleken synthesis)
- Background ≈ #121212 with subtle blue tint; **elevation = lighter surface, not shadow**.
- **Desaturate** accent colors on dark (saturated hues vibrate/halate); avoid pure white text (use ~#E8ECF1).
- Design **dark first**, then light — don't invert.

## 3. StudySync tokens (v0.1 — implemented in the prototype)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0E1116` | App background (tinted near-black) |
| `--surface` | `#161B22` | Cards |
| `--surface-2` | `#1D242E` | Raised cards / sheets |
| `--border` | `#2A313C` | Hairlines, chip outlines |
| `--text` | `#E8ECF1` | Primary text (never pure white) |
| `--text-dim` | `#9AA4B2` | Secondary text |
| `--accent` | `#7C5CFC` | Primary action (electric violet) |
| `--done` | `#4ADE80` | Completed / mastery-up |
| `--due` | `#FBBF24` | Revision-due / attention |
| `--alert` | `#F87171` | Overdue / risk |
| Subject palette | `#60A5FA #34D399 #F472B6 #F59E0B #A78BFA` | Data-viz only (desaturate on dark) |
| Radius | 24 / 16 / 999 | Cards / inner / chips |
| Motion | spring `cubic-bezier(.34,1.56,.64,1)`, 250–400ms | All transitions; transform/opacity only (perf) |
| Type | Inter/Manrope-class geometric; tabular numerals for time/streaks | Display numerals oversized |
| Tap targets | ≥ 48px | M3E baseline |

**Voice**: kind coach, never surveillance. "DBT is getting rusty — 20 min today keeps it warm." Never "You failed your plan."

## 4. Naming appendix — collision report & candidates

**Finding**: "StudySync" is **taken and entrenched**: McGraw Hill's StudySync (grades 6–12 ELA curriculum; US state contracts into 2026–2028; marketed internationally including India/MEA; app on Play Store with 50K+ downloads by BookHeadEd Learning) plus multiple indie apps of the same name on both stores. Owner decision: keep as **working title only**; rename before any public launch.

| Candidate | Rationale | Risk |
|---|---|---|
| **Abhyas** | Sanskrit for deliberate, repeated practice — literally describes the SRS loop; culturally resonant, short, ownable | Check regional connotations |
| **StudySathi** | "Study companion" (Hindi) — matches parent-as-supporter positioning | Longer; two words |
| **Revisely** | Names the moat (revision engine) directly | .com likely taken; check |
| **LoopStudy / StudyLoop** | Names the core loop (Plan→Focus→Log→Mastery→Revise) | Generic-ish |
| **Recall** / **Recally** | Retention-first framing | Crowded space |

**Recommended shortlist to legally screen**: Abhyas, StudySathi, Revisely. (Working title stays StudySync until owner picks.)

## 5. What the prototype demonstrates
`prototype/studysync-concept.html` — interactive, single-file, offline: Today (plan + ring + revision queue), Plan (week + explainable "why"), Subjects (mastery tree), Timer (full loop → confidence → mastery update), Progress (rings, streak calendar, trends). Seeded Class 10 CBSE data. Every M3E/Duolingo/Hevy principle above is traceable in it.
