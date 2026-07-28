# Tasks: compose-shared-session-execution-target

## 1. Target Store 与四级 Picker（B.1）

- [x] 1.1 定义前端 `ExecutionTarget` / `TurnExecutionSnapshot` 类型（与 Rust canonical 类型对齐）
- [x] 1.2 实现 `selectedNextTarget` / `activeTurnTarget` 分离的 Target Store
- [ ] 1.3 实现四级 Picker 组件（CLI→Provider→Model→Reasoning，Provider-scoped Model Catalog）；2026-07-28 review：已有 Composer 四级选择与纯逻辑，但尚未在选择时写入 `selectedNextTarget`
- [ ] 1.4 Turn Badge 改为只读 `activeTurnTarget` 快照（Provider 删除后显示 Name Snapshot + unavailable）；2026-07-28 review：`turnBadge.ts` 尚未接入消息渲染链
- [ ] 1.5 单元测试：Picker 变化不改写历史/进行中 Turn Badge；待生产接线后的 component/integration test

## 2. bindingsByTarget 迁移（B.2）

- [x] 2.1 实现 `bindingsByTarget` 数据模型（Binding Key = engine + providerProfileId，Model 不入 Key）
- [x] 2.2 旧 `bindingsByEngine` 读取迁移：归 default-provider 语义，不猜 managed Provider
- [ ] 2.3 SharedSessionMeta 升级 schemaVersion 2：`selectedEngine → selectedTarget` 迁移、bindingsByTarget 落盘；旧字段只读迁移不删除；2026-07-28 review：迁移存在，但 meta 尚无显式 `schemaVersion: 2`
- [x] 2.4 单元测试：同 Engine 双 Provider 双 Binding、切回复用、旧数据迁移恢复（含 `selectedEngine` 迁移）

## 3. Send V2 写路径（B.3）

- [x] 3.1 feature flag：`VITE_MOSSX_SHARED_V2_SEND` + localStorage override（默认灰度，可回滚）
- [x] 3.2 Rust Send 链路贯通 `providerProfileId`（Picker → snapshot → binding → runtime dispatch）
- [x] 3.3 Tx1：runtime side effect 前 Commit `conversation.turnRequested` + `TurnExecutionSnapshot`
- [ ] 3.4 Target 校验：Provider unavailable / Model 出目录 → `target-unavailable`，不重路由；2026-07-28 review：当前只校验 Engine
- [ ] 3.5 Prompt 明确 ACK → Commit `conversation.turnAccepted`；ACK 不确定 → `recovery-required`，同 attempt 禁止重发；2026-07-28 已修 unknown send error fail-closed，仍缺 typed explicit prompt ACK
- [ ] 3.6 `run.settled` → 既有 assembler/sink 写 `turnCommitted`（duplicate 幂等）；推进 committed cursor（accepted cursor 属 Change C.7）；2026-07-28 review：当前由阻塞式 V0 RPC 返回后直接 commit，未接真实 `run.settled`
- [x] 3.7 V2 flag 开启期间 V0 snapshot 并行保留一个观察期（对照 + 回滚可读）
- [ ] 3.8 集成测试：V2 send 全链路（turnRequested → turnAccepted → turnCommitted，duplicate settled 单次 commit）；现有测试覆盖 core/synthetic path，待真实 runtime event 边界

## 4. Durable Provisioning（B.4）

- [ ] 4.1 Provisioning 状态机持久化到 `shared_binding_state.provisioning_json`（prepared→creating→ready/recovery-required）；2026-07-28 review：新 Binding 首次 begin 直接写 creating，prepared/identity ACK 边界未完整接线
- [x] 4.2 ACK 不确定 → `recovery-required`，禁止盲目重建；显式重建归档旧 Binding
- [ ] 4.3 Probe 路径：native session/run identity 探测定性；2026-07-28 review：当前只读本地 durable facts，未探测 native runtime
- [ ] 4.4 Fault-injection 测试（复用 A1.5 测试台）：强杀 provisioning 窗口不产生第二个同 Target Binding；当前只有重复 begin synthetic test

## 5. Owner Routing（B.5）

- [ ] 5.1 owner 键从 EngineType 升级为 ExecutionTarget（Interrupt / Approval / Pending Rebind / Recovery）；2026-07-28 review：Approval/Pending Rebind/Recovery 已接，Claude Interrupt 仍只按 engine/turn
- [ ] 5.2 单元测试：同 Engine 双 Provider 并行操作不串线；待补 Interrupt 与真实 command routing 覆盖

## 6. UI 状态机（B.6）

- [x] 6.1 `sendStateMachine` 纯函数九状态 transition（§14.5.2）
- [x] 6.2 Composer 按状态渲染：非 Idle 锁 Picker；`recovery-required` 锁整个 Shared Session
- [ ] 6.3 `degraded-context` 展示 omissions/mode，未经确认不发送；2026-07-28 review：只有状态机/UI test，真实 Send 尚无 `lossyProjection` 输入
- [ ] 6.4 `cancel-pending` 按 `cancelPendingDelivery` capability 启用/禁用 Cancel；当前 capability 常量固定 false
- [x] 6.5 重启恢复：running/settling/recovery-required 从 durable evidence 恢复，不落 idle；2026-07-28 校准为只有 `turnAccepted` evidence 才恢复 running，单纯 creating fail closed
- [ ] 6.6 单元测试覆盖本 change 范围内的 §14.5.6 UX 验收（Retry/Regenerate 审计条款已列入非目标，不在本 change 覆盖）

## 7. Gate 4 验证

- [ ] 7.1 Gate 4 矩阵测试：`Claude/Official → Claude/OpenRouter → Codex/OpenAI → Claude/Official`（一个 Sidebar Row、三个 Hidden Binding、切回复用、Provenance 正确、失败不重路由）；现有 Rust test 只覆盖 storage/core matrix，不能替代 UI + runtime 验收
- [x] 7.2 `cargo test --manifest-path src-tauri/Cargo.toml` 全量（1658 passed；`runtime::tests` 2 个 process-group kill 失败为 macOS 环境性问题，HEAD 基线同现，非本 change 引入）
- [x] 7.3 `npm run test` Shared 相关套件 + `npm run typecheck`（`tauri.test.ts` 5 个与 `useThreadMessaging.test.tsx` 10 个失败属 OpenCode/Gemini retirement 进行中迁移的 HEAD 基线失败，非本 change 引入）
- [x] 7.4 `openspec validate compose-shared-session-execution-target --strict --no-interactive`
- [x] 7.5 更新 master checklist Wave 4 状态
- [x] 7.6 Commit 并记录 Trellis session

## 8. 2026-07-28 Review 校准

- [x] 8.1 Composer 当前 Provider/Model/Reasoning 选择写入 Shared `ExecutionTarget`，managed Provider 不再静默落到 default
- [x] 8.2 无 typed negative ACK 的 runtime send error 改为 `recovery-required`，不伪造 `turnCommitted(failed)`
- [x] 8.3 Shared 非 idle 时补齐 Reasoning 锁定
- [x] 8.4 重启恢复只把 durable `turnAccepted` 视为 running 证据
- [x] 8.5 回退虚假完成状态，并同步 master checklist
