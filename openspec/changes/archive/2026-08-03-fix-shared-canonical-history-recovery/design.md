## Context

Shared Session V2 的 history source 是 `shared_event_log`，Canvas 通过
`load_shared_projection` 将 canonical facts 投影为 `ConversationItem`。Legacy `log.jsonl`
只作为 rollback/dual-read presentation source；V2 send 默认开启时不再持续写 Legacy
snapshot。

当前 delivery state machine 为了同时提交 event 与 Binding state，手工构造
`NewCanonicalEvent`，并主动删除了 serialized `CanonicalFact.type`。这一写法与
`SharedProjector::project_events` 的 tagged-enum decode contract 不一致：projector 扫描
到第一条 type-less delivery fact 即返回错误，后续 `turnCommitted` 虽然完整存在也无法投影。

Frontend `sharedHistoryLoader` 捕获 projection error 后无条件回退 Legacy；当 Legacy 为空时，
统一 history recovery 把空数组判成 Native recovery failure，并把 thread key 写入
`automaticRecoveryFailedByScopeRef`。此后切换回来不会再自动 load，且 Messages 显示
Native recovery card。

实际数据证据表明 session UUID、Sidebar `shared:<UUID>` 与 meta id 始终一致；title 更新只改
`meta.title`，没有参与 storage lookup。

## Goals / Non-Goals

**Goals:**

- Future delivery facts 使用统一 tagged canonical envelope。
- Existing type-less delivery rows 无需迁移即可恢复 projection。
- Shared empty history 与 projection failure 分开表达。
- Shared history failure 保持可重试，不进入 Native recovery ownership。
- Shared title 更新不影响 canonical identity/history key。

**Non-Goals:**

- 不重写 durable SQLite rows/checksum。
- 不改变 title 推导、Shared send/terminal 或 Native history。
- 不删除通用 Native recovery component。

## Decisions

### Decision 1: 使用 `fact_type` 作为旧 envelope 的 decode discriminator

Projector 先把 `payload_json` 解析为 JSON object：

1. payload 已有 `type`：要求其与 row `fact_type` 一致，然后正常 decode。
2. payload 没有 `type`：复制 object，并插入 row `fact_type` 后 decode。
3. payload 不是 object，或两种类型冲突：返回 typed projection error。

`fact_type` 与 payload/checksum 都属于同一 immutable row，旧行的事实类型已经用于幂等索引和
runtime recovery，因此它是兼容 decode 的正确 discriminator。

Alternative：迁移旧 rows。拒绝，因为会改变 immutable payload/checksum 并引入数据库回滚风险。

### Decision 2: Future delivery facts 走 canonical writer actor

`prepare_delivery` 与 `accept_delivery` 继续先计算同一个 `BindingStateUpdate`，但提交使用
`append_canonical_fact_with_binding_at`。这样 event 与 binding 仍处于同一 SQLite
transaction，同时 event id、schema version、payload serialization、attempt/logical-turn
identity 全部复用统一 writer。

Alternative：保留手工 `NewCanonicalEvent`，只停止删除 `type`。虽然修复当前 bug，但继续保留
第二套 canonical serialization authority，未来新增 CLI/Fact 时容易再次漂移，因此不采用。

### Decision 3: Projection failure 不能伪装为正常 Legacy empty

Shared history loader 只有在 `legacyItems.length > 0` 时才允许 projection error 降级到
Legacy presentation snapshot。Legacy 为空时重新抛出 projection error，让 resume boundary
保留故障语义。

合法 projection 返回空数组且没有 error，代表新建空 Shared Session，可作为 loaded empty
history 正常完成。

### Decision 4: Shared recovery ownership 与 Native 隔离

`useThreadActionsResumeThreadForWorkspace` 在 Shared unified-history 路径：

- empty snapshot：clear recovery failure，记录 history restored，标记 loaded。
- loader error：记录诊断并保持 `loaded=false`，但不写
  `automaticRecoveryFailedByScopeRef`，下次 selection 可重试。
- 不继续掉入 Codex Native legacy resume RPC。

Messages presentation 以 canonical `shared:` identity 为边界，不生成
`historyRecoveryFailure` row。Native thread 继续沿用现有卡片与 retry action。

Alternative：只在 CSS/renderer 隐藏卡片。拒绝，因为底层 thread 仍被永久锁住，历史不会恢复。

### Decision 5: Title 是 presentation metadata，不是 identity alias

本变更不修改 title。测试明确固定：

```text
meta.id = UUID
summary.threadId = shared:<UUID>
meta.title = first user text
```

title 改变前后 loader 参数和 durable lookup key 必须保持 `shared:<UUID>`。

## Risks / Trade-offs

- [Risk] 为所有缺少 `type` 的旧 canonical rows 注入 discriminator 可能掩盖异常数据
  → 仅接受 JSON object；已有 `type` 冲突时 fail closed；最终仍通过强类型
  `CanonicalFact` deserialize。
- [Risk] 改变 delivery event id 格式影响幂等
  → writer 仍以 `(session_id, attempt_id, fact_type)` unique index 作为第二幂等边界；
  focused tests覆盖 duplicate append。
- [Risk] Shared loader error 不再永久 block，重复切换可能重复请求
  → 请求只在用户 selection/既有低频 refresh 边界触发，不进入轮询；错误仍可观测。
- [Risk] 合法空 Shared 与 projection error 混淆
  → loader 对 error+empty Legacy 重新抛错；只有 successful empty projection 作为正常空态。
- [Risk] Shared card 隐藏后失去恢复入口
  → Shared 本就由 canonical reload/Attempt-Binding recovery ownership 管理；selection 自动重试，
  Native card 不是有效 Shared 修复动作。

## Migration Plan

1. 上线 tolerant projector，立即恢复既有 type-less rows。
2. 上线 canonical delivery writer，停止产生新的 type-less rows。
3. 上线 Shared-specific history semantics 与 presentation gate。
4. 不执行数据库 migration；首次成功 load 会正常生成 projection checkpoint。
5. 回滚时可以按三层独立回退，但应优先保留 tolerant decode，避免旧数据再次不可读。

## Open Questions

无。现场 SQLite、meta 与 frontend diagnostics 已足够确定根因和边界。
