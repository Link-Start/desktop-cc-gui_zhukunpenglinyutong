# Design — unify-per-session-provider-selection

## Context

### 2026-07-26 foundation calibration

前置 CLI foundation 已闭环。本变更直接复用：

- `engineRegistry` 与 runtime capability contract；
- pending / canonical / logical session identity；
- `MossxAgentEvent` bus 与 message delivery semantics；
- `ExecutableSessionRegistry` 的 process/native ownership；
- `ThreadSummary.providerProfile*` 与 workspace session catalog overlay；
- 现有 Claude / Codex / Kimi provider CRUD 与 provider catalog。

`ExecutableSessionRegistry.nativeBinding` 不承载 provider。它只描述 engine-owned native runtime binding；provider 是 conversation launch configuration。

### Current engine behavior

| Engine | 当前 provider 生效方式 | 本变更后的 per-session 方式 |
|---|---|---|
| Codex | `CODEX_HOME` + provider-scoped runtime key | 保持现状，作为行为基准 |
| Claude Code | 全局改写 `~/.claude/settings.json` | managed profile 在每个 turn spawn 时注入 env；manager 仍按 workspace 管理 |
| Kimi CLI | 全局改写 `~/.kimi-code/config.toml` | managed profile 物化独立 `KIMI_CODE_HOME`；runtime key 纳入 provider |

Claude/Kimi thread 都由前端乐观创建，首次 `engine_send_message` 才懒创建后端 runtime。因此绑定先进入 thread state，每次 send 传给后端，后端再写入 durable catalog。

## Goals / Non-Goals

### Goals

- 三引擎统一“新建会话选择 provider、managed binding 随会话持久化、并行 provider 隔离”的用户语义。
- pending → canonical rename、应用重启、desktop / daemon 两条链路均不丢 binding。
- provider 删除、runtime cleanup 失败等情况显式报错，不静默 fallback。
- 复用既有 session identity、catalog、thread metadata 与 runtime owner。

### Non-Goals

- 不做单会话内 provider 热切换。
- 不改变 provider CRUD 数据模型。
- 不隔离 Claude 历史目录。
- 不让 `ExecutableSessionRegistry` 同时承担 launch profile 存储。
- 不恢复 Gemini CLI / OpenCode 新执行入口。
- 不在本变更中按 provider 聚合 usage，也不改 composer thinking/model 数据源。

## Data Flow

1. 用户在 Claude/Kimi 新建菜单选择 provider。
2. 前端把选择写入新 thread 的既有 `providerProfile*` 字段。
3. 每次发送从 thread state 读取 `providerProfileId`，通过 desktop invoke 或 remote daemon JSON 传入 `engine_send_message`。
4. 后端按 `request managed profile > durable managed binding > default` 解析。
5. managed binding 以显式 engine + workspace owner + canonical/logical identity 写入统一 catalog map。
6. Claude 把解析结果转为 per-turn env；Kimi 把解析结果转为 provider home/runtime key。
7. pending id 收敛为 canonical id 后，thread metadata 与 catalog overlay 保留 binding；重启后 catalog 提供兜底。

## Decisions

### D1. 每次 send 携带 `providerProfileId`

`engineSendMessage`、desktop command、remote daemon router/state 增加 optional `providerProfileId`。发送端只从当前 thread state 读取，不从菜单当前选择反推。

原因：

- 消除 pending → canonical rename 的时序依赖；
- daemon 与 desktop 使用同一 request contract；
- 已有 thread metadata 是前端事实源，不需要新 store。

local/default sentinel 会被规范化为“无 managed override”，不写成隔离 binding。

### D2. 使用统一 durable engine provider binding map

把 `CodexProviderBinding` 泛化为 `EngineProviderBinding`，保留 type alias 兼容既有调用。`WorkspaceSessionCatalogMetadata` 增加 canonical `engine_provider_binding_by_session_key`。

key 必须由调用方显式提供：

- engine；
- workspace owner；
- canonical/logical session identity。

不得从无前缀 native session id 猜 engine。既有 Codex map 保留反序列化读取兼容；新 Claude/Kimi binding 只写 canonical map，避免再新增两张平行 map。

写入规则：

- 仅 managed profile 入 durable map；
- 相同值幂等跳过；
- provider 不存在时失败且错误包含 profile id；
- catalog overlay 将 binding 投影回既有 `ThreadSummary.providerProfile*`。

### D3. 不扩展通用 `SendMessageParams`

仓库有大量 `SendMessageParams` struct literal。provider 只影响 Claude/Kimi launch，不属于所有 engine 的通用 message payload。

实现采用 engine-specific launch context：

- command 层解析 effective provider；
- Claude 新增带 provider env 的专用 send/build 入口，旧入口保持兼容；
- Kimi 在获取 runtime 前解析 provider home/key；
- 不要求 68 个无关 literal 增加 `provider_profile_id: None`。

### D4. Claude 使用 per-turn env，manager 保持 workspace-scoped

从既有 Claude provider config 通过窄 helper 解析 `settingsConfig.env`：

- `None` / `__local_settings_json__`：不注入 override，继续跟随 disk/global settings；
- managed id：返回完整字符串 env map；
- provider 不存在：显式失败，不 fallback。

Claude 每个 turn 都独立 spawn，env 不驻留在 `ClaudeSessionManager`。因此 manager 继续按 workspace key 管理即可，同 workspace 不同 provider 仍能并行。

不物化 `CLAUDE_CONFIG_DIR`，避免破坏 `~/.claude/projects` history/resume。

### D5. Kimi 使用 per-provider home 与 provider-aware runtime key

复用 `vendors/kimi_providers.rs` 的 TOML 构建逻辑，将 managed provider 写入：

`~/.ccgui/kimi-provider-homes/<safe-provider-id>/config.toml`

要求：

- 与全局物化保持相同 `providers/models/default_model` 结构；
- provider path 防目录穿越/保留名；
- secret-bearing file 权限为 0600；
- `None` / `__local_config_toml__` 沿用现有 global home。

managed runtime key 使用 `workspace_id + provider_profile_id`。所有 workspace-scoped interrupt、turn interrupt、list、remove、shutdown 必须查找该 workspace 下全部 matching runtime，不能因 key 扩展漏掉 process owner。cleanup 失败显式返回并保留 owner 供诊断/重试。

### D6. 菜单复用一个 provider option contract

把 Codex-only option 泛化为 `EngineProviderProfileOption`，保留 Codex alias。`Sidebar` 并行加载 Claude/Codex/Kimi provider list，复用稳定 normalization、取消保护与显式错误状态。

Claude/Kimi 子菜单遵循 Codex 交互：

- 勾选只记忆“下一次新建会话”的选择；
- 点击父项创建会话；
- local/default 文案明确“跟随全局配置”；
- 不因菜单变化修改已有 thread 或全局 provider config。

### D7. Fork/continue 与 label 复用 thread metadata

Claude fork、Kimi continue 创建 child thread 时复制父 thread 的 `providerProfile*`。pending → canonical replacement 也必须保留这些字段。

现有 Codex provider label projection 泛化到 Claude/Codex/Kimi。只有 managed binding 显示隔离 provider 标签；local/default 不伪装成 managed binding。

### D8. Desktop 与 daemon request contract 对称

`providerProfileId` 必须同时进入：

- frontend Tauri service payload；
- desktop `engine_send_message` command；
- remote JSON request；
- daemon router；
- daemon state invocation。

任一路径缺字段都视为 contract regression，并用定向测试锁定。

## Risks / Mitigations

- **Catalog compatibility**：新增 map 使用 `serde(default)`；保留 legacy Codex map read，旧数据无需迁移。
- **Claude env 可包含代理等非 ANTHROPIC key**：与现有 provider `settingsConfig.env` 语义一致，完整注入，不另造白名单。
- **Kimi provider home 隔离 history**：managed provider 的 resume 与其 home 绑定；local/default 旧会话继续使用 global home。
- **Catalog 写放大**：仅首次或值变化时写入。
- **Root render regression**：provider list 只在 Sidebar 生命周期按事件/显式刷新加载，不进入 streaming/root 高频链路；不改 `liveAssistantTextChannel`。
- **删除 provider 后静默串线**：解析失败即终止 send，错误包含 provider id。

## Migration / Rollback

1. 先落 durable binding 与 request contract。
2. 再落 Claude env launch context。
3. 再落 Kimi materialization/runtime ownership。
4. 最后落菜单、send、fork/label projection。

旧 thread 无 managed binding，行为不变。每批独立 commit，可按反向顺序回滚。新增 catalog 字段有 default，回滚不要求数据迁移；遗留未知字段由旧 reader 忽略。

## Verification

只执行增量 gate：

- binding/catalog、Claude env、Kimi materialization/runtime control 的 targeted Rust tests；
- Sidebar/menu、thread start/send/fork/label 的 targeted Vitest；
- TypeScript typecheck；
- runtime-contract gate；
- `openspec validate unify-per-session-provider-selection --strict`；
- `git diff --check` 与每批独立 code review。

不运行全量 Rust/Vitest/lint/OpenSpec validation。
