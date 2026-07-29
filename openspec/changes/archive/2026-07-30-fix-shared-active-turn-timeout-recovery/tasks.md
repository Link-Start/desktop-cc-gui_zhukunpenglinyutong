## 1. Backend lifecycle

- [x] 1.1 [P0, depends: none] Remove the full-Turn deadline from exact Attempt settlement waiting and desktop/daemon Provider event forwarders; input is the existing coordinator owner/Notify path, output is event-driven terminal or owner-removal completion; verify with focused Rust coordinator tests and both Rust compile targets.
- [x] 1.2 [P0, depends: 1.1] Make `mark_recovery` preserve an accepted coordinator-owned Attempt and extend `recover_attempt(active)` with exact owner/frozen Target fields; verify with focused Shared V2 Rust tests.

## 2. Frontend reattachment

- [x] 2.1 [P0, depends: 1.2] Add a deduplicated exact-Attempt reattachment lifecycle; input is the typed active recovery envelope, output is restored Attempt/Target plus durable terminal convergence; verify with focused Vitest.
- [x] 2.2 [P0, depends: 2.1] Wire `SharedSendStatusBar Probe(active)` and restart restore to reattachment, then preserve active provenance across ambiguous observer errors; verify recovery UI and orchestrator regression tests.

## 3. Verification and closure

- [x] 3.1 [P1, depends: 1.1, 1.2, 2.1, 2.2] Run focused Rust/Vitest suites and targeted type/lint checks only; output is recorded incremental evidence with no full-suite execution.
- [x] 3.2 [P1, depends: 3.1] Review the complete diff for lifecycle, owner identity, error propagation, and staged-unrelated-change isolation; fix every correctness finding before commit.
- [x] 3.3 [P1, depends: 3.2] Verify OpenSpec and sync the `shared-send-pipeline` delta; output is an archive-ready change with all implementation evidence complete.
