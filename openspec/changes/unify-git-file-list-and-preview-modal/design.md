## Context

当前 changed-file UI 有三份实现：`GitDiffPanelFileSections`、`GitHistoryWorktreePanel` 内联 renderer、`GitHistoryPanelView` commit details tree。它们共享 CSS class 和部分 section actions，却各自维护 row/tree/activation，造成视觉复用假象与行为分叉。现有新预览能力已经由 `WorkspaceEditableDiffReviewSurface` 提供，不需要重写 diff renderer。

## Goals / Non-Goals

**Goals:**

- 一个 canonical changed-file view model、一个 topology builder、一个 flat/tree renderer。
- 容器通过 callbacks/slots 注入 domain actions，不复制 row/tree JSX。
- 三个入口统一调用现有 editable preview surface。

**Non-Goals:**

- 不统一页面数据 fetching、Git mutations 或 commit history orchestration。
- 不改变 backend contract，不引入 dependency。

## Decisions

### Decision 1: Shared renderer core, not shared page container

抽取 `GitChangedFileList`、canonical item/type 与 tree topology helper。`GitDiffPanel`、`GitHistoryWorktreePanel`、`GitHistoryPanelView` 各自 adapter 输入 `section/status/path/stats`，并注入 row actions、selection 与 activation。

Alternative：直接在 history 页面嵌入整个 `GitDiffPanel`。拒绝原因是 commit details 没有 stage/unstage domain，且会把 loading/layout/mode state 强行耦合。

### Decision 2: Canonical activation contract

shared renderer 只暴露 `onActivateFile(file)` 与可选 `renderFileActions(file)`；mouse、keyboard 和 double-click 语义由同一 row 实现。容器不得再次绑定平行 modal state。

Alternative：各页面保留 click handler。拒绝原因是这正是旧新 popup 分叉的来源。

### Decision 3: Reuse existing editable preview surface

抽取 shared `GitChangedFilePreviewModal` host，内部渲染 `WorkspaceEditableDiffReviewSurface`。worktree/commit adapters 负责提供 `workspaceId`、file metadata、diff entries 与 full-diff loader；baseline unavailable 继续留在新 surface。

Alternative：包装 legacy `GitDiffViewer` 并逐入口切换。拒绝原因是会继续维护两套 modal body。

### Decision 4: Reuse the existing full-diff loader for read-only alignment

Git History 已通过 `getGitCommitDiff(..., contextLines: 200_000)` 提供按需、单文件的 full-context patch。`WorkspaceReadOnlyDiffCompare` MUST 消费 shared surface 已有的 `fullDiffLoader`，并以返回结果构造完整左右内容；初始 patch 仅作为 loading/error fallback。

Alternative：新增 commit blob content command。拒绝原因是当前缺陷并非 backend 数据能力缺失，而是 read-only renderer 未消费已有 loader；新增跨层 contract 会扩大改动和维护面。

### Decision 5: Region mode is an editor presentation, not a read-only document

split Diff 的“区域查看”与“全文查看” MUST 共用 aligned compare。editable worktree file 在两种模式下 MUST 保持同一个完整 document draft；区域模式仅通过 CodeMirror block decoration 折叠 unchanged ranges，禁止改用 patch-only read-only source。read-only commit preview 则继续使用 full-context/patch sources，但保持同一视觉规则。

### Decision 6: Read-only commit preview only exposes region mode

Git History commit file 没有 editable full document contract。其 preview 固定使用 `GitDiffViewer` patch body，只保留“区域查看”control；隐藏“全文查看”，并断开 full-context loader。该分流不影响 editable worktree preview 的双模式能力。

## Risks / Trade-offs

- [Risk] worktree 与 commit file status model 不同 → adapter 在 boundary normalize，不把 union types泄漏进 renderer。
- [Risk] migration 影响 stage/unstage/inclusion actions → actions 使用 render slot/callback 保留，focused tests 锁定。
- [Risk] 大文件继续增长 → shared modules 独立落位，并运行 large-file gate。
- [Risk] 当前临时断开造成测试基线不一致 → 第一阶段先恢复误断 wiring，再迁移并更新最终 contract tests。
- [Risk] full-context 请求晚于文件切换返回 → renderer 使用 request generation guard，忽略 stale response。
- [Risk] remote/backend 请求失败 → 保留初始 patch reconstruction，弹窗仍可用且不清空已渲染内容。
- [Risk] 折叠局部内容后保存覆盖完整文件 → decoration 只改变 presentation，不改变 CodeMirror document value 与 save payload。

## Migration Plan

1. 建立 shared model/topology/renderer 与 focused tests。
2. 迁移 `GitDiffPanel`，恢复主 Source Control preview。
3. 迁移 `GitHistoryWorktreePanel` 与 commit details tree。
4. 建立 shared preview modal host，连接三处入口。
5. 删除 legacy modal branches/state，运行完整 gates。

Rollback：每阶段保持 adapter boundary；若某个 surface 回归，可在单个容器恢复旧 renderer，而不影响其他 surface。禁止整文件回退。

## Open Questions

- 无。shared renderer 保持 feature-local，待三个入口稳定后再评估是否扩展到其他 Git dialogs。
