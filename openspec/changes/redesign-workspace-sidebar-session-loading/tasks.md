## 1. Artifact Calibration

- [ ] 1.1 Map current hydration phases, in-flight guards, request sequence, source status, and last-good stores to the proposal/design/spec deltas.

## 2. Orchestration Verification

- [ ] 2.1 Verify the active workspace hydrates first and related owner scopes do not block its ready milestone.
- [ ] 2.2 Verify inactive workspace prewarm runs through bounded idle scheduling with no duplicate in-flight request.
- [ ] 2.3 Verify stale/discarded results do not mark a workspace fully hydrated or overwrite a newer projection.
- [ ] 2.4 Verify foreground thread switching and visible rows remain responsive during background hydration.

## 3. Continuity Verification

- [ ] 3.1 Verify partial Claude and Codex sources preserve only in-scope last-good rows and expose degraded state.
- [ ] 3.2 Verify one degraded engine does not block another engine's healthy snapshot update.
- [ ] 3.3 Verify authoritative archive/delete/hide/out-of-scope evidence removes continuity rows.

## 4. Evidence And Closure

- [ ] 4.1 Run focused hydration, thread action, sidebar, and catalog tests; record exact commands/results in `verification.md`.
- [ ] 4.2 Capture a startup/large-history manual trace confirming no root render storm or foreground interaction regression.
- [ ] 4.3 Run strict OpenSpec validation and archive only after human acceptance.

