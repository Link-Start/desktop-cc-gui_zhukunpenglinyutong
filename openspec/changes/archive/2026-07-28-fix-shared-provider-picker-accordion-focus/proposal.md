## Why

Shared Session 的 model selector 在 Provider Profile accordion trigger 被点击时，会因 nested
Radix submenu 的 focus/select lifecycle 关闭整个菜单，导致用户无法稳定展开、折叠或切换
Provider Model 列表。Native 单层模式不受影响，本变更只修复 Shared 两级菜单。

## 目标与边界

- Shared Session 中点击可用 Provider Profile 后，根菜单与当前 CLI submenu MUST 保持打开。
- Provider Profile Model 列表继续互斥折叠，并保留 keyboard 与 `aria-expanded` 语义。
- Model selection 仍按既有行为关闭菜单并切换完整 `ExecutionTarget`。

## 非目标

- 不改变 Native CLI 单层 Provider picker。
- 不改变 Provider catalog lazy loading、binding normalization 或 continuation behavior。
- 不重做 DropdownMenu/Popover 基础组件。

## What Changes

- 在 Shared Provider accordion selection 期间保留当前 CLI submenu open state，避免
  Radix 把非 terminal accordion action 解释为 submenu close。
- 增加 Shared Session 点击展开、互斥切换、折叠且菜单保持可见的回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-control-surface`: 明确 Shared nested Provider accordion 操作 MUST NOT 关闭
  model selector 或当前 CLI submenu。

## 技术方案取舍

- 方案 A（采用）：保留现有 Radix 两级菜单与 `DropdownMenuItem`，显式控制当前 CLI
  submenu，并只忽略 Provider accordion selection 触发的单次 close。改动集中，并保留
  keyboard navigation 与其他 dismiss 行为。
- 方案 B（不采用）：把 Shared picker 改成 Native 单层列表。会破坏既定 CLI → Provider
  信息架构。
- 方案 C（不采用）：自绘 Popover/Menu。会复制 focus、keyboard 与 dismiss contract。

## 验收标准

- Shared picker 点击 Provider A 后，根菜单和 CLI submenu 保持打开。
- 点击 Provider B 后只展开 B；再次点击 B 后 B 折叠，菜单仍保持打开。
- 选择具体 Model 后菜单正常关闭并提交目标。
- Native picker 原有互斥折叠测试继续通过。

## Impact

- `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx`
- `src/features/composer/components/ChatInputBox/selectors/ModelSelect.test.tsx`
- `openspec/specs/composer-control-surface/spec.md`
- 无新增依赖、无 backend/API/storage 变更。
