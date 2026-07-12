## 1. Artifact Calibration

- [ ] 1.1 Review proposal/design/spec delta against current sidebar and catalog implementation; record any already-satisfied clauses with file/test evidence.

## 2. Contract Verification

- [ ] 2.1 Verify first-page requests use a bounded limit and return stable continuation or explicit partial/degraded evidence.
- [ ] 2.2 Verify load-older preserves workspace scope, attribution mode, filters, ordering, and deduplication.
- [ ] 2.3 Verify late results from an older filter/query cannot replace the current projection.
- [ ] 2.4 Verify bounded absence does not erase last-good rows without authoritative removal evidence.

## 3. Tests And Evidence

- [ ] 3.1 Run focused frontend pagination/hydration tests and backend catalog tests; record exact commands and results in `verification.md`.
- [ ] 3.2 Run a large-history manual smoke test covering first paint, load older, filter change, and degraded source state.
- [ ] 3.3 Run strict OpenSpec validation and archive only after all evidence gates pass.

