## Why

消息幕布中的 file-change row 应保持原地审查语义。Codex `apply_patch` 新增文件事件虽然携带 `*** Add File:` 与完整 `+content`，但现有 `unifiedDiffToPreview` 只识别 unified hunk，导致正文被忽略。此前把解析失败改成 Workspace Git diff navigation，错误地改变了既有 Surface 行为。

## 目标与边界

- `apply_patch` added/deleted file body MUST 被现有 inline preview adapter 转换为可渲染行。
- 携带 inline patch 的 row 激活后 MUST 留在 conversation canvas 原地展开。
- 不得新增解析失败后的隐式 Workspace Git diff navigation。
- 缺失 inline diff 时已有的 canonical fallback、其他 change kind、lazy parsing 与回合文件汇总行为保持不变。

## 非目标

- 不读取当前磁盘内容伪造历史 event-time diff。
- 不修改 Git backend、IPC payload 或右侧 Git Diff 数据源。
- 不为 binary、image、empty file 或 large-file 引入新的 preview 策略。
- 不修改 `TurnFilesChangedCard` 的完成边界与聚合口径。

## What Changes

- 回退 `FileChangeRow` 的 `onOpenUnavailablePreview` 与首次点击导航分支。
- 扩展 `unifiedDiffToPreview`，在 unified parser 没有正文时识别单文件 `*** Add File:` / `*** Delete File:` body。
- 增加 focused regression tests，锁定 apply_patch 新文件原地展开且不触发 navigation。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `conversation-file-change-surface-parity`: conversation event 已携带 patch content 时，必须在原 Surface 展示，不得以隐式导航替代。

## 验收标准

- `added + unified diff` 继续在幕布内展开。
- `added + apply_patch body` 在幕布内显示全部预览范围内的新增行。
- 点击上述 row 不调用 `onOpenDiffPath`。
- 缺失 diff 的既有 fallback 行为不变。
- “已编辑 N 个文件”汇总组件与渲染条件没有代码变更。

## Impact

- Frontend：`FileChangeRow.tsx`、`GenericToolBlock.tsx` 及 focused tests。
- OpenSpec：纠正 `conversation-file-change-surface-parity` delta。
- 无新增 dependency，无 backend / IPC / persistence 变更。
