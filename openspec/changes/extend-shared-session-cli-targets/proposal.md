## Why

Shared Session V2 当前只允许 Claude Code 与 Codex CLI 作为 Turn execution target，
但 Kimi CLI、Grok CLI 与 OpenCode CLI 已具备 Native runtime、Provider binding、
Provider-scoped Model catalog 与 realtime event。用户无法在同一个 Shared Session
中把下一 Turn 切换到这三种已可执行 CLI，产品能力与底层 runtime 事实不一致。

## 目标与边界

- 将 Kimi CLI、Grok CLI、OpenCode CLI 正式接入 Shared Session 四级 Target Picker。
- 三种 CLI 必须复用 Shared V2 的 attempt-owned durable dispatch、Context Package、
  Provider-scoped Binding、terminal settlement 与 immutable provenance。
- New Home 双栏 create-session picker 同时展示并启用 Claude、Codex、Kimi、Grok、
  OpenCode。
- Native Session 现有 CLI/Provider/Model 行为保持不变。

## 非目标

- 不重新设计 Native Provider Continuation。
- 不恢复 Gemini CLI。
- 不改变 Shared Session “每个 Turn 只执行一个 Target”与“不自动 fallback”原则。
- 不引入新的视觉样式或 Provider 配置格式。
- 不运行仓库全量测试；只执行受影响模块的增量测试与 contract checks。

## What Changes

- Shared Session supported-engine contract 从 `Claude | Codex` 扩展为
  `Claude | Codex | Kimi | Grok | OpenCode`。
- Atomic Provider Target catalog 接入 Kimi/Grok/OpenCode 的 local 与 managed
  Provider Profiles，并按 `engine + providerProfileId` 懒加载 Models。
- Shared V2 Binding materialization、dispatch receipt、Runtime owner registration、
  EngineEvent ingress、terminal wait/commit 与 interrupt 路由支持新增三种 CLI。
- Home create-session target validation 与 catalog 启用同一组五种 CLI。
- Shared historical/realtime badge 继续只读取 immutable `TurnExecutionSnapshot`。
- 增加 frontend、Rust integration 与 runtime contract 的 focused regression tests。

### 方案对比与取舍

- **方案 A：只放开 Picker 列表。** 改动小，但 target validation 与 Runtime dispatch
  仍拒绝新增 CLI，属于表面支持。拒绝。
- **方案 B：为三种 CLI 各复制一套 Shared send pipeline。** 可以快速接线，但会复制
  Tx1、Binding、ACK、terminal 与 recovery 状态机，形成五套漂移实现。拒绝。
- **方案 C：扩展现有 engine-neutral Shared V2 owner，并为 CLI 差异提供窄 Adapter。**
  durable attempt、Context Package、receipt、terminal 与 commit 保持单一 contract；
  仅 Binding identity、runtime key 与 EngineEvent ingress 做 engine-specific mapping。
  采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-session-engine-selection`: Shared Session 可选择 Kimi、Grok 与 OpenCode，
  且不得静默 fallback。
- `shared-execution-target`: 新增三种 CLI 的 Provider-scoped Binding、immutable
  snapshot 与 owner routing。
- `shared-send-pipeline`: 新增三种 CLI 的 durable provisioning、dispatch receipt、
  EngineEvent terminal settlement 与 recovery。
- `composer-control-surface`: Shared 与 Home 双栏展示五种 CLI 及其 Provider/Model；
  Native Session 保持原行为。
- `model-provider-catalog-runtime`: Kimi/Grok/OpenCode 的 Provider Profile 与 Model
  catalog 可被 Atomic Shared/Home picker 按 binding scope 查询。

## Impact

- Frontend：Shared target types、target store、Composer Atomic catalog、Home creation
  target、Shared send orchestration 与 focused tests。
- Backend：`shared_sessions.rs`、`shared_session_v2.rs`、
  `shared_runtime_coordinator.rs`、通用 engine event forwarder 与相关 tests。
- Runtime contract：复用现有 Tauri commands 与 Engine runtime；不新增 IPC command。
- Storage：继续使用 schema v2 与 `{engine}:{providerProfileId || default}` Binding Key，
  无数据库 migration。
- Dependencies：无新增依赖。

## 验收标准

- Shared Picker 左栏按产品顺序展示并启用 Claude、Codex、Kimi、Grok、OpenCode。
- 任一新增 CLI 的 local/managed Provider 展开后只展示自身 scoped Models。
- 选择 Kimi/Grok/OpenCode Model 后，完整 Target 可持久化、重载并用于下一 Turn。
- 新增 CLI Turn 在 Runtime side effect 前先写 `conversation.turnRequested`，发送后由
  exact Attempt owner 收敛 terminal 并只提交一次 `conversation.turnCommitted`。
- Provider、runtime Model、native session identity 与 realtime/history Badge 均来自
  同一 frozen snapshot；不存在 default CLI/Provider fallback。
- 新增 CLI 不可用、Provider 删除或 Model pair 不匹配时 fail closed，Runtime
  side effect 为零。
- Native Session 的现有 Kimi/Grok/OpenCode 行为无变化。
- 受影响增量 Vitest、Rust tests、TypeScript typecheck、runtime contracts 与
  OpenSpec strict validation 通过。
