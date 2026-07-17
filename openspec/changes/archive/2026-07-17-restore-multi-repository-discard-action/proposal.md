## Why

多仓 Git 变更列表没有向共享 file row 传入 discard handler，导致 unstaged 文件缺少已有的 `Undo2` 回退入口。用户只能切换仓库或借助外部 Git 工具撤销改动，且同名相对路径场景容易误操作，因此需要补齐 repository-scoped 回退能力。

## What Changes

- 多仓 Git 列表的 unstaged file row 显示与单仓一致的回退 action；staged row 保持不显示。
- 复用现有 discard confirmation dialog，取消时不执行 mutation，确认后才调用 scoped revert。
- 将 `repositoryRoot + path` 作为回退 identity，确保多个仓库存在相同相对路径时只影响目标仓库。
- 成功回退后刷新 multi-repository statuses，使列表即时反映最新状态。

## 目标与边界

- 目标：恢复多仓 unstaged 文件的安全回退入口，并维持 single-repository behavior 不变。
- 边界：仅扩展 frontend callback plumbing 与现有 Tauri Git service 的调用方式，不新增 Rust command 或依赖。

## 非目标

- 不改变 staged/unstaged selection、commit、push 或 file preview behavior。
- 不新增批量跨仓库原子回退语义，也不重设计 confirmation dialog。
- 不修改 Git backend 的 revert 实现。

## 技术方案取舍

- 方案 A（采用）：复用共享 `DiffFileRow` 与现有 confirmation dialog，向 callback chain 传递显式 `repositoryRoot`。改动集中、交互一致，并能隔离同名路径。
- 方案 B（不采用）：在 `GitMultiRepositoryChanges` 内直接调用 service 并自建确认态。虽然链路较短，但会复制 dialog/mutation orchestration，增加行为漂移与测试成本。

## 验收标准

- 多仓模式每个 unstaged file row 都显示回退 icon，staged file row 不显示。
- 点击 icon 后显示 confirmation dialog；取消不调用 revert。
- 确认后以目标 repository 的 `repositoryRoot + path` 调用 revert，并刷新 repository statuses。
- 两个 repository 都存在相同 relative path 时，只回退用户点击的 repository。
- 现有单仓 discard behavior 与测试保持通过。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `multi-repository-git-commit-workspace`: 增加 repository-scoped unstaged file discard action、确认流程与刷新约束。

## Impact

- Frontend callback chain：`AppShell`、layout nodes、`GitDiffPanel`、`GitMultiRepositoryChanges`。
- 复用 `revertGitFile(workspaceId, path, repositoryRoot)` service contract，无 backend/API breaking change。
- 测试覆盖 multi-repository row action、confirmation、cancel 与同路径隔离。
