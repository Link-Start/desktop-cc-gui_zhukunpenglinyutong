# unify-per-session-provider-selection — 统一三引擎 per-session 供应商选择

## Why

当前只有 Codex 引擎支持「新建会话时选择供应商 + 并行使用多个供应商」（per-session provider binding，参照 `codex-provider-scoped-session-launch`）。Claude Code 与 Kimi CLI 仍是**全局单点切换**：切换供应商会改写共享的 `~/.claude/settings.json` / `~/.kimi-code/config.toml`，影响所有 workspace 与所有并行会话。用户无法做到「会话 A 走官方 Anthropic、会话 B 走 Kimi 代理」这种并行场景，也无法在新建会话时直接选定供应商。

2026-07-26 校准：本变更依赖的 CLI foundation 已完成并归档。`engineRegistry`、runtime capability contract、logical/native/pending identity、`MossxAgentEvent` bus、message delivery semantics、`ExecutableSessionRegistry`、model/provider catalog runtime 与 controller facade 均已落地。本变更只补齐 conversation launch profile，不再新建第二套 engine registry、session identity、event bus、catalog merge 或 runtime lifecycle owner。

## What Changes

- Claude Code 引擎新增 per-session 供应商绑定：新建会话时可选择供应商（本地 settings.json / managed provider），managed binding 持久化到 thread metadata 与 workspace session catalog，该 thread 后续所有 turn 都按绑定路由。
- Claude Code 供应商生效方式从「全局写 `~/.claude/settings.json`」扩展为「**spawn 进程时按绑定注入 `ANTHROPIC_*` env**」（env 优先级高于 settings.json，无需物化目录、不影响会话历史/resume）。
- Kimi CLI 引擎新增 per-session 供应商绑定：为每个 managed provider 物化独立 `KIMI_CODE_HOME` 目录（含 config.toml），spawn 时按绑定注入 `KIMI_CODE_HOME`；runtime key 与 control/cleanup lookup 同时纳入 provider profile。
- 前端新建会话菜单：Claude Code / Kimi CLI 条目增加 Codex 同款「供应商选择」子菜单，记忆上次选择（localStorage）。
- Claude 继续复用 workspace-scoped manager（每 turn 独立 spawn，provider env 不驻留在 manager）；Kimi runtime key 扩展为 `workspace_id + provider_profile_id`，支持并行且不破坏 workspace-scoped interrupt/cleanup。
- 全局 `vendor_switch_claude_provider` / `vendor_switch_kimi_provider` 语义保留为「默认供应商」，per-session 绑定优先于它；无绑定的旧会话行为不变（非 BREAKING）。

## 目标与边界

- 三引擎在「新建会话选供应商、绑定随会话持久化、并行多供应商」上语义统一，以 Codex 已实现的能力契约为基准。
- provider selection 复用现有 `ThreadSummary.providerProfile*`、catalog stable metadata key、logical session alias 与 service bridge，不新建平行 thread/provider state。
- 只覆盖**新建会话时的供应商选择**与**绑定后的路由**；fork 换供应商本次只对齐到「继承父会话绑定」，不扩展 fork 换供应商 UI（Codex 已有的 fork 换供应商能力保持不变）。
- 保留各引擎现有的全局供应商管理 UI 与 CRUD（设置页），不改动供应商数据模型本身。

## 非目标

- 不改动供应商配置的存储结构（`~/.ccgui/config.json` 的 `claude.providers` / `kimi.providers` / `codex.providers` 保持现状）。
- 不做单会话内热切换供应商（换供应商 = 新会话）。
- 不把 provider profile 塞入 `ExecutableSessionRegistry.nativeBinding`；该字段继续只表达 engine-owned native runtime binding。provider profile 是 conversation launch configuration。
- 不迁移/隔离 Claude 会话历史目录（`~/.claude/projects` 保持共享，env-only 注入）。
- 不涉及 Gemini CLI / OpenCode。两者已按 product policy 退出新执行入口。

## 技术方案对比

| 选项 | 说明 | 取舍 |
|---|---|---|
| **A. engine-specific launch context（推荐）** | Claude 每 turn spawn 时注入 provider env；Kimi 物化 per-provider `KIMI_CODE_HOME`。绑定存 thread metadata + catalog | 复用现有 send/runtime owner；避免扩展通用 `SendMessageParams` 的 68 个 literal；不污染 executable native binding |
| B. per-provider 完整 home 物化（Codex 模式平移） | Claude 也物化独立 `CLAUDE_CONFIG_DIR` | 隔离更彻底，但会话历史/resume 依赖 `~/.claude/projects`，需同步改造历史扫描与会话恢复链路，复杂度高、回归风险大 |
| C. 把 provider 写入 `ExecutableSessionRegistry.nativeBinding` | runtime registry 同时保存 PID/native id 与 provider | 混淆 native binding 与 launch configuration；Claude registry 当前是 workspace runtime projection，不能可靠表达 per-thread binding |

选择 A：Claude 的 env 优先级机制使隔离可以用零物化成本达成；Kimi 因 CLI 只读 config.toml 而必须物化 home。catalog 保存 durable conversation binding，runtime owner 只消费解析后的 launch context。

## Capabilities

### New Capabilities

- `engine-per-session-provider-binding`: 引擎无关的 per-session 供应商绑定契约——managed binding 的持久化结构、解析顺序、pending/canonical convergence、并行 runtime/session key 与 control/cleanup 规则。

### Modified Capabilities

- `claude-provider-management`: 新增 per-session 绑定与 spawn 时 env 注入要求；全局切换降级为默认供应商语义。
- `kimi-engine-runtime`: 新增 per-session 供应商绑定与 per-provider `KIMI_CODE_HOME` 物化/注入要求。

（注：新建会话菜单的供应商子菜单要求随上述两个引擎 spec 的 delta 承载；`shared-session-engine-selection` 描述的是共享会话的引擎选择语义，不在本变更范围内。）

## Impact

- **Rust 后端**：`engine/commands.rs` + daemon bridge（`providerProfileId` request mapping）、`engine/claude.rs`（per-turn env launch context）、`engine/kimi.rs` / `engine/manager.rs`（provider home 与 runtime key/control lookup）、`session_management.rs` / `session_management_types.rs`（统一 engine provider binding map 与 catalog overlay）、`vendors/**`（复用 provider config 解析/物化）。
- **前端**：`useSidebarMenus.ts`（Claude/Kimi 子菜单）、`Sidebar.tsx`（并行加载三引擎 provider profiles）、`services/tauri/appServer.ts`（透传 `providerProfileId`）、thread messaging / start / fork / label projection。
- **兼容性**：旧会话无绑定 → 走现有全局/disk 行为，无迁移成本；`vendor_switch_*` 全局切换语义保留。

## 验收标准

1. 同一 workspace 下可同时存在两个绑定不同 managed provider 的 Claude 会话，或一个 disk/default 会话 + 一个 managed provider 会话；managed 会话互不影响。
2. 新建 Claude/Kimi 会话时可在菜单中选择供应商；选择记忆到 localStorage；已有会话的绑定不因菜单选择改变。
3. 切换全局供应商（设置页）不影响 managed-bound 会话；local/default 选择明确表示“跟随 disk/global config”，不是隔离 binding。
4. Desktop 与 remote daemon request mapping 一致；provider 删除后 managed-bound send 明确失败，不静默切换 provider。
5. 只运行相关 Rust/Vitest 增量测试、TypeScript typecheck、runtime-contract gate 与 change strict validation；不运行全量测试。
