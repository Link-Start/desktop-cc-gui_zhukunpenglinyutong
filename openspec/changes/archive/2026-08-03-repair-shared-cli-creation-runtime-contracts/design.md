## Context

Shared Session Foundation 已经定义完整 `ExecutionTarget`、Provider-scoped Model catalog、durable Attempt 与 strict dispatch receipt。现有扩展把 Kimi/Grok/OpenCode 加入了 Picker 和 dispatch，但三条边界仍沿用了历史假设：

1. Sidebar `Shared CLI` 直接调用 `onAddSharedAgent(workspace)`，AppShell 再从 `activeEngine` 与当前 Composer 读取 Target，因此创建入口没有显式 owner。
2. OpenCode Picker 通过 `opencode models` 获取 runtime catalog，而同步 Shared validator 只读取 generated fallback。
3. Kimi/Grok local launch profile 使用裸 `workspaceId`，Shared snapshot 则使用 `engine::workspace::__local_config_toml__` canonical key。

这些问题不能通过 model allowlist 或跳过 receipt comparison 修复，否则会破坏 Foundation 的 fail-closed 与 durable owner 约束。

## Goals / Non-Goals

**Goals:**

- Shared 创建入口明确选择五个受支持 CLI，并只允许 workspace 中 ready 的 CLI。
- 创建时由所选 CLI 的 local runtime catalog 生成完整 initial Target，不借用现有 Composer。
- OpenCode runtime catalog 的 last-known-good snapshot 同时服务 Picker 与同步 Shared validator。
- Kimi/Grok local launch profile 与 Shared snapshot 共享同一个 canonical Runtime key helper。
- 保持 Native 和 Shared 共用 adapter identity，同时不改变 Native 产品交互。

**Non-Goals:**

- 不在 Sidebar 复制 Provider/Model Picker。
- 不新增 runtime、Provider schema、存储迁移或依赖。
- 不允许 unlisted Model，也不降低 receipt identity 强度。

## Decisions

### 1. Shared parent action 是 submenu-only

`WorkspaceMenuAction` 增加显式的 submenu-only 语义。`Shared CLI` 点击或 hover 只打开 CLI children，不执行隐式默认创建；Native Provider 菜单继续保留现有“点击 parent 使用默认 Profile”的行为。

Alternative：全局改变所有带 children 的 parent 点击行为。拒绝，因为会无关地改变 Native 创建交互。

### 2. 创建回调显式传递 `workspace + SharedSessionSupportedEngine`

Sidebar child 通过 `onAddSharedAgent(workspace, engine)` 调用 AppShell。AppShell 使用 `getEngineModels(engine)` 取得 local runtime catalog，选择 `isDefault`，没有 default 时选择首个合法 entry，并构造：

- `engine = selected engine`
- `providerProfileId = null`
- `providerProfileSource = "disk"`（selection domain）
- `providerProfileNameSnapshot = 本地配置`
- `modelCatalogEntryId = entry.id`
- `model = entry.model || entry.id`
- `reasoning = null`

这条 resolver 不读取 `activeEngine`、当前 Model、当前 Provider 或当前 Reasoning。

Alternative：继续借用 Composer，仅在 engine 不一致时切换。拒绝，因为状态更新异步且会形成 silent target rewrite。

### 3. OpenCode 使用 process-local last-known-good runtime catalog

`status` 模块维护 OpenCode runtime Model catalog 的 process-local last-known-good snapshot。CLI detection 与显式 `load_opencode_models` 成功后原子发布；同步 Shared validator 按 `runtime snapshot > generated fallback` 读取。

Shared 创建 resolver 会先调用 `get_engine_models`，因此新会话创建和随后 send 使用同一 snapshot。应用启动 detection 也会预热 snapshot；刷新失败不清空 last-known-good。

Alternative：在所有 Shared V2 command 内重复异步执行 `opencode models`。拒绝，因为会把外部 CLI I/O 插入 Tx1/prepare/dispatch 的多个 durable boundary，放大超时和 TOCTOU。

### 4. Runtime key 只由 canonical helper 生成

Kimi/Grok local 与 managed launch profile 都调用各自 `*_runtime_key(workspace_id, profile_id)`；local 使用 canonical sentinel。Shared `provider_runtime_key_for_target` 已使用相同 helper，因此 receipt comparison 保持严格且自然通过。

Alternative：在 Shared receipt validator 中接受裸 workspace key。拒绝，因为会恢复 engine-only identity，可能把不同 Provider 的 runtime event 归错 Attempt。

## Data Flow

```text
Shared CLI
  → choose ready CLI
  → get_engine_models(selected CLI, local)
  → build complete local ExecutionTarget
  → start_shared_session(strict catalog validation)
  → begin_turn(durable target snapshot)
  → adapter launch profile(canonical runtime key)
  → engine_send_message(receipt)
  → strict receipt == durable Attempt owner
```

## Risks / Trade-offs

- [OpenCode CLI refresh 暂时失败] → 保留 last-known-good snapshot；从未成功发现且 fallback 不包含目标时继续 fail closed。
- [Shared parent 与 Native parent 点击语义不同] → 使用显式 `submenuOnly` 字段和 Overlay focused tests，避免靠 action id 特判。
- [CLI catalog 为空] → 创建前报可操作错误，不创建 partial Shared Session。
- [Runtime key 变化影响已有 Native in-memory session map] → key 只改变 Kimi/Grok local adapter owner，使其与现有 managed/canonical 规则一致；运行 focused Native manager/profile tests。

## Migration Plan

1. 先提交 OpenSpec/design artifact。
2. 实现 frontend submenu 与 initial-target resolver，运行 focused Vitest/typecheck。
3. 实现 backend catalog snapshot 与 Runtime key 修复，运行 focused Rust tests。
4. 运行 contract check、OpenSpec strict validation、`git diff --check`；不运行全量测试。
5. 无数据迁移。回滚时按批次 revert；已持久化 Shared target schema 不变。

## Open Questions

无。用户已授权采用“CLI 二级选择后立即以 local/default Target 创建”的方案。
