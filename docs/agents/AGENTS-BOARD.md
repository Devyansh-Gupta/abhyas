# Abhyas — Engineering Agent Board

_Specialized role briefs for multi-agent engineering runs. Each brief is
self-contained: paste it as a delegate_task goal/context with the task added.
Orchestrator (main session) assigns work, verifies evidence, merges._

## Standing roles

### 1. engine-builder — domain logic
Owns: `packages/engine/src/*`. Pure TS only, no RN/React imports.
Every behavior change ships with golden tests in `packages/engine/tests/`.
Verify: `pnpm exec turbo run typecheck test --filter=@abhyas/engine`.
Forbidden: changing public function signatures without updating all consumers.

### 2. app-builder — screens & store
Owns: `apps/mobile/app/**`, `apps/mobile/src/**`.
Zustand store actions wrap engine calls; no domain math in components.
Styling via NativeWind classes using @theme tokens in global.css only.
Verify: turbo mobile filter + web export + headless walk for touched screens.

### 3. data-layer — persistence & schema
Owns: `packages/db/**`, future `apps/mobile/src/repo/**`.
Drizzle migrations reviewed in PR; keep engine Topic ↔ db topics mapping 1:1.
Enable `enableChangeListener` for live queries; add metro asset-ext for .sql.
Verify: schema tests + kill-and-reopen manual proof for #8.

### 4. verifier — regression & walks
Runs the full gate, writes/executes headless walk scripts, reports PASS/FAIL
with observed output only. Never edits product code; may add tests.

### 5. docs-curator — documentation & presets
Owns: `docs/**`, `packages/presets/data/**`, README.
Keeps MASTER-PLAN.md table synced with closed issues in the same change.
Preset additions validate against preset.schema.json and cite CBSE source.

## Dispatch protocol
1. Orchestrator picks a task from MASTER-PLAN.md priority order.
2. Compose dispatch: role brief + task + acceptance criteria + "return observed
   evidence (commands run, outputs), not claims".
3. On return: orchestrator independently re-runs the full gate before merging.
4. Update board state here: prepared → dispatched → returned → verified → merged.

## Live board

| Task | Role | State | Evidence |
|---|---|---|---|
| #8 seam slice (adapter) | data-layer | ✅ verified+merged | commit `feat(#8 prep)`; orchestrator re-ran gate 10/10; CI green |
| CI lockfile sync | orchestrator | ✅ verified | run 32633534877 success |
| APK pipeline repair | orchestrator | ✅ verified | run 32638843560 SUCCESS (pnpm dedupe → icon path → hoisted linker → reanimated 4.5.3 → runner disk free) |
| #4 F29 onboarding walk | verifier | prepared | needs headless walk script |
| #8 SQLite repo layer | data-layer | prepared (seam ready) | wire expo-sqlite adapter via configurePersistence() |
| #7 Subjects/Progress tabs | app-builder | prepared | — |
