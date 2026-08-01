# Phase 0 Verification Evidence

## 1. Scope and Worktree Ownership

- Date: 2026-07-21.
- This change modifies only `openspec/changes/harden-messages-module-boundaries/**`,
  `scripts/check-messages-boundaries.mjs`, and `package.json`.
- The user roadmap is read-only. The archived change and synchronized main spec are
  preserved. Shared-worktree Phase 1 test edits are not modified or reverted.
- No staging or commit is performed.

## 2. Archived First-Stage Change

- `openspec/changes/archive/2026-07-21-refactor-messages-presentation-architecture/**`
  exists; `openspec list` does not report the old change as active.
- Archived `tasks.md` contains the completed execution/evidence checklist.
- `openspec validate messages-presentation-architecture --strict`: exit 0,
  `Specification 'messages-presentation-architecture' is valid`.

## 3. Measured Baseline

### Core line counts

| File | Lines |
|---|---:|
| `Messages.tsx` | 2789 |
| `MessagesTimeline.tsx` | 2081 |
| `MessagesRows.tsx` | 1769 |
| `Markdown.tsx` | 1570 |
| `GenericToolBlock.tsx` | 1553 |
| **Total** | **9762** |

### Quality baseline

- Confirmed first-stage messages baseline: **77 test files / 698 passed / 7 skipped**.
- Initial shared-worktree rerun during Phase 1 test-first RED: **77 files; 75 passed,
  2 failed; 698 tests passed, 3 failed, 7 skipped**. Those three assertions were in the
  concurrent `MessagesRows.stream-mitigation.test.tsx` work.
- Final shared-worktree snapshot after the other agent also changed Phase 1 production/test
  files: **77 files; 76 passed, 1 failed; 701 tests passed, 1 failed, 7 skipped**. The only
  failure is a 5000ms timeout in the concurrent test
  `Messages.rich-content.test.tsx > ignores an older deferred image hydration generation
  in the same scope`.
- Baseline `npm run typecheck`: exit 0 before the concurrent Phase 1 implementation update.
- Final shared-worktree `npm run typecheck`: exit 2 only in the concurrent
  `Messages.rich-content.test.tsx` at lines 511 and 522 because `toHaveAttribute` is not
  present on `Assertion<HTMLElement>`.
- `npm exec eslint -- src/features/messages --ext .ts,.tsx`: exit 0; emits only the
  repository's existing TypeScript 5.8.3 / typescript-estree support-range warning.
- `npm run check:large-files:gate`: exit 1 with **51 existing failures**. This is the
  measured repository baseline supplied for Phase 0; no Phase 0 file is among those entries.

## 4. Inventory Method

The inventory uses the same TypeScript AST model as the gate. It scans real
`import`, `export ... from`, TypeScript `import("...")` types, dynamic imports,
CommonJS `require`, and `vi.mock` / `jest.mock` calls. Relative paths and `@/`
resolve to repository paths. Ordinary strings and path examples are excluded.

Classification meanings:

- `public API`: current conversation composition/type compatibility call site that must
  later converge on the single messages public surface.
- `shared capability misplaced`: reusable rendering/diff/tool/icon/prompt capability
  currently owned by one feature and scheduled for neutral ownership.
- `intentional runtime dependency`: current state, streaming, task, Markdown runtime,
  theme, or specialized runtime contract required by messages.
- `producer-specific presentation coupling`: browser, intent canvas, project memory, or
  note-card producer details that must later become neutral presentation metadata.

## 5. Outside -> Messages Private Inventory (38)

| # | Source | Kind | Exact specifier | Classification |
|---:|---|---|---|---|
| 1 | `src/app-shell-parts/useAppShellWorkspaceFlowsSection.ts:21` | `import` | `../features/messages/types` | public API |
| 2 | `src/app-shell.tsx:71` | `import` | `./features/messages/types` | public API |
| 3 | `src/features/app/components/sidebarInternals.ts:11` | `import` | `../../messages/components/toolBlocks/toolConstants` | shared capability misplaced |
| 4 | `src/features/composer/components/ChatInputBox/ChatInputBoxFooter.manual-memory.test.tsx:8` | `mock` | `../../../messages/components/Markdown` | shared capability misplaced |
| 5 | `src/features/composer/components/ChatInputBox/ChatInputBoxFooter.tsx:29` | `import` | `../../../messages/components/Markdown` | shared capability misplaced |
| 6 | `src/features/composer/components/ChatInputBox/ContextBar.tsx:17` | `import` | `../../../messages/constants/liveCanvasControls` | shared capability misplaced |
| 7 | `src/features/composer/components/ComposerInput.manual-memory.test.tsx:8` | `mock` | `../../messages/components/Markdown` | shared capability misplaced |
| 8 | `src/features/composer/components/ComposerInput.tsx:42` | `import` | `../../messages/components/Markdown` | shared capability misplaced |
| 9 | `src/features/context-ledger/components/ContextLedgerPanel.tsx:3` | `import` | `../../messages/components/Markdown` | shared capability misplaced |
| 10 | `src/features/engine-task-output/utils/engineTaskOutputProjection.ts:2` | `import` | `../../messages/utils/agentTaskNotification` | shared capability misplaced |
| 11 | `src/features/files/components/FileMarkdownPreview.tsx:41` | `import` | `../../messages/rendering/markdown/codeBlockLanguageIcon` | shared capability misplaced |
| 12 | `src/features/git/components/GitDiffViewer.tsx:11` | `import` | `../../messages/components/Markdown` | shared capability misplaced |
| 13 | `src/features/git/components/WorkspaceEditableDiffReviewSurface.tsx:7` | `import` | `../../messages/utils/diffUtils` | shared capability misplaced |
| 14 | `src/features/layout/hooks/activeCanvasStore.ts:4` | `import` | `../../messages/types/messagesTypes` | public API |
| 15 | `src/features/layout/hooks/conversationCanvasNode.tsx:3` | `import` | `../../messages/components/conversation/MessageForkConfirmDialog` | public API |
| 16 | `src/features/layout/hooks/conversationCanvasNode.tsx:4` | `import` | `../../messages/components/Messages` | public API |
| 17 | `src/features/layout/hooks/conversationCanvasNode.tsx:5` | `import` | `../../messages/types/messagesTypes` | public API |
| 18 | `src/features/layout/hooks/layoutNodesTypes.ts:9` | `import` | `../../messages/types` | public API |
| 19 | `src/features/layout/hooks/layoutNodesTypes.ts:75` | `import` | `../../messages/utils/recovery/runtimeReconnect` | public API |
| 20 | `src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx:166` | `mock` | `../../messages/components/Messages` | public API |
| 21 | `src/features/layout/hooks/useLayoutNodes.tsx:129` | `import` | `../../messages/presentation/presentationProfile` | public API |
| 22 | `src/features/note-cards/components/WorkspaceNoteCardPanel.test.tsx:48` | `mock` | `../../messages/components/Markdown` | shared capability misplaced |
| 23 | `src/features/note-cards/components/WorkspaceNoteCardPanel.tsx:31` | `import` | `../../messages/components/Markdown` | shared capability misplaced |
| 24 | `src/features/operation-facts/operationFacts.ts:6` | `import` | `../messages/components/toolBlocks/toolConstants` | shared capability misplaced |
| 25 | `src/features/project-memory/components/ProjectMemoryPanel.tsx:17` | `import` | `../../messages/components/Markdown` | shared capability misplaced |
| 26 | `src/features/session-activity/adapters/buildWorkspaceSessionActivity.ts:2` | `import` | `../../messages/components/toolBlocks/toolConstants` | shared capability misplaced |
| 27 | `src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx:29` | `import` | `../../messages/components/Markdown` | shared capability misplaced |
| 28 | `src/features/spec/components/spec-hub/presentational/SpecHubPresentationalImpl.tsx:2` | `import` | `../../../../messages/components/Markdown` | shared capability misplaced |
| 29 | `src/features/spec/components/SpecHub.test-support.tsx:63` | `mock` | `../../messages/components/Markdown` | shared capability misplaced |
| 30 | `src/features/status-panel/components/CheckpointPanel.tsx:14` | `import` | `../../messages/components/toolBlocks/FileIcon` | shared capability misplaced |
| 31 | `src/features/status-panel/components/FileChangesList.tsx:6` | `import` | `../../messages/components/toolBlocks/FileIcon` | shared capability misplaced |
| 32 | `src/features/status-panel/hooks/useStatusPanelData.ts:10` | `import` | `../../messages/components/toolBlocks/toolConstants` | shared capability misplaced |
| 33 | `src/features/threads/loaders/claudeHistoryLoader.ts:19` | `import` | `../../messages/utils/diffUtils` | shared capability misplaced |
| 34 | `src/features/threads/utils/claudeRewindRestore.ts:10` | `import` | `../../messages/components/toolBlocks/toolConstants` | shared capability misplaced |
| 35 | `src/features/update/components/ReleaseNotesModal.test.tsx:32` | `mock` | `../../messages/components/Markdown` | shared capability misplaced |
| 36 | `src/features/update/components/ReleaseNotesModal.tsx:8` | `import` | `../../messages/components/Markdown` | shared capability misplaced |
| 37 | `src/utils/threadItemsFileChanges.ts:1` | `import` | `../features/messages/utils/diffUtils` | shared capability misplaced |
| 38 | `src/utils/threadItemsUserMessage.ts:1` | `import` | `../features/messages/utils/commandMessageTags` | shared capability misplaced |

## 6. Messages -> Peer Feature Inventory (70)

| # | Source | Kind | Exact specifier | Classification |
|---:|---|---|---|---|
| 1 | `src/features/messages/components/chatCanvasSmoke.test.tsx:5` | `import` | `../../threads/contracts/conversationAssembler` | intentional runtime dependency |
| 2 | `src/features/messages/components/chatCanvasSmoke.test.tsx:6` | `import` | `../../threads/contracts/conversationCurtainContracts` | intentional runtime dependency |
| 3 | `src/features/messages/components/context/IntentCanvasContextSummaryCard.tsx:4` | `import` | `../../../intent-canvas/utils/messageContext` | producer-specific presentation coupling |
| 4 | `src/features/messages/components/conversation/MessageForkConfirmDialog.tsx:12` | `import` | `../../../threads/constants/codexProviderProfiles` | intentional runtime dependency |
| 5 | `src/features/messages/components/conversation/MessagesInlinePrompts.tsx:1` | `import` | `../../../app/components/ApprovalToasts` | shared capability misplaced |
| 6 | `src/features/messages/components/conversation/MessagesInlinePrompts.tsx:2` | `import` | `../../../app/components/RequestUserInputMessage` | shared capability misplaced |
| 7 | `src/features/messages/components/conversation/MessagesOutlineFloater.test.tsx:4` | `import` | `../../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 8 | `src/features/messages/components/conversation/MessagesOutlineFloater.tsx:6` | `import` | `../../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 9 | `src/features/messages/components/conversation/TurnFilesChangedCard.tsx:10` | `import` | `../../../files/utils/fileTreeIcons` | shared capability misplaced |
| 10 | `src/features/messages/components/Markdown.image-fullscreen.test.tsx:25` | `mock` | `../../markdown/imageFullscreen` | intentional runtime dependency |
| 11 | `src/features/messages/components/Markdown.math-rendering.test.tsx:4` | `import` | `../../markdown/markdownMath` | intentional runtime dependency |
| 12 | `src/features/messages/components/Markdown.outline-streaming.test.tsx:4` | `import` | `../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 13 | `src/features/messages/components/Markdown.tsx:6` | `import` | `../../markdown/imageFullscreen` | intentional runtime dependency |
| 14 | `src/features/messages/components/Markdown.tsx:7` | `import` | `../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 15 | `src/features/messages/components/Markdown.tsx:24` | `import` | `../../markdown/markdownMath` | intentional runtime dependency |
| 16 | `src/features/messages/components/Markdown.tsx:33` | `export` | `../../markdown/markdownMath` | intentional runtime dependency |
| 17 | `src/features/messages/components/Markdown.tsx:58` | `import` | `../../markdown/messageMarkdownPrecompute` | intentional runtime dependency |
| 18 | `src/features/messages/components/Markdown.tsx:64` | `import` | `../../markdown/messageMarkdownHeavyIslands` | intentional runtime dependency |
| 19 | `src/features/messages/components/Messages.live-behavior.test.tsx:5` | `import` | `../../threads/contracts/conversationCurtainContracts` | intentional runtime dependency |
| 20 | `src/features/messages/components/Messages.live-markdown-streaming.test.tsx:7` | `import` | `../../threads/contracts/conversationCurtainContracts` | intentional runtime dependency |
| 21 | `src/features/messages/components/Messages.test.tsx:13` | `import` | `../../agent-orchestration/utils/navigationEvents` | intentional runtime dependency |
| 22 | `src/features/messages/components/Messages.test.tsx:17` | `import` | `../../tasks/types` | intentional runtime dependency |
| 23 | `src/features/messages/components/Messages.tsx:18` | `import` | `../../threads/contracts/conversationCurtainContracts` | intentional runtime dependency |
| 24 | `src/features/messages/components/Messages.tsx:19` | `import` | `../../threads/hooks/useStreamActivityPhase` | intentional runtime dependency |
| 25 | `src/features/messages/components/Messages.tsx:21` | `import` | `../../threads/utils/streamLatencyDiagnostics` | intentional runtime dependency |
| 26 | `src/features/messages/components/Messages.windows-render-mitigation.test.tsx:5` | `import` | `../../threads/contracts/conversationCurtainContracts` | intentional runtime dependency |
| 27 | `src/features/messages/components/Messages.windows-render-mitigation.test.tsx:21` | `mock` | `../../threads/utils/streamLatencyDiagnostics` | intentional runtime dependency |
| 28 | `src/features/messages/components/MessagesRows.tsx:22` | `import` | `../../threads/hooks/useStreamActivityPhase` | intentional runtime dependency |
| 29 | `src/features/messages/components/MessagesRows.tsx:23` | `import` | `../../threads/hooks/useLiveAssistantText` | intentional runtime dependency |
| 30 | `src/features/messages/components/MessagesRows.tsx:24` | `import` | `../../threads/utils/realtimePerfFlags` | intentional runtime dependency |
| 31 | `src/features/messages/components/MessagesRows.tsx:25` | `import` | `../../threads/utils/streamLatencyDiagnostics` | intentional runtime dependency |
| 32 | `src/features/messages/components/MessagesRows.tsx:30` | `import` | `../../engine-task-output/components/EngineTaskOutputInspector` | intentional runtime dependency |
| 33 | `src/features/messages/components/MessagesRows.tsx:31` | `import` | `../../engine-task-output/hooks/useEngineTaskOutputSnapshot` | intentional runtime dependency |
| 34 | `src/features/messages/components/MessagesRows.tsx:32` | `import` | `../../engine-task-output/types` | intentional runtime dependency |
| 35 | `src/features/messages/components/MessagesRows.tsx:33` | `import` | `../../engine-task-output/utils/engineTaskOutputProjection` | intentional runtime dependency |
| 36 | `src/features/messages/components/MessagesRows.tsx:39` | `import` | `../../browser-agent` | producer-specific presentation coupling |
| 37 | `src/features/messages/components/MessagesRows.tsx:55` | `import` | `../../intent-canvas/utils/messageContext` | producer-specific presentation coupling |
| 38 | `src/features/messages/components/MessagesRows.tsx:145` | `import-type` | `../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 39 | `src/features/messages/components/MessagesTimeline.tsx:43` | `import` | `../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 40 | `src/features/messages/hooks/useConversationNoteCaptureMenu.ts:17` | `import` | `../../note-cards/types` | producer-specific presentation coupling |
| 41 | `src/features/messages/hooks/useMessageOutlineActive.test.tsx:5` | `import` | `../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 42 | `src/features/messages/hooks/useMessageOutlineActive.ts:2` | `import` | `../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 43 | `src/features/messages/orchestration/components/MessagesLinkedRunBanner.tsx:3` | `import` | `../../../agent-orchestration/utils/navigationEvents` | intentional runtime dependency |
| 44 | `src/features/messages/orchestration/components/MessagesLinkedRunBanner.tsx:4` | `import` | `../../../tasks/utils/taskRunSurface` | intentional runtime dependency |
| 45 | `src/features/messages/orchestration/models/messagesTimelineModels.ts:11` | `import` | `../../../threads/utils/streamLatencyDiagnostics` | intentional runtime dependency |
| 46 | `src/features/messages/presentation/messagesOutlineState.test.ts:2` | `import` | `../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 47 | `src/features/messages/presentation/messagesOutlineState.ts:1` | `import` | `../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 48 | `src/features/messages/presentation/messagesReasoning.ts:3` | `import` | `../../threads/contracts/conversationCurtainContracts` | intentional runtime dependency |
| 49 | `src/features/messages/presentation/messagesUserPresentation.ts:12` | `import` | `../../browser-agent` | producer-specific presentation coupling |
| 50 | `src/features/messages/presentation/messagesUserPresentation.ts:13` | `import` | `../../intent-canvas/utils/messageContext` | producer-specific presentation coupling |
| 51 | `src/features/messages/presentation/presentationProfile.test.ts:2` | `import` | `../../threads/assembly/conversationMigrationGates` | intentional runtime dependency |
| 52 | `src/features/messages/presentation/presentationProfile.ts:1` | `import` | `../../threads/contracts/conversationCurtainContracts` | intentional runtime dependency |
| 53 | `src/features/messages/presentation/presentationProfile.ts:2` | `import` | `../../threads/assembly/conversationMigrationGates` | intentional runtime dependency |
| 54 | `src/features/messages/rendering/markdown/FullMarkdownRuntime.tsx:9` | `import` | `../../../markdown/markdownMath` | intentional runtime dependency |
| 55 | `src/features/messages/rendering/markdown/MermaidBlock.fullscreen.test.tsx:59` | `import` | `../../../markdown/mermaidFullscreen` | intentional runtime dependency |
| 56 | `src/features/messages/rendering/markdown/MermaidBlock.tsx:9` | `import` | `../../../theme/utils/themeAppearance` | intentional runtime dependency |
| 57 | `src/features/messages/rendering/markdown/MermaidBlock.tsx:14` | `import` | `../../../markdown/mermaidFullscreen` | intentional runtime dependency |
| 58 | `src/features/messages/rows/components/PresentationRows.tsx:5` | `import` | `../../../git/components/DiffBlock` | shared capability misplaced |
| 59 | `src/features/messages/rows/presentation/messagesStreamingComplexity.ts:2` | `import` | `../../../threads/utils/streamLatencyDiagnostics` | intentional runtime dependency |
| 60 | `src/features/messages/types/messagesTypes.ts:14` | `import` | `../../threads/contracts/conversationCurtainContracts` | intentional runtime dependency |
| 61 | `src/features/messages/types/messagesTypes.ts:18` | `import` | `../../tasks/types` | intentional runtime dependency |
| 62 | `src/features/messages/types/messagesTypes.ts:19` | `import` | `../../note-cards/types` | producer-specific presentation coupling |
| 63 | `src/features/messages/utils/context/messagesMemoryContext.ts:2` | `import` | `../../../project-memory/utils/memoryMarkers` | producer-specific presentation coupling |
| 64 | `src/features/messages/utils/context/messagesMemoryContext.ts:3` | `import` | `../../../project-memory/utils/projectMemoryRetrievalPack` | producer-specific presentation coupling |
| 65 | `src/features/messages/utils/context/messagesMemoryContext.ts:4` | `import` | `../../../threads/assembly/conversationNormalization` | intentional runtime dependency |
| 66 | `src/features/messages/utils/context/messagesNoteCardContext.ts:2` | `import` | `../../../note-cards/utils/noteCardContextInjection` | producer-specific presentation coupling |
| 67 | `src/features/messages/utils/context/messagesNoteCardContext.ts:3` | `import` | `../../../threads/assembly/conversationNormalization` | intentional runtime dependency |
| 68 | `src/features/messages/utils/messageOutlineExtractor.ts:1` | `import` | `../../markdown/fastMarkdownRenderer` | intentional runtime dependency |
| 69 | `src/features/messages/utils/messagesRenderUtils.ts:3` | `import` | `../../threads/contracts/conversationCurtainContracts` | intentional runtime dependency |
| 70 | `src/features/messages/utils/recovery/runtimeReconnect.ts:2` | `import` | `../../../threads/utils/stabilityDiagnostics` | intentional runtime dependency |

Peer-feature counts:

- `agent-orchestration`: 2
- `app`: 2
- `browser-agent`: 2
- `engine-task-output`: 4
- `files`: 1
- `git`: 1
- `intent-canvas`: 3
- `markdown`: 21
- `note-cards`: 3
- `project-memory`: 2
- `tasks`: 3
- `theme`: 1
- `threads`: 25

## 7. Boundary Gate Evidence

- Baseline: `npm run check:messages-boundaries` exit 0:
  `inbound=38 (baseline 38, removed 0) outbound=70 (baseline 70, removed 0) new=0`.
- Negative fixture: temporary `src/__messagesBoundaryFixture.ts` imported
  `./features/messages/components/Markdown`. The gate exited 1 and reported exactly:
  `src/__messagesBoundaryFixture.ts:1 import "./features/messages/components/Markdown"`.
- The fixture was immediately deleted. A final positive rerun is required below.

## 8. Final Verification

- `npm run check:messages-boundaries`: exit 0; 38 inbound, 70 outbound, 0 new.
- `node --check scripts/check-messages-boundaries.mjs`: exit 0.
- `npm exec eslint -- scripts/check-messages-boundaries.mjs`: exit 0; only the
  existing TypeScript support-range warning.
- Final `npm exec eslint -- src/features/messages --ext .ts,.tsx`: exit 0; only the
  same existing TypeScript support-range warning.
- `openspec validate harden-messages-module-boundaries --strict`: exit 0,
  `Change 'harden-messages-module-boundaries' is valid`.
- `openspec validate messages-presentation-architecture --strict`: exit 0,
  `Specification 'messages-presentation-architecture' is valid`.
- Archived tasks audit: 27 checked items, 0 unchecked items.
- `git diff --check`: exit 0.
- Fixture cleanup: `src/__messagesBoundaryFixture.ts` absent.
- Scope audit: Phase 0 writes are limited to this change directory,
  `scripts/check-messages-boundaries.mjs`, and `package.json`. The roadmap,
  archived change, main spec, and concurrent Phase 1 files remain untouched by Phase 0.
- No `git add`, `git commit`, or staging operation was performed.
