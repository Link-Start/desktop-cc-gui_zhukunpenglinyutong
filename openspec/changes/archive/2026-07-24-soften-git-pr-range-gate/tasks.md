## 1. Backend Range Gate Contract

- [x] 1.1 [P0][depends:none][input: current `PrRangeGateDecision` and Git PR result types][output: three-state Range Gate decision plus typed `rangeGate` metadata][verify: Rust unit tests cover 240/241/300/301 boundaries] Implement structured Soft Gate decisions.
- [x] 1.2 [P0][depends:1.1][input: Create PR Tauri/daemon request path][output: optional one-shot `allowLargeRange` propagated through local and remote backends][verify: contract tests and source checks cover forwarding/dispatch fields] Propagate large-range authorization.
- [x] 1.3 [P0][depends:1.1,1.2][input: empty/suspicious range heuristics][output: structural anomalies remain blocked regardless of override][verify: Rust unit tests cover override against empty and suspicious ranges] Preserve non-bypassable Hard Stops.

## 2. Frontend Confirmation Flow

- [x] 2.1 [P0][depends:1.2][input: Rust request/result contract][output: aligned TypeScript types and Tauri invoke mapping][verify: typecheck passes and invoke test asserts `allowLargeRange`] Align frontend contract.
- [x] 2.2 [P0][depends:2.1][input: confirmation-required workflow result][output: `ask` confirmation followed by authorized full retry; cancel stops without generic retry error][verify: focused GitHistoryPanel tests cover confirm/cancel and second-call payload] Implement Create PR Soft Gate UX.
- [x] 2.3 [P1][depends:2.2][input: `large` and `diff-incomplete` severities][output: localized Chinese/English warning copy with base/head/count context][verify: i18n keys resolve in focused tests] Add risk-specific copy.

## 3. Verification And Spec Closure

- [x] 3.1 [P0][depends:1.3,2.3][input: backend/frontend implementation][output: focused Rust and Vitest regression evidence][verify: target commands exit 0] Run focused tests.
- [x] 3.2 [P0][depends:3.1][input: completed change][output: typecheck/lint/OpenSpec validation results and verification record][verify: all applicable automated gates exit 0 or pre-existing blockers are documented] Complete quality and OpenSpec verification.

## 4. Review Follow-up Hardening

- [x] 4.1 [P0][depends:3.2][input: boolean-only large-range authorization][output: authorization bound to current base/head revision fingerprint across local/remote contracts][verify: Rust tests cover matching and stale fingerprints; service/UI tests assert retry payload] Bind authorization to the evaluated range.
- [x] 4.2 [P0][depends:4.1][input: daemon PR precheck Git commands][output: bounded non-interactive execution and structured precheck failure settlement][verify: daemon compile plus focused helper/result tests] Harden daemon precheck execution.
- [x] 4.3 [P1][depends:4.1][input: confirmation copy][output: actual `upstream/<base>...HEAD` context, push target, and no duplicated `300` constant][verify: focused UI tests assert translated key inputs and copy source] Correct confirmation context and remove threshold drift.
- [x] 4.4 [P0][depends:4.1,4.2,4.3][input: review follow-up implementation][output: focused regression evidence and strict artifact validation][verify: Rust/Vitest/typecheck/lint/daemon compile/OpenSpec strict validation exit 0] Close review findings.
