## Why

当前 File History 作为独立 `centerMode` 占用主编辑区，与 Git Graph 的 repository/commit 工作台割裂；用户查看多个文件历史时还会互相覆盖。需要把文件历史收敛进 Git Graph 标题栏的 document tabs，使 Git 浏览上下文连续且可并行保留多个文件历史。

## 目标与边界

- Git Graph 作为固定、不可关闭的首个 tab。
- 每个 `workspaceId + repositoryRoot + path` 对应一个可关闭的 File History tab；重复打开时聚焦已有 tab。
- File History 继续复用既有 path-scoped history/diff、rename identity、image/binary、retry 与 stale-response contracts。
- 入口仍来自 File Tree 与 Git Diff changed-file context menu，但打开后切换到 Git Graph 内部 tab。

## 非目标

- 不修改 backend Git command、`FileHistoryTarget` 字段或 diff renderer。
- 不引入 tab persistence、拖拽排序、跨 application restart 恢复。
- 不改变 Git Graph 的 branch、commit、worktree 与 mutation workflow。

## What Changes

- 在 Git Graph integrated title layer 增加 accessible document tab strip。
- 将 File History 从主编辑区 `centerMode` 迁移到 Git Graph 内部 multi-tab state。
- 支持多个文件历史 tab 的打开、去重、激活、关闭与相邻 tab fallback。
- 关闭最后一个文件历史 tab 后保留 Git Graph 面板，并激活固定 Git Graph tab。
- 更新 File History close semantics、responsive layout、i18n 与 focused tests。

### 技术方案对比

- **选项 A：Git Graph 内部持有 multi-tab state（采用）**。状态边界与视图归属一致，可复用现有 `FileHistoryView`，且不污染通用 editor tabs。
- **选项 B：扩展全局 editor tabs 容纳 Git Graph/File History**。能复用 editor tab framework，但会把 Git domain surface 与文件编辑生命周期耦合，关闭/切换语义复杂且影响范围更大。

## Capabilities

### New Capabilities

<!-- 本变更不新增独立 capability。 -->

### Modified Capabilities

- `file-history-view`: File History 从独立 center surface 调整为 Git Graph 内可并行打开的 document tab。
- `git-history-panel`: integrated title layer 增加固定 Git Graph tab 与多个可关闭 File History tabs。

## 验收标准

- 从 File Tree 或 Git Diff 打开文件历史时，Git Graph 面板打开并激活对应 tab。
- 同一路径重复打开不产生重复 tab；不同 repository 或 workspace 的同名路径可分别存在。
- 多个文件历史 tab 可独立切换和关闭；关闭 active tab 后激活相邻 tab，全部关闭后回到 Git Graph。
- tab 具备 `tablist/tab/tabpanel` semantics、keyboard focus 与可访问关闭名称。
- 既有 File History text/image/binary/rename/stale-response tests 继续通过。

## Impact

- Frontend navigation/state：`useGitPanelController`、AppShell Git History composition、layout center-mode cleanup。
- Git History UI：`GitHistoryPanel` props/state/view、`FileHistoryView` host header、Git History/File History styles。
- i18n 与 focused Vitest suites。
- 无新增 dependency、无 backend/API/data migration。
