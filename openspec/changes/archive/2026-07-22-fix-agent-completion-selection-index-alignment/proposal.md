## Why

Composer 的 `#` 智能体列表加入不可选的 section header 后，UI 使用 filtered selectable index，而 selection hook 仍用该 index 读取包含 header 的 raw provider items，导致点击或键盘选择一个智能体时实际生效为前一项。该错误会直接把错误的 agent prompt 注入消息，必须在 shared completion contract 层修复。

## 目标与边界

- 统一 shared completion dropdown 的可选项索引与 raw provider item 映射。
- 保证 mouse click、Arrow key + Enter/Tab 都返回当前可见高亮项对应的 raw item。
- 保留 section header 的展示、agent provider 数据、selection persistence 与 send payload 行为。

## 非目标

- 不调整智能体排序、分组、名称、prompt 或启用状态。
- 不修改 composer UI 样式、thread state、agent catalog IPC 或消息发送协议。
- 不新增 dependency 或新的 completion abstraction。

## What Changes

- Shared completion mapping 只将可选 dropdown item 对应的 raw provider item 放入 selection sequence。
- section header 与 separator 继续显示，但不占用 mouse/keyboard selection index。
- 增加带 section header 的 mouse index 与 keyboard active selection regression tests。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-file-reference-completion-stability`: 扩展 shared completion dropdown contract，要求 presentation-only item 不得破坏 visible selectable item 与 raw provider item 的一一对应。

## 技术方案对比

1. **推荐：在 mapping 阶段建立 selectable raw sequence。** `items` 保留全部展示项，内部 `rawItems` 仅保留可选择项。现有 `activeIndex`、`selectIndex`、`selectActive` 无需分叉，mouse 与 keyboard 自动共享同一 contract。
2. 在 agent picker 局部计算 header offset。改动表面更小，但只修 `#` mouse path，keyboard path 与未来 separator/header 仍会回归。
3. Selection 时扫描完整 `items` 再换算 raw index。行为正确，但每条 selection path 都需要映射逻辑，状态 contract 仍不直观。

选择方案 1：最小化行为分支，并把 presentation-only item 从 selection identity 中彻底排除。

## 验收标准

- 点击 header 后的任意 agent，selection handler 收到该 agent 本身。
- Arrow key 后使用 Enter 或 Tab，selection handler 收到当前高亮 agent，不会收到 header。
- 无 header 的 command/skill/prompt completion 行为保持不变。
- 单项 mapping failure 仍只跳过坏项，合法项与 raw item 保持对齐。
- focused Vitest、TypeScript typecheck 与 ESLint 全部通过。

## Impact

- Affected code: `src/features/composer/components/ChatInputBox/hooks/useCompletionDropdown.ts`
- Regression tests: `src/features/composer/components/ChatInputBox/hooks/useCompletionDropdown.test.tsx`
- Behavior spec: `composer-file-reference-completion-stability`
- API/dependencies: 无变化。
