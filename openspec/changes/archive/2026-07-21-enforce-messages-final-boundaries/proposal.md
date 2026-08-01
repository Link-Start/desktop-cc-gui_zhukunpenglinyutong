## Why

Messages roadmap Phase 0 established an exact debt baseline, and Phases 1-7 have now repaid most architecture debt. The current checker still permits three `outside -> messages private` imports, retains seven stale outbound allowlist entries, and does not enforce internal direction rules for rows or pure timeline layers. Without a final deterministic gate, completed ownership work can regress silently.

## What Changes

- Move the remaining three externally consumed messages utilities/contracts to explicit neutral owners so external features no longer deep-import messages private paths.
- Move timeline virtualization test support out of the `components` path.
- Refactor `scripts/check-messages-boundaries.mjs` into a deterministic, fixture-testable checker.
- Remove repaid exact allowlist entries and make the inbound baseline empty.
- Enforce rows、timeline pure-layer and threads dependency-direction rules independently of the remaining exact outbound debt baseline.
- Run the checker in CI and execute the roadmap final Definition of Done.

## Impact

- Affected files: the three remaining inbound dependency owners/callers、timeline test support、boundary checker and tests、`package.json` / CI wiring、OpenSpec/Trellis evidence.
- Runtime behavior: owner moves and import rewrites only; no messages rendering、streaming、history、virtualization or recovery behavior change.
- Dependencies: no new dependency; reuse TypeScript compiler API and Vitest.
- Compatibility: existing remaining `messages -> peer feature` debt is frozen by exact baseline; deletion remains allowed and additions remain forbidden.

## Acceptance

- `outside -> messages private` count is zero.
- Current exact outbound baseline matches the real graph and contains no repaid entry.
- Fixture tests prove all four final forbidden dependency patterns fail deterministically.
- `npm run check:messages-boundaries` runs in CI.
- All Phase 8.6 commands are executed; unrelated pre-existing failures are reproduced and recorded explicitly.
