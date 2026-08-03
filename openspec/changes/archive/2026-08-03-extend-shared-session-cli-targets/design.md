## Context

Shared Session V2 的 durable core 已经按 `EngineType`、Provider runtime key、Binding Key
和 `TurnExecutionSnapshot` 建模，但 supported-engine gate、frontend type guard、
Atomic catalog 与 Rust dispatch branches 仍只开放 Claude/Codex。Kimi/Grok/OpenCode
Native runtime 已统一产生 `EngineEvent`，并支持 provider-scoped runtime key、显式 Model
与 Session identity，因此本次应扩展 Adapter 边界，而不是复制 Shared lifecycle。

现有 Native Session 已支持三种 CLI，本变更禁止改变 Native selector 与 continuation
语义。用户明确要求只跑增量测试，实施按 frontend contract、Rust dispatch 两批提交。

## Goals / Non-Goals

**Goals:**

- Shared Session 的 supported target 集合扩展到 Claude/Codex/Kimi/Grok/OpenCode。
- Atomic catalog 为五种 CLI 提供 canonical local Profile、managed Profiles 与
  binding-scoped Models。
- 新增 CLI 复用 Tx1、Context Package、Binding provisioning、runtime receipt、
  coordinator、terminal await、canonical commit 和 recovery。
- Home create-session picker 启用同一组五种 CLI。
- 每个新增 CLI 的 Runtime event 先进入 Shared coordinator，再进入普通 UI fan-out。

**Non-Goals:**

- 不修改 Native Session。
- 不为 Gemini 恢复 Shared support。
- 不新增独立 Shared command 或复制 send pipeline。
- 不把 weak context ACK 伪装为 structured/native import。
- 不运行全量 frontend/Rust test。

## Decisions

### 1. Supported engine 使用显式 allowlist，frontend/backend 对齐

Frontend `SharedSessionSupportedEngine` 与 Rust
`ensure_supported_shared_session_engine` 同时扩展到五种 CLI。Gemini 仍 fail closed。
所有 Shared create/load/persist/send 入口复用这一 predicate。

替代方案是把 `EngineType` 全量视为 Shared-capable；这会让未来注册但尚未完成
dispatch adapter 的 CLI 自动越过安全边界，因此拒绝。

### 2. Atomic catalog 扩展 ProfileCatalog，而不是回退 legacy model groups

`ProfileCatalog` 纳入 Grok/OpenCode，并启用当前已有 Kimi。Profile loader 并行读取五种
Provider list；local sentinel 始终归类为 `disk`。`ensureModels` 对五种 Shared CLI 调用
`getEngineModels(engine, providerProfileId)`，保持 cache/request key 不变。

Shared 与 Home 使用相同 Atomic owner；Native owner 的输入与行为不改变。

### 3. Context capability 采用 user-channel transcript baseline

Kimi/Grok/OpenCode 暂无经过验证的 structured history import，因此声明
`user_channel_transcript=true`、`strong_context_ack=false`。Context Package 通过同一次
user prompt 前缀交付；runtime accepted receipt 作为 weak acceptance evidence。

禁止将 process start、静态 catalog 或未验证 CLI 参数标记为 strong context ACK。

### 4. Binding materialization 通过 engine-specific identity adapter

共享 durable state machine 保持不变；仅用窄 helper 解析：

- Provider runtime key；
- local provider sentinel；
- 初始/恢复 Native session identity；
- `engine_send_message` 所需参数。

Kimi/Grok/OpenCode 使用其现有 provider launch profile 与 runtime pool。Binding 仍以
`engine + providerProfileId` 为 key，Model 不进入 Binding identity。

### 5. Generic EngineEvent forwarder 接入 Shared coordinator

Kimi/Grok/OpenCode 现有 forwarder 已把 `EngineEvent` 转成 `AppServerEvent`。新增共享
helper 执行：

1. 用 workspace、engine、provider runtime key、runtime turn id/native session id
   ingest EngineEvent；
2. 先 publish authoritative Shared observation；
3. 若 owner 存在，将 event 投影到 Shared thread/attempt；
4. replay barrier 期间延迟 UI fan-out；
5. 非 Shared event 维持原 Native fan-out。

这样 terminal、reasoning 与 tool events 都进入现有 accumulator，不新增第二套 assembler。

### 6. Dispatch receipt 统一由 durable target 派生并严格比对

通用 engine response 必须包含 `mossxDispatchReceipt`：engine、Provider、
Provider source、provider runtime key、runtime Model、Reasoning。Shared V2 在 accept
Turn 前与 frozen owner 全字段比对。新增 CLI 不允许使用缺 receipt 的 legacy response。

### 7. Reasoning 与 collaboration 只按真实 capability传递

Kimi/Grok/OpenCode 可接收其 Native runtime 已支持的 Model/effort 字段；不支持的
collaboration mode 不伪造。Shared execution target 可以保存 `reasoning=null`。

## Risks / Trade-offs

- [Risk] 新 CLI 的 pending/native identity 在 `SessionStarted` 后变化。→ coordinator
  以 exact runtime turn id 优先认领，并用 SessionStarted observation 更新 owner；
  terminal commit 使用 settled owner 的 canonical identity。
- [Risk] generic forwarder 改动影响 Native event。→ helper 对无 Shared owner 的 event
  保持原 payload 与 emit 顺序，增加 Native no-owner focused test。
- [Risk] local sentinel 在 frontend/backend 不一致。→ 每个 CLI 用已有 constants，
  picker target 统一归一为 `providerProfileId=null + disk`，runtime boundary 再还原 sentinel。
- [Risk] OpenCode managed model 需要 `ccgui/` runtime qualification。→ catalog
  `model` 保持 backend authority，Shared dispatch 不二次按 label 推导。
- [Trade-off] 新 CLI 使用 weak user-channel context ACK，不能宣称 structured import；
  但仍保留 Context Package manifest、diagnostic 与 durable delivery evidence。

## Migration Plan

1. 扩展 OpenSpec、frontend types/catalog 与 focused tests。
2. 扩展 Rust supported-engine、runtime key、binding/dispatch receipt。
3. 将三种 EngineEvent forwarder接入 coordinator，增加 terminal/duplicate tests。
4. 运行分组增量验证后分批提交。

Rollback 可恢复 supported-engine allowlist 与新增 dispatch branches；schema v2、旧 Shared
Session 与既有 Binding rows无需迁移。新增 CLI Binding row 在旧版本中保持不可执行但不损坏。

## Open Questions

无。三种 CLI 本轮均使用已存在 Native runtime 与 Provider adapter，不引入 speculative
protocol。
