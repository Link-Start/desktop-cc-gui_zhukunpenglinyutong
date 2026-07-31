# Proposal: compose-shared-session-execution-target

## Why

Change A（Wave 1–3）已在 dark launch 下证明 V2 链路：SQLite WAL Canonical Event Storage（A1）、Canonical Fact 装配与 Commit Sink（A2）、Shadow Projection 与 Canvas 防回归（A3）。但真实 Shared 流量仍跑 V0：Binding 只按 Engine 建索引（同 Engine 多 Provider 身份碰撞）、Send 不传 `providerProfileId`、Provisioning 无 durable 状态、UI 没有 Target 级状态机。本 change 把 Shared Session 的 Execution Target 层落到真实流量：Target 选择与快照、Target 级 Binding、V0→V2 Send 写路径切换、durable Provisioning 与恢复、Target-aware owner routing、9 状态 UI 状态机。

这是 Phase 1 dark launch 的终点：B.3 完成后 Shared 真实流量跑 V2 Canonical Log，V0 snapshot 降级为 Legacy Import Source。

## 目标与边界

- B.1：`selectedNextTarget` / `activeTurnTarget` Store 分离 + 四级 Picker（CLI→Provider→Model→Reasoning）；Picker 变化不改写历史 Turn Badge。
- B.2：`bindingsByEngine` → `bindingsByTarget` 迁移；旧 Binding 归 default-provider 语义，不猜 managed Provider；旧会话按 local/default 语义恢复。
- B.3：Send 全链路 `providerProfileId` 贯通 + Tx1 `TurnExecutionSnapshot` 固化 + V0→V2 真实写路径切换（feature flag 可回滚）。
- B.4：Durable Binding Provisioning + duplicate-create recovery（ACK 不确定 → `recovery-required`，禁止盲建）。
- B.5：Target-aware owner routing：Interrupt / Approval / Pending Rebind / Recovery 携带完整 Owner（Engine + ProviderProfile）。
- B.6：UI 状态机落地：9 状态（Idle/PreparingContext/DegradedContext/AwaitingAcceptance/CancelPending/Running/Settling/RecoveryRequired/TargetUnavailable）+ degraded-context 用户确认。
- 复用 Change A 已建成的 `shared_event_log` / canonical assembler / projection，不重建存储层。

## 非目标

- 不实现 ContextCompiler 五模式编译（Wave 5 / Change C）；B.3 的上下文交付沿用现有 bounded delta 机制，仅接入 V2 fact 落盘。
- 不实现 NativeHistoryReader / Provider Continuation（Wave 6 / Change D）。
- 不修改任何现有 Native Session 的 History/Event/Projection 链路（红线 #34：`threadItems.ts` 不动）。
- 不做自动 Provider failover；failover 必须用户显式选择。
- 不实现“运行中预选 Next Target”的 Queue contract（第一阶段 Picker 非 Idle 锁定）。
- 不实现 Retry / Regenerate 审计语义（`retryOfAttemptId`、Attempt Variant）：ACK 不确定仍禁止一键重发，显式重建 Binding 保留在本 change；Retry/Regenerate 推迟到后续 Wave 单独立项。

## What Changes

- 前端 Target Store：新增 `selectedNextTarget`（可变选择）与 `activeTurnTarget`（不可变快照）分离；四级 Picker 组件替换现有 engine-only selector。
- 前端 Binding Store：`bindingsByEngine` → `bindingsByTarget` 迁移，旧数据按 default-provider 语义归位。
- Rust Send 链路：`shared_sessions.rs` Send 路径贯通 `providerProfileId`；Tx1 先 Commit `conversation.turnRequested` + `TurnExecutionSnapshot`，再触达 Runtime；`run.settled` ACK 后由既有 assembler/sink 写 `turnCommitted`。
- Rust Provisioning：`shared_binding_state` 表承接 durable provisioning 状态机（`provisioning → ready / recovery-required`）；ACK 不确定禁止盲目重建。
- Owner routing：Interrupt/Approval/Pending Rebind/Recovery 的操作路由键从 Engine 升级为完整 Execution Target。
- 前端 UI 状态机：Shared composer 按 9 状态渲染；`degraded-context` 未经用户确认不发送；ACK ambiguous 锁定整个 Shared Session Composer。
- 新增能力 spec `shared-execution-target`、`shared-send-pipeline`；修改 `shared-session-engine-selection`。

## Capabilities

### New Capabilities

- `shared-execution-target`: ExecutionTarget 选择与快照、selectedNextTarget/activeTurnTarget 分离、bindingsByTarget、Target-aware owner routing。
- `shared-send-pipeline`: V2 Send 写路径（turnRequested durable-first、snapshot 固化、durable provisioning、acceptance/commit 两阶段）与 Shared UI 状态机。

### Modified Capabilities

- `shared-session-engine-selection`: engine-only selector 升级为 CLI→Provider→Model→Reasoning 四级 Target Picker；非 Idle 状态锁定规则替代“随时可切”。

## 技术方案取舍

| 选项 | 取舍 | 结论 |
|---|---|---|
| A. 在 V0 `shared_sessions.rs` 上就地打补丁（加 providerProfileId 字段、加状态） | 改动小但延续 §8.0 审计认定的数据面缺陷；Binding 身份碰撞与 Presentation-as-Fact 问题无法根除 | 否决 |
| B. 以 Change A 已验证的 V2 Canonical Log 为事实源，Send 链路经 Tx1/Tx2 事务边界落 fact，V0 保留为 Legacy Import Source | 与上游设计 §8.2 Send 14 步一致；dark launch 期间已用 Shadow 数据验证装配/投影正确性 | 采纳 |
| C. 一次性同时切换 Send + Context Compiler 五模式 | 范围爆炸，Wave 5 契约未建；违反“不过 Gate 不进下一 Wave” | 否决，ContextCompiler 留在 Change C |

## Impact

- Backend: `src-tauri/src/shared_sessions.rs`（Send 链路 V2 化、binding 迁移）、`src-tauri/src/shared_event_log/`（复用 writer/assembler/sink，新增 provisioning 状态读写）、`src-tauri/src/state.rs`（owner routing 键升级）。
- Frontend: `src/features/shared-session/`（Target Store、四级 Picker、UI 状态机）、`src/features/threads/`（bindingsByTarget 迁移、Send 调用点）、`src/types/conversation.ts`（Turn Badge 读取 Snapshot，只增不改）。
- 产品行为：B.3 前 Shared 仍为 V0 + Shadow；B.3 后 Shared 真实流量跑 V2（feature flag 可回滚到 V0）。
- 依赖：零新增三方依赖。前置复用：B.1 Picker 第四级（Model Catalog）复用在途 change `fix-provider-scoped-model-catalog-selection` 的 provider-scoped catalog（request 携带 `providerProfileId`、cache identity = `engineType + providerProfileId`），本 change 不重复实现 catalog scoping。

## 验收标准

- Gate 4 验收矩阵：`Claude/Official → Claude/OpenRouter → Codex/OpenAI → Claude/Official` 全程一个 Sidebar Row、三个 Hidden Binding、切回复用原 Binding、Turn Provenance 正确、任一 Provider 失败不重路由。
- Picker 在 Send 后变化不改变 Active Turn Badge（§14.5.6）。
- Prompt 明确 ACK 后记录 `conversation.turnAccepted`；ACK 不确定进入 `recovery-required`，同 attempt 禁止重发。
- ACK ambiguous 时 UI 不出现“一键重发”，且整个 Shared Session 不接受下一 Turn。
- 强杀 Provisioning 窗口不产生第二个同 Target Binding（复用 A1.5 fault-injection 测试台）。
- `cargo test --manifest-path src-tauri/Cargo.toml`、`npm run test`（Shared 相关套件）、`openspec validate compose-shared-session-execution-target --strict --no-interactive` 全部通过。
