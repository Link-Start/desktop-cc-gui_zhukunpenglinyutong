## 1. Artifact Calibration

- [x] 1.1 Review proposal/design/spec delta against current sidebar and catalog implementation; evidence recorded in `proposal.md` and `verification.md`.

## 2. Contract Verification

- [x] 2.1 Verify first-page requests use a bounded limit and return stable continuation or explicit partial/degraded evidence.
- [x] 2.2 Verify load-older preserves workspace scope, attribution mode, filters, ordering, and deduplication.
- [x] 2.3 Verify late results from an older filter/query cannot replace the current projection.
- [x] 2.4 Verify bounded absence does not erase last-good rows without authoritative removal evidence.

## 3. Tests And Evidence

- [x] 3.1 Focused frontend suite passed 4 files / 32 tests and Rust full suite passed on 2026-07-18; exact commands/results recorded in `verification.md`.
- [x] 3.2 Governance waiver: deterministic pagination/filter/stale/degraded tests cover this change's behavioral contract; global large-history frame performance remains owned by `harden-conversation-rendering-for-large-history`.
- [x] 3.3 `openspec validate --all --strict --no-interactive` passed 414/414 items on 2026-07-18; change is ready for sync/archive.
