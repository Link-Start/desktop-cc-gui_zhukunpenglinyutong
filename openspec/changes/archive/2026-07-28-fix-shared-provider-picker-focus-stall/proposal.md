## Why

Shared Session Provider picker 在上一轮通过受控 submenu state 避免关闭，但该 state 与 Radix
内部 focus/open state 竞争，连续点击时可能卡住，且 pointer 进入 submenu 时仍可能失焦。
需要删除双 state machine，从实际 pointer focus transfer 边界修复。

## 目标与边界

- Shared CLI submenu 内连续展开、折叠、切换 Provider 时 MUST 保持响应。
- Pointer 从 CLI trigger 进入 Provider rows 时 MUST NOT 因 focus transfer 关闭 submenu。
- Keyboard、Escape、outside dismiss 与 Model terminal selection MUST 保持 Radix 原生行为。

## 非目标

- 不改变 Native 单一 CLI picker。
- 不改变 Provider catalog、ExecutionTarget 或 Provider Continuation。
- 不自绘 Popover/Menu，不新增依赖。

## What Changes

- 删除 Shared submenu 的 controlled open/pinned state。
- 在 Shared submenu 的 `onFocusOutside` 边界忽略焦点回弹到父 root content 的误关闭，
  toggle 重新统一走 cancelable `onSelect`。
- 增加快速重复点击、A/B 切换、terminal Model selection 与 Native 回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-control-surface`: Shared Provider accordion 除保持菜单打开外，还必须避免
  focus/open state 竞争导致 interaction stall。

## 技术方案取舍

- 方案 A（采用）：删除 controlled submenu，只忽略 Shared submenu 焦点回弹到父 root
  content 的 `onFocusOutside`，其余交给 Radix。单一 state owner，改动最小。
- 方案 B（不采用）：继续增强 pinned/controlled state。会扩大与 Radix 内部状态的竞争面。
- 方案 C（不采用）：自绘 side panel。会复制定位、dismiss、keyboard 和 accessibility。

## 验收标准

- Shared Provider A/B 可连续快速切换，不关闭、不冻结。
- 同一 Provider 可反复展开/折叠。
- Model selection 提交一次并关闭 selector。
- Escape/outside dismiss 与 Native picker 原行为不变。

## Impact

- `ModelSelect.tsx`
- `ModelSelect.test.tsx`
- `composer-control-surface` spec
- 无 backend/API/storage/dependency 变更。
