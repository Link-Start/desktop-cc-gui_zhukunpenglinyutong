# Tasks: fix-session-switch-unlock-windows-jank

## S0 — Spec

- [x] proposal.md / design.md / tasks.md
- [x] specs: session-switch-identity-first / thread-select-resume-policy / shared-recovery-click-paint / shared-history-open-nonblocking
- [x] Register in `openspec/changes/README.md`

## S1 — Identity-then-chrome（首轮）

- [x] `commitThreadSelection.ts` + test
- [x] Wire `handleSelectThread` / `handleSelectWorkspaceInstance` / workspace-flows / search thread+message

## S2 — Resume policy（首轮）

- [x] `threadSelectResumePolicy.ts` + test
- [x] Wire `setActiveThreadId`；empty-surface cooldown ref；remove empty-Claude force

## S3 — Shared recovery + empty V0

- [x] recovery prefetch + yield helper + tests
- [x] Wire SharedSendStatusBar handlers
- [x] Empty V0 first-paint in `sharedHistoryLoader` + update tests

## S4 — Verify（首轮，已过时）

- [x] focused vitest
- [x] `npm run check:app-shell:governance` if app-shell touched
- [x] Windows hand-test 未测

## S5 — Review 收口（本轮）

- [x] 更新 OpenSpec：engine 进 chrome、空 surface 不拉幕布、never-started skip、切会话不扫盘
- [x] `commitThreadSelection` identity 只留 workspace+thread；engine 进 chrome；更新单测与 4 处接线
- [x] resume policy：`isKnownNeverStartedThread`；删除 `shouldForceThreadResumeOnCallback`；`setActiveThreadId` 不再同步拉幕布
- [x] `handleSelectThread` 等 click path 不调用 `ensureWorkspaceThreadListLoaded`
- [x] 更新 `useThreads.sidebar-cache` 等受影响单测
- [x] focused vitest + `npm run check:app-shell:governance`
- [x] Windows hand-test 未测；本轮按用户确认本地 commit，不 archive

## S6 — 重做收口（本轮）

- [x] 修 `extractThreadSizeBytes`：保留显式 0，缺失不发明 0
- [x] `mergeSessionDisplaySummary` 不让后到的 undefined 抹掉 empty disk size
- [x] 删除已死的 `shouldShowHistoryLoadingForSelectionThread`
- [x] `setActiveThreadId` 使用 `resumeDecision.force`，去掉冗余 identity 分支
- [x] 补 extract / merge / Index / policy 单测
- [x] focused vitest + `npm run check:app-shell:governance`
- [x] Windows hand-test 未测；本轮按用户确认本地 commit，不 archive
