## Why

Shared Session V2 已把对话事实可靠写入 SQLite，但 `context.deliveryPrepared` 与
`context.deliveryAccepted` 仍以缺少顶层 `type` 的旧 envelope 落盘。
`SharedProjector` 按 tagged `CanonicalFact` 读取时会在第一条 delivery fact 失败，继而让
history loader 降级为空的 Legacy snapshot，并错误触发 Native 的“当前会话需要恢复”幕布。

这会造成“标题已经从 Shared Session 更新为首条用户消息，但重开后历史为空”的假象。
实际 canonical `shared:<UUID>` identity 与 durable events 都还存在，断裂发生在 projection
decode 与 Shared/Native recovery ownership 边界。

## 目标与边界

- 让新写入的 delivery facts 使用统一 canonical envelope。
- 让 projector 无损读取已经落盘的 type-less delivery facts，恢复既有 Shared history。
- Shared 空历史与临时 projection 故障不得进入 Native history 永久失败锁，也不得展示
  Native recovery card。
- 标题更新只能改变 presentation metadata，不能改变 `shared:<UUID>` identity 或历史主键。
- 修改严格限定 Shared Session；Native Codex/Claude/Gemini/Kimi/OpenCode history 行为不变。

## What Changes

- `prepare_delivery` / `accept_delivery` 改用 canonical writer boundary，不再手工删除 `type`。
- Shared projector 在 payload 缺少 `type` 时，以同一 durable row 的 `fact_type` 补齐 decode
  envelope；若两者冲突则 fail closed。
- Shared history loader 只在 Legacy snapshot 真正可读时降级；canonical projection 失败且
  Legacy 为空时保留 typed failure，避免把故障伪装成正常空历史。
- 合法的空 Shared Session 作为正常空态完成加载。
- Shared projection failure 保持可重试，不写入通用 Native automatic-recovery block。
- Messages presentation 对 `shared:*` 禁止生成 Native history recovery card。

## 非目标

- 不迁移、重写或删除既有 SQLite canonical events。
- 不改变 Shared title 自动生成规则。
- 不修改 Native Session recovery card、Native history loader 或 Native runtime lifecycle。
- 不修改 Shared send terminal、Stop、Provider/Model selection 等已完成链路。
- 不引入新依赖。

## 方案对比与取舍

### 方案 A：批量迁移 SQLite，给旧 payload 回填 `type`

优点是旧数据物理格式统一；缺点是需要重写 immutable durable facts、重算 checksum，
扩大数据迁移和回滚风险。该方案违反 append-only canonical storage 的审计边界，不采用。

### 方案 B：writer 修正未来写入，projector 在 decode boundary 兼容旧 envelope

不修改旧数据，利用同一 row 的 authoritative `fact_type` 恢复 tagged envelope；新数据统一走
canonical writer。兼容逻辑集中在 projection decode boundary，风险最小，采用此方案。

### 方案 C：前端永久依赖 Legacy snapshot

只能遮蔽 projection 故障，V2 send 默认关闭 Legacy snapshot 后仍会丢失可读历史，也无法保留
canonical per-turn target provenance，不采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-canonical-projection`: canonical projection 必须兼容旧 type-less envelope，并在
  envelope 类型冲突时 fail closed。
- `shared-context-delivery`: delivery facts 必须通过统一 canonical writer 写入完整 tagged
  envelope。
- `shared-session-thread`: Shared history 恢复必须绑定稳定 `shared:<UUID>`，合法空态和
  projection 故障不得借用 Native recovery card/永久失败锁。

## 验收标准

- 包含旧 type-less delivery facts 的真实顺序事件流可以投影出后续 user/assistant items。
- 新写入 delivery facts 的 `payload_json.type` 与 `fact_type` 一致。
- 已有 Shared session 在 title 更新后仍以原 `shared:<UUID>` 重载完整历史。
- 新建空 Shared session 不显示“当前会话需要恢复”卡片。
- Shared projection 临时失败后切换回来仍会重试；Native recovery 行为保持原样。
- Rust focused tests、frontend focused Vitest、TypeScript typecheck 与 OpenSpec strict
  validation 通过。

## Impact

- Backend:
  - `src-tauri/src/shared_context/delivery.rs`
  - `src-tauri/src/shared_projection/projector.rs`
  - Shared projection/delivery focused Rust tests
- Frontend:
  - `src/features/threads/loaders/sharedHistoryLoader.ts`
  - `src/features/threads/hooks/useThreadActionsResumeThread.ts`
  - `src/features/messages/components/MessagesCore.tsx`
  - 对应 focused Vitest
- Specs:
  - `shared-canonical-projection`
  - `shared-context-delivery`
  - `shared-session-thread`
