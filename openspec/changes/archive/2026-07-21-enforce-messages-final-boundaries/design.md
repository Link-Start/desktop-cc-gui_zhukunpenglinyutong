## Context

The current checker scans AST imports correctly but applies only two coarse exact-baseline directions. Phase 8 requires a final policy graph:

1. non-messages code may import only `src/features/messages/index.ts`, not private messages paths;
2. `threads/**` must not import messages components、utils、rendering、rows、timeline or orchestration;
3. `messages/rows/**` must not import timeline or orchestration owners;
4. `messages/timeline/(projection|virtualization)/**` must not import React component paths.

Three inbound imports remain today: live canvas controls from composer, runtime reconnect contracts from layout, and presentation profile from layout. These capabilities are not messages-private behavior and should move to neutral owners.

## Decisions

1. **Neutral owner moves before policy tightening**
   - Move live canvas controls to a top-level/shared canvas contract owner.
   - Move runtime reconnect contract helpers to a top-level runtime recovery owner.
   - Move presentation profile to `src/conversation-presentation`.
   - Migrate all current callers directly; no compatibility re-export is required.

2. **Pure checker core + CLI adapter**
   - Extract filesystem walk、AST import collection、path resolution and violation classification into an importable module.
   - Keep `scripts/check-messages-boundaries.mjs` as a small CLI adapter.
   - Support an explicit root in tests so temporary fixture graphs do not mutate the repository.

3. **Exact debt baseline plus structural policy**
   - Set inbound baseline to empty after owner migration.
   - Recompute outbound baseline after neutral-owner moves; the final exact graph contains 50 records.
   - Structural violations always fail even if an exact record appears in a debt baseline.

4. **Deterministic fixtures**
   - Add positive fixture coverage for messages public index and neutral shared modules.
   - Add negative fixtures for external private import、threads-to-messages private、rows-to-timeline/orchestration and pure timeline-to-components.
   - Assert stable direction、file、line、kind and specifier output.

5. **CI integration**
   - Keep the existing package script name unchanged.
   - Add a dedicated CI step next to runtime/static contract checks after deterministic tests pass.

## Risks

- Owner moves can create compatibility import churn; use re-exports and focused tests to preserve runtime identity.
- A coarse `components` substring rule can false-positive test support; move test support to an explicit `test-support` owner and classify resolved paths, not raw text.
- Existing outbound debt remains large; freeze it exactly and avoid wildcard exceptions.

## Verification Strategy

- Focused tests for moved neutral owners and their current callers.
- Boundary checker fixture test suite plus current repository positive run.
- Messages suite、lint、typecheck、full test、build、runtime contracts、bundle chunking、large-file、heavy-test-noise、realtime boundary guard、OpenSpec validation and diff check.
- Reproduce any unrelated pre-existing failure on the implementation parent commit before qualifying it.
