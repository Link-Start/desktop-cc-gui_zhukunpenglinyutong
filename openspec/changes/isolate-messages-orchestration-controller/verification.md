# Verification

## Status

Completed on 2026-07-21.

## Behavior Lock

- Baseline focused set: 10 files passed, 131 tests passed, 5 skipped. Coverage included runtime reconnect、Windows mitigation、live behavior、timeline stability、streaming presentation、live window、virtualized jump、history loading、scroll convergence and transient cleanup.
- Added `useMessagesHistoryWindow.test.tsx` to prove readable-window snapshots do not cross `workspaceId + threadId` scope boundaries.
- Added `useMessagesRuntimeState.test.tsx` with red-first coverage for assistant-finalizing and visible-text reporting isolation when two workspaces reuse the same thread/message ids.

## Implementation Evidence

- `MessagesCore.tsx`: 1798 lines, reduced from 2746 and below the 2200-line ratchet.
- Extracted owners: `useMessagesRuntimeState` 493 lines, `useMessagesPresentationState` 232 lines, `useMessagesHistoryWindow` 263 lines, `useMessagesScrollController` 276 lines, `useMessagesInteractions` 218 lines.
- The live assistant body remains row-local through `liveAssistantTextChannel`; heavy grouping、anchor、boundary and summary derivations remain based on the deferred presentation snapshot.
- Peer-feature adapters remain in `MessagesCore`; orchestration hooks receive neutral values/callbacks and add no new cross-feature imports.

## Verification Evidence

- Post-review focused regression: 7 files passed, 102 tests passed.
- Final full messages suite: 71 files passed; 613 tests passed, 7 skipped.
- Repository test gate `npm run test`: completed all 876 test files successfully; one existing vendor settings `act(...)` warning was emitted without failure.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed with only the repository's existing CSS unknown `file`、mixed dynamic/static import and chunk-size warnings.
- `npm run check:messages-boundaries`: passed; inbound 3/3, outbound 60/61, removed 1, new 0.
- `npm run check:large-files:ci`: completed with the known 51-file baseline and no new finding.
- `openspec validate isolate-messages-orchestration-controller --strict`: passed.
- `git diff --check`: passed.

## Review

- Independent `codex review --uncommitted` found one P2: runtime cleanup was keyed only by `threadId`, allowing finalizing and visible-text state to cross workspaces when thread ids collide.
- The finding was reproduced by two failing hook tests, fixed by scoping runtime cleanup to the existing workspace + thread `renderScopeKey`, then verified by the final full suite.
- No remaining review findings.

## Baseline Qualifiers

- The roadmap file remains local and untracked.
- `check:large-files:gate` remains a repository-wide strict baseline failure with 51 pre-existing findings; this phase adds none and all changed production files stay below their applicable ratchets.
- Repository-wide `openspec validate --all --strict` has unrelated existing failures; the active change validates strictly in isolation.
- No manual desktop interaction session was run for this ownership-only refactor; automated live、history、scroll and cleanup suites cover the changed behavior.
