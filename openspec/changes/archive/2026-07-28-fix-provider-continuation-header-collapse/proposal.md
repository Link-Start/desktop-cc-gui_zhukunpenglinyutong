## Why

Provider Continuation 的 Canvas metadata row 位于 Messages 滚动容器首部。当前会话吸底或展开
`details` 改变高度时，浏览器滚动锚定会把 `summary` 推到顶栏下方，造成折叠态被剪裁、展开后
无法再次点击折叠。该问题直接破坏来源关系的可发现性和可逆交互，需要在现有投影契约内修复。

## 目标与边界

- 保证 metadata row 折叠时完整可见。
- 保证展开后 header 仍可见、可再次折叠。
- 保持 row 位于既有 `.messages` scroller 内，不改变消息 grouping、streaming、completion 或
  scroll-anchor 数据契约。
- 仅修复 Provider Continuation Canvas projection，不扩展其他 banner/card。

## What Changes

- 将 continuation metadata row 稳定为滚动容器内的 sticky header，避免吸底和高度变化将交互
  header 推入顶栏遮挡区。
- 为 sticky surface 提供明确 stacking/background，避免下方消息穿透。
- 补充折叠、展开、再次折叠与布局 class contract 的 focused regression tests。

## 技术方案取舍

- 方案 A：在展开时调用 `scrollIntoView()`。改动局部，但首次折叠态仍可能被剪裁，且会主动改变
  用户滚动位置。
- 方案 B：让 metadata row 在既有 scroller 内使用 `position: sticky`。同时覆盖初始剪裁和展开后
  header 丢失，不新增 state 或 imperative scroll side effect。

选择方案 B；它保持原生 `<details>` 语义，最小化行为代码和滚动副作用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: 明确 compact metadata row 在折叠和展开状态下都必须保留可见、
  可操作 header，且不得被 Canvas 顶栏剪裁。

## 验收标准

- 折叠态完整显示 row header，不被 Canvas 顶栏遮挡。
- 展开后 header 仍在可视区域，用户可再次点击并恢复折叠态。
- 来源导航继续可用；来源缺失时继续 disabled 并显示解释。
- focused Vitest、TypeScript typecheck、lint 与 change-level strict validation 通过。

## 非目标

- 不修改 Provider Continuation backend、catalog、source navigation 或创建流程。
- 不改变普通 Session 的 Messages DOM。
- 不引入新 dependency，不重构全局滚动/吸底算法。

## Impact

- Frontend component:
  `src/features/shared-session/components/ProviderContinuationContextCard.tsx`
- Focused tests:
  `src/features/shared-session/components/ProviderContinuationContextCard.test.tsx`
- Behavior spec:
  `native-provider-continuation`
- API、Rust backend、storage 与 dependency 无变化。
