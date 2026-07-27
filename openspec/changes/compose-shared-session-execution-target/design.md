# Design: compose-shared-session-execution-target

## Context

Change A 已建成并归档（Gate 1–3 全过，56/56 任务）：

- A1：`shared_event_log` / `shared_binding_state`（含 `provisioning_json` / `pending_delivery_json` / 两阶段 cursor 列）等六张表 + 单 Writer Actor。
- A2：Canonical Fact 装配、Critical Commit Sink、Usage 分流、V0 final-evidence Shadow mirror。
- A3：Shadow Projection、checkpoint/rebuild、Legacy dual-read、Canvas 防回归；Tauri read commands + feature-flagged DataSource 已就位。

当前真实流量仍是 V0（§8.0 审计结论）：

- `SharedSessionMeta.bindings_by_engine: HashMap<EngineType, SharedEngineBinding>` —— Binding 只按 Engine 索引，同 Engine 多 Provider 身份碰撞。
- Shared Send 不传 `providerProfileId`，实际落 disk/default Provider。
- Provisioning 无 durable 状态，崩溃窗口可能重复建 Native Session。
- Interrupt/Approval 等 owner 操作按 Engine 路由，同 Engine 双 Provider 会串线。

上游设计锚点：§5.1 ExecutionTarget、§5.2 TurnExecutionSnapshot、§5.4 SharedTargetBinding、§8.1–8.4 Send/Switch/失败语义、§14.5 UI 状态机。

## Goals / Non-Goals

Goals：B.1–B.6 全部落地并通过 Gate 4 验收矩阵；dark launch 结束但保留 feature flag 回滚到 V0。
Non-Goals：ContextCompiler（Change C）、NativeHistoryReader/Continuation（Change D）、自动 failover、运行中预选 Queue contract。

## Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | 前端两个 Target 概念分离：`selectedNextTarget`（可变，只影响下一次 Send）与 `activeTurnTarget`（Turn 创建时固化的不可变 Snapshot） | §14.5.1；禁止用 Picker 当前值改写正在运行/已完成 Turn 的 Badge |
| D2 | Binding Key = `Engine + ProviderProfileId`；Model 不进 Key | §5.4；同 CLI+Provider 换 Model 不应新建 Native Session；特殊 CLI 用 Capability 特判 |
| D3 | `bindingsByEngine` → `bindingsByTarget` 迁移：读取旧 meta 时把每个 Engine binding 归位到 `{engine, providerProfileId: None}`（local/default 语义），不猜 managed Provider | 不伪造 Provider 身份（红线：不猜接口/不假设）；旧会话可继续 |
| D4 | V0→V2 切换由 feature flag 控制（`mossx.sharedV2Send` localStorage override + `VITE_MOSSX_SHARED_V2_SEND` build flag），默认先灰度；回滚 = 关 flag 回 V0 路径 | B.3 结束 dark launch 但必须可回滚；flag 形态沿用 A3 DataSource 开关惯例 |
| D5 | Provisioning 状态机持久化在 `shared_binding_state.provisioning_json`：`prepared → creating → ready / recovery-required`；创建前先 Commit prepared，ACK 后 ready，ACK 不确定 → recovery-required | §8.2 第 6–7 步；崩溃恢复以 durable 状态为准，不靠内存 |
| D6 | ACK 不确定禁止盲目重建：进入 `recovery-required` 后只能 Probe（探测 native session/run identity）或用户显式重建；重建 = 归档旧 Binding + 新 Native Session，Shared Session Identity 不变 | §8.4；duplicate-create 是外部 side effect，必须 fail closed |
| D7 | Owner routing 键从 `EngineType` 升级为 `ExecutionTarget`（engine + providerProfileId）：Interrupt/Approval/Pending Rebind/Recovery 全部携带完整 owner | B.5；同 Engine 双 Provider 并行不串线 |
| D8 | UI 状态机按 §14.5.2 九状态实现；第一阶段 Picker 在非 Idle 锁定；`recovery-required` 锁定整个 Shared Session Composer（严格线性顺序，不按 Binding 放行） | §14.5.3；ambiguous Turn 可能迟到成为有效历史，放行会破坏 sequence 确定性 |
| D9 | B.3 上下文交付沿用现有 bounded delta 机制（V0 同款），只把 fact 落盘切到 V2；五模式编译留给 Change C | 控制范围；C.1–C.2 契约未建前不引入编译层 |
| D10 | Turn Badge/Attribution 只读 `TurnExecutionSnapshot`（含 providerProfileNameSnapshot）；Provider 被删除后显示 Name Snapshot + unavailable | §5.2 / §14.5.4；历史可解释性 |
| D11 | B 阶段只推进 committed cursor（`committedThroughSequence`）；accepted cursor 与 pendingDelivery recovery 由 Change C.7 引入。C.7 以 B 留下的 committed cursor 为基线，存量 Turn 不回填 accepted | 划清 B/C 边界，避免 C.7 重复实现或接手时无基线 |

## 结构

```text
src/features/shared-session/
  target/
    types.ts              // ExecutionTarget / TurnExecutionSnapshot TS 类型（与 Rust 对齐）
    targetStore.ts        // selectedNextTarget / activeTurnTarget 分离
    targetPicker.tsx      // 四级 Picker（CLI→Provider→Model→Reasoning）
    bindingsByTarget.ts   // bindingsByEngine → bindingsByTarget 迁移 + 读写
    sendStateMachine.ts   // §14.5.2 九状态机（纯函数 transition + selector）
src-tauri/src/
  shared_sessions.rs      // Send V2：Tx1 turnRequested+snapshot → provisioning → runtime → settled → turnCommitted
  shared_event_log/       // 复用 writer/assembler/sink；新增 provisioning 状态读写
  state.rs                // owner routing 键升级为 ExecutionTarget
```

## 关键流程（B.3 Send V2）

```text
1. 读取 selectedNextTarget；校验 Provider Availability 与 Model ∈ Provider Catalog（失败 → TargetUnavailable）
2. 固化 TurnExecutionSnapshot（providerProfileNameSnapshot 一并快照）
3. Tx1：Commit conversation.turnRequested（User Intent durable）
4. 查 bindingsByTarget；缺失 → Commit provisioning(prepared) → 创建 Native Session
5. Identity ACK → binding ready；ACK 不确定 → recovery-required（禁盲建）
6. bounded delta 上下文 + prompt 发送；turnAccepted 记录
7. run.settled → assembler/sink 写 turnCommitted；推进 committed cursor
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| V0→V2 切换后真实流量暴露 V2 缺陷 | 用户数据面 | flag 可回滚；Gate 4 矩阵先过；V0 snapshot 继续落盘一段时间作为对照 |
| bindingsByTarget 迁移误判旧 Binding 的 Provider | 旧会话绑错 Provider | 一律归 default/local 语义（D3），不猜；用户可显式重建 |
| Provisioning 崩溃窗口重复建 Native Session | 外部 side effect 泄漏 | D5/D6 durable 状态机 + recovery-required；复用 A1.5 强杀测试台验证 |
| 同 Engine 双 Provider 操作串线 | 错误 Interrupt/Approval | D7 完整 owner 键；测试覆盖双 Provider 并行 |
| Picker 锁定引发用户困惑 | UX | TargetUnavailable/recovery-required 状态文案明确；degraded-context 必须用户确认 |
| B.3 沿用 bounded delta 被误认为已完成上下文编译 | 预期错位 | checklist/文档显式标注 Change C 边界；Turn fact 记录 omissions |

## Migration Plan

1. B.1/B.2 先行（纯前端 + meta 迁移，V0 行为不变）。
2. B.3 灰度：flag 默认关；开启后新 Turn 走 V2 落盘，V0 snapshot 并行保留一个观察期。
3. B.4–B.6 随后；每一项独立测试。
4. 回滚：关 flag → V0 Send；V2 已落盘 fact 不删除（append-only），V0 读取路径不受影响。

## Open Questions

- ~~Kimi 在四级 Picker 中的可用性~~ **已关闭**：CLI 层仅开放 Codex/Claude，Kimi 沿用 `shared-session-engine-selection` 既有约束不进 Shared Picker（已写入 spec delta）；Kimi 接入待 Change C/D 按 S3 实测结论另行决策。
- V0 snapshot 并行保留观察期的截止条件：建议 Gate 4 通过后由 Change C kickoff 时决定是否停写。
