## Why

部分 frontend shortcut fields 未进入 Rust `AppSettings` persistence contract，导致 Tauri settings save/echo 丢弃字段并触发 UI 自动还原。与此同时，用户高频访问的视图入口分散在多个快捷键分组，缺少一个置顶的常用模块配置入口。

## 目标与边界

- 修复所有现有 configurable shortcuts 的 frontend ↔ Rust JSON round-trip，确保录入、清空、重启后保持一致。
- 在 Settings → Basic → Shortcuts 顶部增加“常用模块”分组，聚合 12 个高频视图入口。
- 新增缺失的模块 shortcut actions，并复用现有 view handler 与 shared shortcut matcher。
- 新增模块 shortcut 默认值为 `null`，避免引入未经审计的平台与 editor shortcut 冲突。

## 非目标

- 不改变现有快捷键默认值。
- 不重新设计快捷键录入控件、冲突检测器或多键 sequence/chord 能力。
- 不新增第三方 dependency，不改变各模块本身的业务行为。

## What Changes

- 补齐 Rust `AppSettings` 中 frontend 已声明的 shortcut fields、serde defaults 与 round-trip tests。
- 扩展 shared shortcut metadata，增加置顶 `common` category，并允许同一 action 在常用分组与原语义分组共享展示。
- 为 Git Graph、Notes、Intent Canvas、Radar、Project Map、Browser Dock、File Compare 增加 configurable shortcut actions。
- 将新 actions 接入 AppShell 已有的 open/toggle callbacks，并保留 editable target 保护。
- 补充 i18n、focused Vitest、Rust serialization tests 与 OpenSpec behavior delta。

## 方案取舍

1. **推荐：扩展现有 shared metadata + 复用现有 handlers。** 单一 action identity 负责 setting、label、scope 与 trigger，常用分组只做 projection；修改集中且避免两套快捷键实现漂移。
2. **备选：新增独立“常用模块”配置模型。** UI 隔离更强，但会复制 shortcut persistence、matching 与 handler wiring，并引入同一模块两份配置冲突，因此不采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `app-shortcuts`: 增加完整 persistence round-trip、置顶常用模块分组，以及七个高频模块的 configurable shortcut 行为。

## Impact

- Frontend settings contract：`src/types/settings.ts`、`useAppSettings`、shortcut metadata 与 Settings UI。
- Frontend action wiring：AppShell view handlers 与 shared shortcut hook。
- Backend settings contract：`src-tauri/src/types.rs` 的 `AppSettings` serde/default/test。
- UI copy：`src/i18n/locales/*/settings.ts`。
- 无新增 dependency；旧 settings JSON 保持 backward compatible。

## 验收标准

- 当前全部 shortcut fields 自定义后经 Tauri save/echo 不丢失，关闭并重新打开 Settings 后仍显示自定义值。
- “常用模块”位于所有快捷键分组顶部，包含左右对话侧边栏、Git Graph、文件、Git、便签、Intent Canvas、雷达、Project Map、浏览器、文件对比、终端。
- 七个新增模块 actions 可配置、可清空，默认 `null`，触发时只执行对应现有 view action。
- 在 input、textarea、contenteditable、editor textbox 中不会误触 global module shortcuts。
- focused tests、Rust round-trip tests、typecheck、lint、runtime contracts 与 strict OpenSpec validation 通过。
