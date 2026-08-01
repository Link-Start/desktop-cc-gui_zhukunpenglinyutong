# Verification

## Status

Implemented, verified, reviewed, committed, and archived on 2026-07-21.

## Baseline

- Current checker: inbound 3 / baseline 3; outbound 54 / baseline 61; removed 7; new 0.
- Remaining inbound paths: composer -> messages live canvas controls; layout -> messages runtime reconnect; layout -> messages presentation profile.
- Current internal path to move: timeline virtualization test imports heavy-history support from messages components.

## Implementation Evidence

- Live canvas controls moved to `src/live-canvas/liveCanvasControls.ts`.
- Runtime reconnect contracts/helpers and tests moved to `src/runtime-recovery/`.
- Presentation profile and tests moved to `src/conversation-presentation/`.
- Heavy-history fixture moved to `src/features/messages/timeline/test-support/`.
- Checker core extracted to `scripts/lib/messagesBoundaryChecker.mjs` with fixture-root support.
- Final checker state: inbound 0 / baseline 0; outbound 50 / baseline 50; removed 0; new 0.
- CI typecheck job now runs `npm run check:messages-boundaries` after runtime contracts.

## Verification Evidence

- RED observed on 2026-07-21: four negative fixture cases failed against the old CLI while the positive case passed.
- Review RED observed on 2026-07-21: extensionful `messages/index.ts` public import failed before the public-target fix.
- GREEN observed: `src/contracts/checkMessagesBoundaries.test.ts` passes 6/6, including extensionful public index imports.
- Focused owner/timeline/messages tests pass 103/103.
- `npm run check:messages-boundaries`: inbound 0 / baseline 0; outbound 50 / baseline 50; new 0.
- Final focused run including the checker: 70 files passed; 605 tests passed; 7 skipped.
- `npm run lint`、`npm run typecheck`、`npm run test` and `npm run build` pass; the batched full test run completed 878 test files.
- `npm run check:runtime-contracts`、`npm run check:bundle-chunking` and `npm run perf:realtime:boundary-guard` pass.
- `npm run check:large-files:gate` reproduces the known 51-file repository baseline; no changed Phase 8 file appears in the findings.
- `npm run check:heavy-test-noise` completes 881 test files, then fails on two existing `act(...)` warnings and two existing stdout lines. The same warnings/output were reproduced on parent commit `2300241c` with 18/18 targeted tests passing.
- `openspec validate enforce-messages-final-boundaries --strict --no-interactive` passes.
- Repository-wide strict validation reports 430 passed and one unrelated failure: `fix-claude-cli-native-installer` has two MODIFIED requirements missing requirement text. The same diagnostics were reproduced on parent commit `2300241c`.
- `git diff --check` passes.

## Review

- Independent `codex review --uncommitted` found one P2 false positive for extensionful public index imports.
- The finding was fixed test-first by allowing `src/features/messages/index.ts` as a public target.
- Follow-up `codex review --uncommitted` found no discrete correctness, security, or maintainability issues; it independently reran the boundary checker, typecheck, lint, and 67 focused tests successfully.

## Baseline Qualifiers

- The roadmap remains local and untracked.
- `check:large-files:gate` currently has a known 51-file repository baseline.
- Repository-wide OpenSpec strict validation may contain unrelated active-change failures; each must be reproduced before qualification.
