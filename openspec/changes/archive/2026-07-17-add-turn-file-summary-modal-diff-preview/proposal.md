## Why

conversation canvas 的“已编辑 N 个文件”汇总卡已经提供稳定的回合文件清单，但文件行仍是纯展示，用户无法从结果上下文直接审查 canonical workspace diff。现有 Git panel 已具备成熟的 `modal-diff-view`，应将汇总卡接入该能力，同时保持 canvas 与中间区域不切换。

## 目标与边界

- 回合汇总卡与会话累计汇总卡中的可见文件行 MUST 可点击并支持 keyboard activation。
- 激活文件行 MUST 打开现有 Git modal diff preview 并直接最大化，不得切换 center Surface。
- staged、unstaged、untracked 文件均复用当前 Git status/diff 数据与现有 modal。
- show-more、统计聚合、完成边界与 tool-level inline diff 行为保持不变。

## 非目标

- 不新增第二套 Diff modal 或文件内容读取链路。
- 不把 tool-level `FileChangeRow` 改成 modal 入口。
- 不改变 Git stage/unstage/commit selection 行为。
- 不为已从当前 working tree 消失的历史文件伪造 diff。

## What Changes

- `TurnFilesChangedCard` 文件行改为 accessible button，并通过 dedicated callback 请求 modal preview。
- `Messages` / `MessagesTimeline` 透传独立的 `onPreviewFileDiff`，不复用 center-panel `onOpenDiffPath`。
- AppShell 建立可重复触发且携带 `maximized: true` 的 modal request，`GitDiffPanel` 根据 staged/unstaged file collection 打开现有 preview modal。
- 增加 component、wiring 与 Git modal request focused tests。

## 方案对比与取舍

1. **采用：controlled modal request 接入现有 `GitDiffPanel`。** 复用完整 diff loading、editable review、close/dirty guard 与 accessibility contract。
2. **不采用：在消息模块重新渲染 `WorkspaceEditableDiffReviewSurface`。** 会复制 Git data mapping、modal lifecycle 与 save/close 状态，增加 drift。
3. **不采用：调用 `onOpenDiffPath`。** 该 callback 语义是切换 center diff，会破坏 conversation Surface。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `conversation-file-change-surface-parity`: turn/session file summary rows gain a dedicated modal diff preview action without changing canvas Surface。
- `git-file-preview-affordance`: existing modal preview accepts a path-based external request and resolves it against current staged/unstaged files。

## 验收标准

- 点击或键盘激活汇总文件行打开 `.git-history-diff-modal`，初始即包含 `is-maximized`。
- 右侧 Git 文件行自身的 modal preview 继续默认普通尺寸。
- callback 收到完整 workspace-relative path；同一路径连续激活仍可产生新 request。
- 点击 show-more 只展开隐藏文件。
- missing callback 时行保持非交互展示；目标文件不存在时不报错、不切换 Surface。
- 两类汇总卡均接入，原有 inline diff 与汇总统计测试继续通过。

## Impact

- Frontend：messages summary card/timeline/messages、AppShell wiring、`GitDiffPanel` props/state 及 tests。
- OpenSpec：扩展两个既有 capabilities。
- 无新增 dependency，无 backend/IPC/persistence 变更。
