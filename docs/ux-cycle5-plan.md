# UX Overhaul — Cycle 5 Plan (user-driven, from real device use)

Source: user's hands-on session on MEmu + real MCA IA-1 timetable PDF.
This is the highest-value backlog yet: every item came from actual friction.

## User findings (observed)

### F1. Duplicate React key `📖` (BUG, console error)
Two subjects share the emoji id `📖`; React keys collide → children can be
dropped/duplicated. Root cause: v1 uses emoji as subjectId (known debt).
**Fix:** subject ids must be unique — slugified names or `sub-<n>` counters;
emoji stays only as display glyph in subjectMeta.

### F2. `[sqlite-repo] save failed: NativeDatabase.initSync NullPointerException` (BUG)
Save path crashes natively after the dev-client rebuild. Likely: adapter was
configured against the OLD native db handle before force-stop/reinstall, OR
concurrent save during hot-reload re-init. Needs repro + guard: catch at
adapter level, surface visible error, retry once after reopen.
**Fix:** defensive re-init + queue-while-unavailable; never lose the save silently
(F21/F24). Investigate initSync NPE specifically (drizzle expo driver).

### F3. "How far has school reached?" — bad copy/design (UX)
The question doesn't say WHAT it's asking (coverage? which term? pace?).
**Fix:** rewrite as "Where are your classes right now?" with concrete options:
"Just started the syllabus / About halfway / Nearly done revising / Finished —
revision mode". Subtext explains what it changes (how much new learning vs
revision the plan schedules).

### F4. Exam setup should accept a REAL timetable (feature)
User's IA-1 timetable PDF is the exact shape schools publish: day/date/session/
subject-code+name rows. **Fix:** exam step offers Manual entry OR photo/PDF
import (reuse OCR cascade); also addable later from Plan tab. Model: exams get
exactDates + per-day session/subject mapping.

### F5. Class timetable page missing from onboarding (feature)
User's own timetable attached. **Fix:** new onboarding step: add class schedule
manually (day + start/end + subject) or from image (OCR). The planner engine
already consumes class_sessions to mark busy time — wire it up end-to-end.

### F6. Daily study-hours preference (feature)
Ask during onboarding AND editable in settings; engine scales capacityMinutes.
(Engine already has style dial; this is a separate explicit hours knob.)

### F7. Dedicated Settings page (feature)
Everything changeable post-onboarding: board/class, subjects, daily hours,
time format 12/24h, exam season dial, notifications, data reset. New /settings
route + entry points from Progress header.

### F8. Per-subject syllabus upload during onboarding (optional feature)
Optional step: photo/text per subject → parser → topics. Reuses import flow.

### F9. Timer multi-topic attachment (feature)
Focus timer currently binds ONE topic. Fix: allow attaching multiple topics to
one session; minutes logged split across them (or tagged to all).

## Execution order (lanes)
- L1 (bugs first): F1 key collision + F2 sqlite NPE — correctness before features
- L2: F3 copy rewrite (trivial, immediate feel improvement)
- L3: F7 settings page skeleton + F6 daily-hours knob + time format toggle
- L4: F4 exam-timetable manual+photo import (uses MCA PDF as golden test case!)
- L5: F5 class timetable onboarding step + planner busy-time wiring
- L6: F9 timer multi-topic + F8 optional syllabus upload
Verification: Metro fast-path drive on MEmu after each lane; release APK at milestones.
