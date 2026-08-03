## Context

对话幕布通过 `groupToolItems` 将连续 edit 工具聚合成 `editGroup`，由 `EditToolGroupBlock` + `ToolMarkerShell` 渲染。当前默认 `isExpanded=true`，折叠态仍暴露计数与聚合 `+/-`，文件列表噪音打断正文阅读。

Codex 多文件 `fileChange` 走 `GenericToolBlock` → `FileChangeToolContent`，直接铺开全部 `FileChangeRow`，同样缺少场景级折叠。

## Goals / Non-Goals

**Goals:**

- 文件修改场景默认折叠，折叠态仅 `icon + 文案（含 N）`。
- 场景状态独立；streaming 时文件数增长不强制收起已展开场景。
- 展开后完整文件列表与 diff 预览能力无损。
- 键盘 Enter/Space + `aria-expanded`。
- 单文件 edit 也走同一场景折叠壳（`edit` category 长度 ≥1 即成 `editGroup`）。
- `fileChange` 多文件列表套同一场景折叠。

**Non-Goals:**

- 不持久化折叠偏好。
- 不改 `TurnFilesChangedCard` / activity / status panel。
- 不改 file-change 事实抽取与 diff 计算。

## Decisions

### D1. 复用 `ToolMarkerShell`（方案 A）

在 `EditToolGroupBlock` / `FileChangeToolContent` 上改默认折叠与文案，并给 `ToolMarkerShell` 补 a11y（`role=button` when clickable、`tabIndex=0`、`aria-expanded`、Enter/Space）。

**Alternative**：新建 `FileEditCollapsible` 完全独立 UI — 视觉更贴 HTML demo，但与 Marker 体系双轨，本期不采用。

### D2. `sceneId` / React key

- `EditToolGroupBlock` key 已由 timeline 使用 first item id（`eg-${firstItem.id}`）。
- 组件内 expanded state 为 instance-local；identity 随 first item 稳定，不使用 array index。

### D3. 单文件 edit 强制进 `editGroup`，且与 `fileChange` 同桶

`groupToolItems`：

- 场景桶 `fileEdit`：`edit` 与 `fileChange` 归并为同一 category，连续 tool 合并为一个 `editGroup`。
- 即使 `toolBuffer.length === 1` 也产出 `editGroup`，统一走折叠壳。
- explore / 正文 / 其他 tool 仍打断场景（两段正文之间的修改仍是独立场景）。

`EditToolGroupBlock`：`fileChange.changes[]` 按 path 展开为多行；同 path 多次出现时 last-wins 去重，count 按唯一文件计。

### D4. 折叠态文案

i18n key `tools.fileEditSceneCount`：`文件修改（{{count}} 个）` / `File changes ({{count}})`。  
折叠态不展示聚合 `+/-`（展开后每文件 row 仍有统计）。

### D5. 展开体样式

去掉厚边框容器（不用 `TOOL_MARKER_BODY_CLASS` 边框底），保留轻微左边距与间距，贴近极简无边框参考。

### D6. Streaming 行为

仅在 `sceneItems.length` 增长且已展开时滚动列表；**不**因 count 变化重置 `isExpanded`。

### D7. 性能 / 投影 identity（review 补丁）

- 折叠态只建立 path/status + 懒闭包；**不**在折叠时 `computeDiff` / `unifiedDiffToPreview`。
- 场景展开后才 resolve per-file stats；行级 preview 仍由 `FileChangeRow.loadDiff` 再懒加载。
- `getGroupedEntryProjectionKey(editGroup)` 仅用 `firstId`，避免 streaming 增长 remount 丢掉展开态。
- 折叠头 `trailing` 聚合 status：failed > processing > completed。
- path 轻量归一：`trim` + 去 `./` 前缀。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 默认折叠导致用户以为没改文件 | 文案含 count；chevron 可见 |
| a11y 改动影响其他 ToolMarkerShell 调用方 | 仅 clickable 时加 button 语义；显式 `role` 仍可覆盖 |
| 单文件 edit 视觉变化 | 与多文件一致，降低「有时折叠有时不折」的困惑 |
| 测试依赖默认展开 | 更新 `EditToolGroupBlock.test.tsx` 与 groupToolItems 断言 |

## Migration Plan

纯前端 UI；无 storage / IPC。回滚：恢复 `useState(true)` 与旧文案即可。

## Open Questions

- 是否在设置中暴露「默认展开文件修改」：本期不做，prop `defaultCollapsed` 可预留但非必须。
