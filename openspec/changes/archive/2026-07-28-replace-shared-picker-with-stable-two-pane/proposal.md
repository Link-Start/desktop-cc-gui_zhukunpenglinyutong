## Why

Shared Session 当前把 CLI 列表与 Provider accordion 分别放进 Radix
`DropdownMenuContent` 和 `DropdownMenuSubContent`。真实 Tauri WebView 中，点击
Provider row 会触发 nested focus scope 的 dismiss，导致 submenu 消失；继续拦截
`onFocusOutside` 又会与 Radix state machine 竞争并出现卡顿。该结构已连续两次修补失败，
必须移除根因，而不是继续增加事件补丁。

## 目标与边界

- Shared Session MUST 在一个 `DropdownMenuContent` focus scope 内展示 CLI 与 Provider/Model。
- 左侧 CLI、右侧 Provider/Model MUST 保持图 2 的双栏信息结构。
- Provider 与 Model list MUST 互斥折叠，非 terminal 操作 MUST 保持菜单打开。
- Model terminal selection MUST 沿用现有 `ExecutionTarget` 与 Provider Continuation flow。

## 非目标

- 不改变 Native 单一 CLI picker。
- 不改变 Provider catalog、ExecutionTarget schema 或 backend。
- 不新增依赖，不实现自定义 floating/focus manager。

## What Changes

- Shared `targetGroups` path 删除 nested `DropdownMenuSub`。
- 同一 root menu 内渲染稳定双栏：左侧 CLI，右侧当前 CLI 的 Provider Profiles/Models。
- CLI activation 只切换右栏内容；Provider row 继续使用 cancelable `onSelect` 执行 accordion。
- 增加“单一 menu root、CLI 切换、Provider 重复折叠、terminal selection”回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-control-surface`: Shared Provider picker 必须使用单一 focus surface，禁止用
  nested submenu 承载 Provider accordion。

## 验收标准

- Shared picker DOM 中仅有一个 menu root，无 `dropdown-menu-sub-content`。
- CLI 切换不关闭 picker，右栏立即显示对应 Provider Profiles。
- Provider A/B 可反复互斥展开、折叠，无失焦、无卡死。
- Model selection 提交一次并关闭 picker。
- Native picker 与 legacy `modelGroups` 行为不变。

## Impact

- `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx`
- `src/features/composer/components/ChatInputBox/selectors/ModelSelect.test.tsx`
- `openspec/specs/composer-control-surface/spec.md`
- 无 backend/API/storage/dependency 变更。
