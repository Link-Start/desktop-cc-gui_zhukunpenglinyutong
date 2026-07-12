## Why

应用真实启动时可能在 `TooltipIconButton → SidebarCollapseButton` 链路触发 React `Maximum update depth exceeded`，使整个 AppShell 被 ErrorBoundary 替换。现有 isolated rerender test 未覆盖 StrictMode 与真实 sidebar layout composition，需要修复 trigger ownership 并补齐启动级回归。

## 目标与边界

- Tooltip icon button 使用 native button + Floating UI portal，禁止进入 Radix Tooltip `PopperAnchor / SlotClone` composition。
- sidebar toggle 在 StrictMode、layout host 切换和 tooltip open/close 中不得触发 nested update loop。
- 保持 `TooltipIconButton` props、a11y label、delay 和关闭行为兼容。

## What Changes

- 删除 Base UI `render={<button />}` compatibility branch。
- `TooltipIconButton` 使用 native button 与 `@floating-ui/react-dom` 定位 popup，复用现有 tooltip visual class。
- 增加真实 `SidebarCollapseButton` + StrictMode regression test。

## 方案比较与取舍

- 方案 A：继续维护 `render` compatibility adapter，通过 memoize element/ref 缓解 churn。该方案继续保留非 Radix 标准的 clone layer，真实启动边界仍难以证明。
- 方案 B：`TooltipIconButton` 退出 Radix Tooltip orchestration，使用 native button + Floating UI，同时复用现有视觉 class。该方案从结构上移除内部 `PopperAnchor / SlotClone` 且不回退外观，采用方案 B。

## 非目标

- 不重写 ThreadList、PinnedThreadList 等未命中启动链路的普通 Radix Tooltip callers。
- 不改变 tooltip visual style、默认 delay 或 portal strategy。
- 不处理与 sidebar startup 无关的 popover/dropdown 状态。

## Capabilities

### New Capabilities

- `tooltip-icon-button-startup-stability`: 约束 Tooltip icon button 在 AppShell/sidebar 启动与 layout 变化下的 render stability。

### Modified Capabilities

- 无。

## Impact

- `src/components/ui/tooltip-icon-button.tsx` 及其 tests。
- `package.json` / `package-lock.json`: 将既有 transitive `@floating-ui/react-dom@2.1.7` 提升为 direct dependency。
- `src/features/layout/components/SidebarToggleControls.tsx` 仅作为 regression fixture，不改变产品 API。
- Backend、storage、search domain 无影响。

## 验收标准

- Tooltip icon button DOM 仍为单一 native button，无 nested button。
- StrictMode 下真实 SidebarCollapseButton 反复 rerender / open / host remount 不出现 maximum update depth。
- Tooltip focused tests、AppShell startup tests、typecheck 与 lint 通过。
