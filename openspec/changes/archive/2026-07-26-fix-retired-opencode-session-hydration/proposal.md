## Why

OpenCode 已进入 soft-retirement，但 workspace full-catalog hydration 仍默认调用
`opencode_session_list`。2026-07-26 runtime policy 更新错误文案后，frontend 旧错误兼容不再命中，
该无效调用被记录成“内部命令失败”，形成可见的启动噪音。

## 目标与边界

- normal workspace hydration 不再调用 retired OpenCode native session IPC。
- 保留已有历史 session continuity 数据，不删除磁盘历史，不扩大到 OpenCode hard removal。
- startup owner 与 CI retirement gate 必须反映真实生产边界。

## 非目标

- 不恢复 OpenCode execution、settings 或 UI 入口。
- 不删除 OpenCode backend compatibility command、历史导入导出或磁盘数据。
- 不调整 Claude、Codex、Kimi session hydration 语义。

## What Changes

- 将 normal thread-list hydration 的 OpenCode native session inclusion 默认值改为关闭。
- 移除 `opencode_session_list` 的 startup owner 声明，避免将 retired IPC 建模为合法启动工作。
- 扩展 `check:opencode-retirement`，阻止生产 hydration 或 startup owner 重新接入该命令。
- 增加聚焦测试，验证默认 hydration 不调用 OpenCode，同时显式 compatibility 路径仍可测试。

## 方案对比与取舍

- 方案 A：仅在 frontend service 吞掉新的 retirement error。改动小，但 retired IPC 仍被执行，
  trace 语义和启动成本继续失真，拒绝。
- 方案 B：在 hydration owner 处默认关闭调用，并用 gate 固化边界。直接消除无效工作，同时保留
  显式 compatibility 能力，采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `opencode-soft-retirement-boundary`: normal startup/session hydration 不得自动调用
  `opencode_session_list`，retirement gate 必须检测回流。

## Impact

- Frontend thread hydration：`src/features/threads/hooks/useThreadActions.ts`
- Startup ownership：`src/features/startup-orchestration/utils/startupOwners.ts`
- Governance gate：`scripts/check-opencode-retirement.mjs`
- Focused tests：thread actions、startup owners、retirement gate
- 无新增依赖，无 IPC signature 变更，无 Rust payload 变更。

## 验收标准

- 打开或恢复 workspace 时不产生 `opencode_session_list` startup trace。
- retired OpenCode 不再触发运行时提示中的“内部命令失败”。
- 现有非 OpenCode session hydration 与历史 continuity 行为通过回归测试。
- `pnpm check:opencode-retirement`、focused Vitest、typecheck 与 strict OpenSpec validation 通过。
