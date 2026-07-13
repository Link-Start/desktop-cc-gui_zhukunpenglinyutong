## Why

消息幕布可以识别由 shell 写入产生的新增文件路径，但这类 sparse file-change fact 通常不携带 inline patch，导致新增文件行既无法展开，也无法进入已有 Git diff 审查链路。修改、删除和携带 patch 的新增文件正常，因此需要只补齐 `added + missing diff` 的可达性，避免扩大其他分支的行为面。

## 目标与边界

- 让消息幕布中缺少 inline diff 的新增文件仍可通过现有 `onOpenDiffPath` 进入 canonical Workspace Git diff。
- 已携带 inline diff 的新增文件继续在幕布内展开，不改变当前 preview 与统计逻辑。
- `modified`、`deleted`、`renamed` 以及未提供 diff navigation callback 的兼容场景保持现状。
- fallback callback 抛错时不得破坏 conversation row 的交互稳定性。

## 非目标

- 不在消息渲染链路读取工作区文件内容。
- 不从 heredoc、重定向或任意 shell command 文本重建文件正文。
- 不调整 Git backend、status panel、Git changed-file list 或现有 diff parser。
- 不恢复所有 file-change filename 的通用链接语义。

## What Changes

- 为 compact per-file row 增加显式、可选的 missing-diff fallback action。
- 仅当 file change 被归一为 `added` 且缺少 inline diff 时接入现有 `onOpenDiffPath`。
- 增加 focused tests，覆盖 fallback、已有 inline diff 和其他 change kind 的兼容边界。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `conversation-file-change-surface-parity`: 新增 sparse added-file fact 在消息幕布中必须保持 canonical Git diff 可达的 requirement。

## 方案对比

1. **复用现有 `onOpenDiffPath`（采用）**：直接进入已存在的 Workspace Git diff 数据链，改动小、与当前 canonical Git source 一致，并自然继承 untracked content 支持。
2. **幕布异步读取新增文件并合成 inline diff（不采用）**：会引入 workspace/path trust boundary、异步 race、历史 replay 与当前磁盘内容不一致等问题，且重复实现 Git diff 能力。
3. **解析 shell command 还原新文件内容（不采用）**：无法可靠覆盖 heredoc、转义、管道和工具封装，容易产生伪 diff。

## 验收标准

- 缺少 inline diff 的 `added` row 点击后调用 `onOpenDiffPath(filePath)`。
- 已有 inline diff 的 `added` row 仍只展开 inline preview，不额外触发 navigation。
- 缺少 diff 的 `modified/deleted/renamed` row 不获得新增 fallback 行为。
- 未传 `onOpenDiffPath` 时 row 保持非交互，不抛异常。
- focused Vitest、TypeScript typecheck 与 OpenSpec strict validation 通过。

## Impact

- Frontend message tool blocks：`GenericToolBlock`、共享 `FileChangeRow` 及 focused tests。
- 不新增 dependency，不修改 public IPC/API，不影响 Rust backend。
