## Context

原 change 已把 provider binding 串通 frontend、desktop、daemon 与 runtime，但 durable write 发生在 send 启动前。Claude fork 与 Kimi 首轮的 canonical session id 只能从后续 `SessionStarted` 得到，因此只记录 pending/parent key。Kimi 多 provider runtime 又复用了 session-wide interrupt flag，使 turn-specific broadcast 产生跨 runtime false positive。

Kimi provider home 每次 send 都会物化 TOML。当前实现无 file lock，Unix temp file 先按默认 mode 创建后再 chmod，Windows replace 采用 remove + rename，存在并发竞态。

## Goals / Non-Goals

**Goals:**

- canonical identity 与 durable binding 在同一个 backend event owner 内闭环。
- Kimi turn interrupt 只影响真实 child owner，失败不丢 owner。
- provider home materialization 对并发、权限和 unchanged write 安全。
- catalog failure 不产生无人确认的跨 provider fallback。

**Non-Goals:**

- 不新增 provider CRUD 或 engine 类型。
- 不改变消息渲染、stream pacing 与 root state。
- 不升级 storage schema；仅新增同一 binding 的 canonical key。

## Decisions

### 1. 提取 path-only idempotent binding writer

`record_engine_provider_binding_core` 保留 workspace existence gate，并复用一个无需借用 `AppState/DaemonState` 的 path-only helper。event forwarder 只捕获 `storage_path/workspace_id/binding` 的 owned clone；收到 `SessionStarted` 时写 canonical key。

替代方案是 frontend 新增 migration IPC。拒绝原因：durable correctness 不应依赖 reducer side effect，且会增加 desktop/daemon command surface。

### 2. Kimi interrupt 以 child lookup 成功为标记条件

`interrupt_turn` 在 active map 中找到目标 child 后才设置 interrupted marker；kill 成功后才移除 owner。未命中 runtime 返回幂等成功但不污染状态。

替代方案是 manager 预扫描 turn owner。拒绝原因：需要暴露额外 lookup API，仍无法解决 session 内 owner-removal-before-kill。

### 3. TOML writer 内部统一 lock + secure temp

`materialize_kimi_provider_at` 自己持有 `with_storage_lock(config_path)`，保证所有 caller 均受保护。Unix 使用 `OpenOptionsExt::mode(0o600)` 从创建瞬间限制权限；所有失败路径清理 temp。内容未变化时只校验权限，不 replace。

### 4. remembered managed selection fail closed

若 catalog 未加载或 remembered id 已不在返回列表，菜单保留一个 unavailable/synthetic managed option，而不是选中 local/default；同时显示 provider catalog load error。用户可显式选择 local/default，或让 missing provider send 返回可诊断错误。

## Risks / Trade-offs

- canonical binding write 发生在 event forwarder，storage failure 不回滚已启动 turn → 记录 contextual error；thread state 仍保留 binding，下一次 send 可重试 durable write。
- file lock 是同步锁 → materialization 内容相同后快速 no-op，锁仅覆盖单个 provider config path。
- remembered provider 可能已被删除 → 显示 raw id 并让 backend fail closed，避免静默改发。

## Migration Plan

1. 无 schema migration；新 canonical key 与旧 pending/parent key可并存。
2. 新 send/event 会幂等补齐 canonical key。
3. 回滚时删除本 change commit 即可；旧 metadata 仍可读取。

## Open Questions

无。
