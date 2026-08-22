# Abhyas — Decision Proposals (awaiting owner)
_2026-08-21 overnight pass · Each has a working default so nothing here blocks implementation. Owner marks accept/reject in the morning._

## Owner verdicts (2026-08-22 session)
| # | Decision | Verdict |
|---|---|---|
| 2 | Streak day boundary | ✅ **Device timezone + device date/time** (not fixed 04:00 IST) |
| 3 | Midnight carry cap | ✅ **Carry max 2** confirmed |
| 4 | Sync conflicts | ✅ **Latest-wins + Recent-changes log, no popup** — refinement: student must be able to VIEW past changes AND revert/edit them later via Settings (activity log gets an undo affordance) |
| 5 | Free-tier fence | ✅ ₹99/mo + preset-count fence accepted *in principle* — owner wants MORE paid-tier value ideas; hard constraint: **free tier must stay generous enough for ~70% of users** |

## 5b. Paid-tier value menu (owner request 2026-08-22)
_Constraint: free tier covers the complete daily loop forever — fence only breadth/convenience/delight._

| # | Pro feature | Rationale | Cost driver |
|---|---|---|---|
| 1 | **Multiple concurrent syllabi** (school + JEE/NEET side-by-side) | Agreed core fence; Hevy-proven breadth model | — |
| 2 | **Analytics >90 days + pace projections** ("finish Organic Chem by Oct 12") | Depth of history costs storage; projections are high-perceived-value math | — |
| 3 | **AI import quota** — photo/PDF syllabus → draft tree (T3) | Solves #1 onboarding pain; real per-scan server cost justifies fence | ₹/scan (vision API) |
| 4 | **Home-screen widgets** (exam countdown, next block, streak) | Daily-retention driver; premium feel | — |
| 5 | **Beautiful PDF exports** — progress reports, print-ready revision sheets | Parents/teachers share moment; zero marginal cost | — |
| 6 | **Focus soundscapes** during timer | Delight layer, common in focus apps | — |
| 7 | **Unlimited streak freezes** (free = 2/month) | Forgiveness as premium; protects habit engine integrity | — |

**Recommendation**: ship Pro at launch with #1+#2+#7 (zero marginal cost, clean fence); #3 lands with T3 (v1.1); #4–6 opportunistic. Free tier keeps: unlimited subjects within ONE active preset, full planner+SRS+timer, parent view, 90-day history, 2 freezes/month.

| 1 | SRS intervals | ⏳ Awaiting plain-language re-explanation (original phrasing too jargon-y) |


## 1. SRS interval table
**Recommendation:** Fixed boxes `[1, 3, 7, 16, 35]` days; rating moves the box.
**Default mechanics:** Shaky → drop one box (min box 1) · Getting-there → stay · Solid → promote one box (max 5 = graduated). Due items capped at 5/day when planning; overflow rolls forward. Revision block length derives from box (`BOX_MIN=[15,20,30,40]`).
**Alternatives considered:** SM-2/Anki-style per-card ease factors (more optimal, opaque, hard to explain, harder to golden-test); Leitner pure fixed (no rating nuance).
**What breaks if wrong:** Too-aggressive intervals → queue floods, students batch-dismiss; too-slow → weak topics resurface too late before exams. Fixed tables are tunable constants — cheap to adjust after soft validation.
**Owner question:** Are the five interval values acceptable as v1 constants?

## 2. Streak semantics
**Recommendation:** A day counts when **≥1 planned block is completed OR ≥10 focus minutes logged**; two-stage miss forgiveness; rollover 04:00 local.
**Default mechanics:** Freeze tokens: 2/month, auto-applied on first missed day. Streak breaks only on 2 consecutive uncounted days (1 grace day). Rollover at 04:00 Asia/Kolkata for v1 (late-night sessions belong to the previous day).
**Alternatives considered:** Duolingo hard-reset (stronger loss aversion, harsher churn for exam students during unavoidable crunch weeks); any-study-counts (trivially gameable, dilutes meaning).
**What breaks if wrong:** Too strict → streaks die during exam weeks exactly when habit matters most; too loose → number stops meaning anything, loses motivational force.
**Owner question:** Is the 04:00 rollover acceptable, or should the day boundary follow device timezone from day one?

## 3. Undone-items-at-midnight policy
**Recommendation:** Carry over max 2 undone items (marked "carried", exam-linked items prioritised); drop the rest into the revision queue with an explanation chip next morning.
**Default mechanics:** Morning plan shows: "2 carried · 3 returned to revision — they'll resurface by their schedule." Nothing silently vanishes; nothing guilt-piles. **Revision-kind items are never carried** — the SRS already rescheduled them, so carrying would double-book; only forward-work blocks carry.
**Alternatives considered:** Carry-all (backlog snowballs, ring becomes permanently unclosable); drop-all (silent loss, erodes trust).
**What breaks if wrong:** Snowball → app starts every morning with debt, the #1 abandonment driver in planners. Silent loss → students stop trusting the plan.
**Owner question:** Is a 2-item carry cap the right default?

## 4. Timetable override merge (two offline devices)
**Recommendation:** Operation-based merge; conflicting moves resolve latest-timestamp-wins with the loser preserved in a visible activity log.
**Default mechanics:** Add/cancel/move ops commute safely (order doesn't change outcome). Same-period conflicting *moves* → newer timestamp wins; losing edit appears in "Recent changes" list, never deleted. Field-level LWW rejected because it can resurrect cancelled periods or drop adds entirely.
**Alternatives considered:** Field-level last-write-wins (simple, lossy); CRDT full merge (overkill for v1 scale).
**What breaks if wrong:** Silent data loss on sync → student's plan contradicts reality on one device; trust damage is disproportionate to edge-case frequency.
**Owner question:** Acceptable to ship latest-wins-with-log, or must conflicts always prompt the student to choose?

## 5. Free-tier fence (monetization)
**Recommendation:** Core loops free forever; Pro (~₹99/mo) sells *breadth*, never the daily loop.
**Default mechanics:** FREE = unlimited subjects/topics/timer/planner/revision for ONE active syllabus preset + parent view (always free). PRO = multiple concurrent presets (school + JEE/NEET side-by-side), analytics history beyond 90 days, custom themes.
**Alternatives considered:** Gating revision engine or planner behind paywall (kills retention apps — dead network effects); ads (DPDP-prohibited for minors, trust-destroying).
**What breaks if wrong:** Fence too tight → churn before habit forms; too loose → no revenue path for server costs. Breadth-fences are Hevy-proven: users upgrade when their life genuinely spans two syllabi.
**Owner question:** Confirm ₹99/mo price point and the preset-count fence for the faculty business-model slide?

## Checklist

| Proposal | Default ready? | Needs owner sign-off | Blocking implementation? |
|---|---|---|---|
| SRS intervals | ✅ [1,3,7,16,35] | Yes (values) | No |
| Streak semantics | ✅ OR-rule + freeze + 04:00 | Yes (rollover rule) | No |
| Midnight policy | ✅ carry-max-2 | Yes (cap value) | No |
| Override merge | ✅ op-merge + activity log | Yes (prompt-vs-auto) | No |
| Free-tier fence | ✅ breadth fence ₹99 | Yes (price/fence) | No |
