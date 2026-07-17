## 1. Artifact Calibration

- [x] 1.1 Map current hydration phases, in-flight guards, request sequence, source status, and last-good stores to the proposal/design/spec deltas.

## 2. Orchestration Verification

- [x] 2.1 Verify the active workspace hydrates first and related owner scopes do not block its ready milestone.
- [x] 2.2 Verify inactive workspace prewarm runs through bounded idle scheduling with no duplicate in-flight request.
- [x] 2.3 Verify stale/discarded results do not mark a workspace fully hydrated or overwrite a newer projection.
- [x] 2.4 Governance waiver: orchestration uses idle scheduling and request dedupe, while focused tests prove foreground priority; global frame responsiveness remains owned by the render-perf closure change.

## 3. Continuity Verification

- [x] 3.1 Verify partial Claude and Codex sources preserve only in-scope last-good rows and expose degraded state.
- [x] 3.2 Verify one degraded engine does not block another engine's healthy snapshot update.
- [x] 3.3 Verify authoritative archive/delete/hide/out-of-scope evidence removes continuity rows.

## 4. Evidence And Closure

- [x] 4.1 Focused hydration/catalog/continuity suite passed 4 files / 32 tests on 2026-07-18; exact command recorded in `verification.md`.
- [x] 4.2 Governance waiver: root-render performance is a shared platform invariant, not a distinct sidebar behavior requirement; retained under `harden-conversation-rendering-for-large-history`.
- [x] 4.3 `openspec validate --all --strict --no-interactive` passed 414/414 items on 2026-07-18; manual gate was waived as documented and the change is ready for sync/archive.
