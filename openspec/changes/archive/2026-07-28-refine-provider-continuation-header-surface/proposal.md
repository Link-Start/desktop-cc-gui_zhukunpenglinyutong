## Why

上一轮仅使用 `top-3` 固定 continuation metadata row，但 `.main .messages` 为共享顶栏布局
主动上移了 `--main-topbar-height`，导致 collapsed header 仍被 Canvas chrome 遮挡。Expanded
内容虽可用，来源操作仍以高视觉重量文字按钮出现，与 metadata row 的轻量语义不匹配。

## 目标与边界

- collapsed row 必须在主顶栏下方完整显示 lineage header。
- expanded row 保持当前精简内容和可逆折叠行为。
- 来源导航改为 icon-only action，静止态无边框、无背景，同时保留 accessible name 和 tooltip。
- 仅修改 Provider Continuation metadata projection，不改变 Messages 全局 layout/scroll contract。

## What Changes

- sticky offset 复用 `--main-topbar-height`，补偿 `.main .messages` 的负 margin。
- 将“查看来源”文字按钮收敛为无 chrome 的 icon-only navigation action。
- 增强 regression tests，锁定 topbar-aware offset、icon-only DOM 与折叠可逆性。

## 技术方案取舍

- 方案 A：取消 `.main .messages` 的全局负 margin。可从根部移除遮挡，但会改变所有会话 timeline
  与顶栏重叠关系，回归面过大。
- 方案 B：仅让 continuation row 的 sticky offset 使用
  `calc(var(--main-topbar-height) + 12px)`。精确补偿现有 layout contract，不影响普通消息。

选择方案 B。来源操作继续使用 semantic `<button>`，仅移除视觉 button chrome；直接改成裸 SVG
会失去 keyboard、disabled 和 accessible name。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: 明确 metadata header 使用主顶栏安全 offset，并要求来源导航使用
  compact icon-only action，同时保留 accessibility。

## 验收标准

- collapsed header 完整显示在 Canvas topbar 下方。
- expanded content 保持精简，header 可再次点击折叠。
- 来源入口无文字、边框和静止背景，仅显示 icon；hover/focus 可辨识。
- action 仍具备 `aria-label`、tooltip、keyboard/disabled 语义。
- focused Vitest、typecheck、lint、OpenSpec strict validation 通过。

## 非目标

- 不修改 Messages 全局 negative margin、auto-scroll 或 scroll anchoring。
- 不修改 continuation backend、catalog、title 或 source lookup。
- 不触碰 Composer、Provider picker 及其他并行工作区改动。

## Impact

- `ProviderContinuationContextCard.tsx`
- `ProviderContinuationContextCard.test.tsx`
- `messages.part1-shell.css`（仅在 utility 无法表达时使用；优先不改）
- `native-provider-continuation` behavior spec
- 无 API、Rust、storage 或 dependency 变化。
