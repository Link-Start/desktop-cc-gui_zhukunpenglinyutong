## Why

用户主动创建的 Codex / Claude Fork 被写入通用 `threadParentById` 后，Sidebar 将其误判为真实 Subagent；Codex Fork 因默认折叠而藏在父会话下，Claude Fork 在 native child session 创建前甚至完全不可见。需要恢复“Fork 是独立会话、Subagent 才是嵌套会话”的产品语义，同时保护刚完成的真实 Subagent 投影能力。

## 目标与边界

- 用户主动创建的 Codex 与 Claude Fork MUST 立即作为 Sidebar 顶层会话出现，不显示 `子代理` 标签，也不依赖父会话展开状态。
- Claude `claude-fork:*` provisional thread MUST 在首次发送并绑定 native child session 前保持运行时可见；identity migration 后继续保持顶层会话语义。
- 真实 Codex / Claude Subagent MUST 继续按 engine/runtime relationship 嵌套、标记并默认折叠。

## 非目标

- 不改变 Codex `thread/fork` 或 Claude CLI `--resume ... --fork-session` 的 backend contract。
- 不把尚未首次发送的 Claude provisional Fork 持久化为伪 native session；应用完全重启前的 draft persistence 不在本次范围。
- 不改变真实 Subagent 的发现、去重、排序、导航或折叠交互。

## What Changes

- 停止把用户 Fork 来源关系写入 Subagent 使用的 `threadParentById` projection。
- 在 workspace catalog refresh / reducer reconciliation 中保留当前可用的 Claude Fork provisional thread，直到它迁移为 canonical `claude:<childSessionId>`。
- 锁定 Claude Fork identity migration：保留 title、items 与 active state，但不得产生或继承 Subagent relationship。
- 增加 Codex Fork、Claude provisional/canonical Fork 与真实 Subagent 的互斥回归测试。

## 方案对比与取舍

1. **采用：修正关系写入边界。** 用户 Fork 不再写 `threadParentById`，真实 Subagent 仍由 engine/runtime authoritative metadata 投影。改动最小，直接消除语义污染。
2. **不采用：为 `threadParentById` 增加 relationship kind。** 虽然能同时表达 fork lineage 与 subagent ownership，但会扩大 reducer、catalog、tree UI 和 persistence contract，当前没有 Sidebar 展示 Fork lineage 的需求，违反 YAGNI。
3. **不采用：只把 Fork parent 默认展开。** 只能缓解“看不见”，仍会错误显示 `子代理`，且 Claude provisional refresh 生命周期问题仍存在。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `claude-fork-session-support`: Claude provisional 与 canonical Fork 在 Sidebar 中保持独立顶层会话，并在 native identity migration 前保持运行时可见。
- `codex-provider-scoped-session-launch`: Codex 用户 Fork 不得被 Sidebar 投影为 Subagent child。
- `subagent-session-tree-navigation`: 只有真实 engine/runtime Subagent relationship 才能产生嵌套与 `子代理` 标签，用户 Fork lineage 不得复用该投影。

## 验收标准

- Codex Fork 创建后与父会话并列显示，且无 `子代理` 标签。
- Claude Fork 点击后立即显示顶层 provisional row；首次发送并迁移到 native child id 后仍显示为顶层 row。
- catalog refresh / workspace 内切换不会在首次发送前移除当前 Claude provisional Fork。
- 真实 Subagent 仍嵌套于父会话、显示 `子代理`、默认折叠，并通过既有回归测试。

## Impact

- Frontend hooks/reducer：`src/features/threads/hooks/useThreadMessagingSessionTooling.ts`、Claude provisional reconciliation / identity migration 路径。
- Sidebar projection tests：`src/features/app/components/ThreadList.test.tsx` 及 thread action/reducer focused tests。
- 无新增依赖、无 IPC payload 变化、无 Rust backend 改动。
