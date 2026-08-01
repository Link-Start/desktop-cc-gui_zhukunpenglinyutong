## 1. Projection Contract

- [x] 1.1 [P0, depends: none] Add a focused failing regression test for `Shared A send → activate B before first delta → deliver A delta → reactivate A`; input is routed Shared events and active-thread changes, output is one visible assistant shell with latest live text, verified by focused Vitest assertions.
- [x] 1.2 [P0, depends: 1.1] Make first assistant shell establishment lifecycle-critical without changing subsequent delta transport; input is the first routed assistant delta, output is one reducer shell plus row-local channel growth, verified by reducer dispatch cardinality assertions.

## 2. Activation And Terminal Convergence

- [x] 2.1 [P0, depends: 1.2] Reconcile a running Shared thread when it becomes active without loading canonical history; input is processing state plus existing channel/shell state, output is an immediately consumable projection, verified by switch-away/switch-back assertions. Activation flushes only the target Shared thread's pending raw/normalized structural operations, while existing cold subscription consumes channel text.
- [x] 2.2 [P0, depends: 2.1] Cover terminal settlement while Shared is inactive; input is item/turn completion after streamed prefix, output is one complete assistant item with no duplicate final, verified by focused Vitest assertions.

## 3. Boundary Review

- [x] 3.1 [P1, depends: 2.2] Review the implementation for impact-boundary violations; output is confirmation that Rust execution, Shared owner binding, canonical history, scroll ownership and per-delta root dispatch remain unchanged, verified by diff-level code review. Alternate-angle review found and corrected global raw-queue flushing plus missing normalized snapshot activation coverage.
- [x] 3.2 [P1, depends: 3.1] Record validation status without committing; output is updated task evidence listing focused test/typecheck commands as run or intentionally not run, verified against the user's no-commit instruction. Initial pass deferred validation; follow-up evidence is recorded in task 4.3. `git commit` was not executed.

## 4. Shared-Only Residual Closure

- [x] 4.1 [P0, depends: 3.2] Prove hidden native events still route through authoritative `sharedOwner`; input is a native `threadId` plus canonical Shared owner metadata, output is a Shared-thread handler call, verified by focused bridge and app-server event tests. Result: passed without production routing changes.
- [x] 4.2 [P0, depends: 4.1] Prove Shared canvas projection survives activation without changing generic `activeCanvasStore`; input is inactive Shared live text plus active-thread switch, output is a cold-subscribed Shared live snapshot, verified by the focused navigation projection test. Result: projection test plus existing canvas/store/subscription suites passed.
- [x] 4.3 [P0, depends: 4.2] Run focused Vitest, TypeScript typecheck and OpenSpec strict validation; output is recorded pass/fail evidence with no commit. Result: Shared routing/projection focused tests passed; canvas/store/subscription tests passed 10/10; `pnpm typecheck` passed; this OpenSpec change passed strict validation within the all-workspace run, whose only failures were unrelated changes `add-tokentracker-usage-dashboard` and `reduce-client-polling-overhead`.
- [x] 4.4 [P1, depends: 4.3] Perform final Shared-only impact review; output confirms no generic canvas store, Native lifecycle, Rust execution, history or scroll behavior changed. Result: no finding; the only production file changed is `useThreadItemEvents.ts`, guarded by canonical `shared:*` identity.
