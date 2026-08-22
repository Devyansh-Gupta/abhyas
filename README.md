# Abhyas (अभ्यास)

> The planner that knows what you're about to forget. Study companion for Indian students: derived daily plans, focus timer, spaced-revision engine, marks-driven mastery, parent visibility — Hevy-grade UX.

**Status**: P0 scaffold · engine green · docs in `/docs`

## Layout

| Path | What |
|---|---|
| `packages/engine` | Pure TS domain logic: SRS, planner, streaks, marks→mastery, rollover carry, TOC parser. Golden-tested. |
| `apps/mobile` | Expo app *(P1)* |
| `docs/` | PRD, onboarding-v2 design, infrastructure ADR, lifecycle audit |
| `prototype/` | Verified HTML prototypes (concept spec) |
| `tests/` | Prototype-era golden suites (kept for reference) |

## Commands

```bash
pnpm install
pnpm test        # all packages via turbo
pnpm typecheck
```

## Decisions that shape the code

- Learning-style dial multiplies SRS intervals (×0.7 / ×1.0 / ×1.4) — ADR §E2
- Day boundary = device timezone — decision #2
- Rollover carry ≤2 forward-work items; revisions never carried — decision #3
- Sync = op-log, latest-wins + revertible change log — decision #4
- Free tier covers ~70% of users fully; Pro ₹99/mo sells breadth only — decision #5
