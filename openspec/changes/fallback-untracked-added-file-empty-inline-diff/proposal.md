## Why

消息幕布当前以 `Boolean(diffText)` 判断 file-change row 是否可展开。未 `git add` 的新增文件如果携带非空但无法形成可见 preview 的 sparse / malformed patch，会进入“可展开但内容为空”的死路，同时失去已有 canonical Workspace Git diff fallback；用户因此无法从幕布审查该文件。

## 目标与边界

- normalized kind 为 `added` 的 row 在 inline preview 不可用时 MUST 继续保持 canonical Git diff 可达。
- 合法且包含可见 edit lines 的 inline diff MUST 继续在幕布内展开，并保持 lazy parsing。
- fallback MUST 复用现有 `onOpenDiffPath`，不得读取当前磁盘内容伪造 event-time inline diff。
- modified、deleted、renamed 的既有 missing-diff 行为保持不变。

## 非目标

- 不修改 Git backend、IPC payload 或右侧 Git Diff 数据源。
- 不让所有 file-change filename 恢复为通用链接。
- 不用当前 workspace snapshot 覆盖或改写历史 file-change event 的 kind/stats。
- 不为 binary、image 或 large-file diff 引入新的 preview 策略。

## What Changes

- 为 `FileChangeRow` 增加“inline preview 解析为空时转入 canonical diff”的明确交互分支。
- `GenericToolBlock` 为 normalized `added` row 保留 optional navigation callback，不再因原始 `diffText` 非空而提前移除 fallback。
- 增加 focused regression tests，覆盖合法 inline diff、缺失 diff、空 preview、非 added kind 与 callback failure。

## 方案对比与取舍

1. **采用：row 在首次激活时解析 preview，并在无可见 edit lines时调用 canonical fallback。** 保留 lazy parse 和 event-time/canonical source 边界，改动集中在现有共享 row。
2. **不采用：渲染前预解析所有 diff。** 虽可提前判断，但会破坏折叠态 lazy parse 性能守卫。
3. **不采用：读取磁盘合成新增文件 inline diff。** 会让历史事件受当前文件状态污染，并重复实现 Git backend 能力。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `conversation-file-change-surface-parity`: added-file fact 的 inline diff 非空但不可渲染时，也必须保持 canonical Git diff 可达性。

## 验收标准

- `added + valid inline diff` 点击后只展开幕布 preview，不触发 navigation。
- `added + missing inline diff` 点击后调用 `onOpenDiffPath(filePath)`。
- `added + non-empty but empty/unrenderable preview` 点击后调用 `onOpenDiffPath(filePath)`，不留下空展开体。
- modified/deleted/renamed 不获得新增 fallback 行为。
- callback 缺失或抛错时 row 保持稳定。

## Impact

- Frontend：`src/features/messages/components/toolBlocks/FileChangeRow.tsx`、`GenericToolBlock.tsx` 及 focused tests。
- OpenSpec：扩展 `conversation-file-change-surface-parity`。
- 无新增 dependency，无 backend / IPC / persistence 变更。
