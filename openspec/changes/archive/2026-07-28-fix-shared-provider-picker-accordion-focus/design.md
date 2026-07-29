## Context

`ModelSelect` 在 Native 与 Shared 两种 surface 复用 `renderProviderProfiles`。Native 直接把
Profile items 渲染到 root `DropdownMenuContent`，Shared 则把它们放进
`DropdownMenuSubContent`。Pointer interaction 会先触发 nested submenu
`onOpenChange(false)` 并卸载内容，Profile 的 `onSelect` 尚未来得及执行，表现为右侧 CLI
submenu 消失。Native 没有 nested submenu，因此正常。

## Goals / Non-Goals

**Goals:**

- Shared Profile accordion toggle 不关闭 root menu 或当前 CLI submenu。
- 保留现有 Radix item、keyboard navigation、lazy catalog 与 mutually-exclusive state。
- Model item 选择仍关闭菜单。

**Non-Goals:**

- 不改变 Native 渲染结构。
- 不引入新的 menu primitive 或外部依赖。
- 不修改 Provider target/domain contract。

## Decisions

### 1. 只保留 Shared accordion action 触发的 submenu close

Shared CLI submenu 使用受控 `openProviderGroupId`。CLI submenu 一旦经 hover 或 keyboard
打开，就固定为当前 active submenu，避免 pointer 从 trigger 进入动态高度 content 时被
Radix grace-area 判定为离开。Profile pointer path 在 `pointerdown` 阶段完成 toggle；
keyboard path 继续由 Radix `onSelect` 处理。切换 CLI、按 Escape、关闭 root menu或选择
具体 Model 时解除固定并按既有路径关闭。

相比改成普通 `<button>`，该方案保留 Radix collection、arrow-key navigation 与 focus
management。相比永久阻止 submenu close，它只收窄到 Provider accordion interaction。

### 2. 用交互回归测试锁定 root 与 submenu 可见性

测试构造同一 Shared CLI 下两个 Profiles，逐次点击 A/B/B，断言：

- `aria-expanded` 互斥；
- 对应 Models 出现/消失；
- CLI submenu 与 root trigger 在整个 accordion 操作后保持展开；
- 具体 Model selection 仍提交并关闭。

## Risks / Trade-offs

- [Risk] pointer 与 synthesized click 重复 toggle → pointer click 被显式消费；keyboard
  synthesized click 的 `detail=0` 继续进入 Radix `onSelect`，两条路径各执行一次。
- [Risk] 测试环境的 focus 行为弱于真实 WebView → 同时断言 root/submenu DOM 和
  `aria-expanded`，并保留 Radix 原生 item contract。

## Migration Plan

无数据迁移。回滚只需移除 Shared submenu controlled state；Native path 与 domain state
不受影响。

## Open Questions

无。
