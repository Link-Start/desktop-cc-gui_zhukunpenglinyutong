# Tasks: compose-shared-session-execution-target

## 1. Target Store 与四级 Picker（B.1）

- [x] 1.1 定义前端 `ExecutionTarget` / `TurnExecutionSnapshot` 类型（与 Rust canonical 类型对齐）
- [x] 1.2 实现 `selectedNextTarget` / `activeTurnTarget` 分离的 Target Store
- [x] 1.3 实现四级 Picker 组件（CLI→Provider→Model→Reasoning，Provider-scoped Model Catalog）
- [x] 1.4 Turn Badge 改为只读 `activeTurnTarget` 快照（Provider 删除后显示 Name Snapshot + unavailable）
- [x] 1.5 单元测试：Picker 变化不改写历史/进行中 Turn Badge

## 2. bindingsByTarget 迁移（B.2）

- [x] 2.1 实现 `bindingsByTarget` 数据模型（Binding Key = engine + providerProfileId，Model 不入 Key）
- [x] 2.2 旧 `bindingsByEngine` 读取迁移：归 default-provider 语义，不猜 managed Provider
- [x] 2.3 SharedSessionMeta 升级 schemaVersion 2：`selectedEngine → selectedTarget` 迁移、bindingsByTarget 落盘；旧字段只读迁移不删除
- [x] 2.4 单元测试：同 Engine 双 Provider 双 Binding、切回复用、旧数据迁移恢复（含 `selectedEngine` 迁移）

## 3. Send V2 写路径（B.3）

- [x] 3.1 feature flag：`VITE_MOSSX_SHARED_V2_SEND` + localStorage override（默认灰度，可回滚）
- [x] 3.2 Rust Send 链路贯通 `providerProfileId`（Picker → snapshot → binding → runtime dispatch）
- [x] 3.3 Tx1：runtime side effect 前 Commit `conversation.turnRequested` + `TurnExecutionSnapshot`
- [x] 3.4 Target 校验：Provider unavailable / Model 出目录 → `target-unavailable`，不重路由
- [x] 3.5 Prompt 明确 ACK → Commit `conversation.turnAccepted`；ACK 不确定 → `recovery-required`，同 attempt 禁止重发
- [x] 3.6 `run.settled` → 既有 assembler/sink 写 `turnCommitted`（duplicate 幂等）；推进 committed cursor（accepted cursor 属 Change C.7）
- [x] 3.7 V2 flag 开启期间 V0 snapshot 并行保留一个观察期（对照 + 回滚可读）
- [x] 3.8 集成测试：V2 send 全链路（turnRequested → turnAccepted → turnCommitted，duplicate settled 单次 commit）

## 4. Durable Provisioning（B.4）

- [x] 4.1 Provisioning 状态机持久化到 `shared_binding_state.provisioning_json`（prepared→creating→ready/recovery-required）
- [x] 4.2 ACK 不确定 → `recovery-required`，禁止盲目重建；显式重建归档旧 Binding
- [x] 4.3 Probe 路径：native session/run identity 探测定性
- [x] 4.4 Fault-injection 测试（复用 A1.5 测试台）：强杀 provisioning 窗口不产生第二个同 Target Binding

## 5. Owner Routing（B.5）

- [x] 5.1 owner 键从 EngineType 升级为 ExecutionTarget（Interrupt / Approval / Pending Rebind / Recovery）
- [x] 5.2 单元测试：同 Engine 双 Provider 并行操作不串线

## 6. UI 状态机（B.6）

- [x] 6.1 `sendStateMachine` 纯函数九状态 transition（§14.5.2）
- [x] 6.2 Composer 按状态渲染：非 Idle 锁 Picker；`recovery-required` 锁整个 Shared Session
- [x] 6.3 `degraded-context` 展示 omissions/mode，未经确认不发送
- [x] 6.4 `cancel-pending` 按 `cancelPendingDelivery` capability 启用/禁用 Cancel
- [x] 6.5 重启恢复：running/settling/recovery-required 从 durable evidence 恢复，不落 idle
- [x] 6.6 单元测试覆盖本 change 范围内的 §14.5.6 UX 验收（Retry/Regenerate 审计条款已列入非目标，不在本 change 覆盖）

## 7. Gate 4 验证

- [x] 7.1 Gate 4 矩阵测试：`Claude/Official → Claude/OpenRouter → Codex/OpenAI → Claude/Official`（一个 Sidebar Row、三个 Hidden Binding、切回复用、Provenance 正确、失败不重路由）
- [x] 7.2 `cargo test --manifest-path src-tauri/Cargo.toml` 全量（1658 passed；`runtime::tests` 2 个 process-group kill 失败为 macOS 环境性问题，HEAD 基线同现，非本 change 引入）
- [x] 7.3 `npm run test` Shared 相关套件 + `npm run typecheck`（`tauri.test.ts` 5 个与 `useThreadMessaging.test.tsx` 10 个失败属 OpenCode/Gemini retirement 进行中迁移的 HEAD 基线失败，非本 change 引入）
- [x] 7.4 `openspec validate compose-shared-session-execution-target --strict --no-interactive`
- [x] 7.5 更新 master checklist Wave 4 状态
- [x] 7.6 Commit 并记录 Trellis session
