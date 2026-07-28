## 1. Shared V2 rollout 修复

- [x] 1.1 [P0][deps: none][input: `sharedV2SendFlag.ts`][output: default-on、explicit-negative rollback 三态判定][verify: focused flag Vitest] 调整 Shared V2 Send flag 语义。
- [x] 1.2 [P0][deps: 1.1][input: `sendSharedSessionTurnRouted`][output: 默认 V2、显式 V0，完整 Target 原样进入 V2][verify: focused routed-send Vitest] 锁定真实发送路由。

## 2. 完整 ExecutionTarget 持久化

- [x] 2.1 [P0][deps: none][input: `SharedSelectedTarget` 与 meta migration][output: Model、Reasoning、Provider readable snapshot 可选字段兼容读写][verify: Rust metadata migration tests] 扩展 Shared metadata target schema。
- [x] 2.2 [P0][deps: 2.1][input: Tauri selection/load command 与 frontend service][output: 完整 Target 写入并从 `load_shared_session` 返回][verify: Rust command helper tests + TypeScript typecheck] 贯通 Target 持久化 IPC。
- [x] 2.3 [P0][deps: 2.2][input: Shared history loader][output: reload 时 hydrate `selectedNextTarget`，legacy partial target 不猜值][verify: focused loader Vitest] 恢复完整 Picker Target。

## 3. 增量门禁

- [x] 3.1 [P0][deps: 1.2,2.3][input: touched frontend files][output: focused Vitest + typecheck 通过][verify: command exit 0] 执行前端增量验证。
- [x] 3.2 [P0][deps: 2.2][input: touched Rust module][output: shared session 定向 Rust tests 通过][verify: command exit 0] 执行后端增量验证。
- [x] 3.3 [P0][deps: 3.1,3.2][input: OpenSpec artifacts][output: strict validation 通过；手工 App QA 留给用户][verify: `openspec validate fix-shared-target-send-rollout --strict --no-interactive`] 完成规范与交付核对。

## 4. Provider Source Contract 重做

- [x] 4.1 [P0][deps: none][input: Foundation schema + Shared target types][output: selection `"disk" | "managed"` 与 canonical `"local" | "managed"` 分域强类型，freeze boundary 唯一转换][verify: focused target/runtime Vitest] 修复 TypeScript contract。
- [x] 4.2 [P0][deps: 4.1][input: `ExecutionTargetInput` + canonical `TurnExecutionSnapshot`][output: Rust canonical source enum；`"disk"`/unknown fail closed][verify: focused Rust serde/validator/V2 tests] 收紧 backend contract。
- [x] 4.3 [P0][deps: 4.1,4.2][input: loader + Badge compatibility][output: persisted selection source boundary validation；legacy `"disk"` 只读兼容][verify: focused loader/Badge tests] 固化 reload 与历史兼容。
- [x] 4.4 [P0][deps: 4.1,4.2,4.3][input: touched files + OpenSpec][output: focused tests、typecheck、lint、runtime-contracts、strict validate 通过][verify: command exit 0] 完成增量门禁。

## 5. Shared Composer 门禁修复

- [x] 5.1 [P0][deps: 1.2][input: Shared send state selectors + Composer/ChatInputBox][output: Input / Submit / Picker gate 分离；正常 non-idle 可编辑草稿但不能提交][verify: focused selector + ChatInputBox Vitest] 修复 V2 default-on 后输入框被全局禁用。
- [x] 5.2 [P0][deps: 5.1][input: touched frontend files + OpenSpec][output: focused Vitest、typecheck、targeted lint、strict validation 通过][verify: command exit 0] 完成增量门禁。

## 6. Shared Terminal 收口闭环

- [x] 6.1 [P0][deps: 5.1][input: runtime terminal owner matcher][output: exact `runtimeTurnId` 作为 rebind 前后稳定 owner；仅 identity 缺失时回退 `nativeThreadId`][verify: focused terminal capture Vitest] 修复 final 已显示但状态停在 `running`。
- [x] 6.2 [P0][deps: 6.1][input: Shared send restore store/hook][output: mutation revision 拒绝跨越完整 send cycle 的 stale restore response][verify: focused restore race Vitest] 防止已完成状态被旧 evidence 覆盖。
- [x] 6.3 [P0][deps: 6.1,6.2][input: production-shaped response + Composer submit gate][output: 第一轮 terminal + durable commit 后恢复 `idle`，第二轮可提交][verify: focused V2 orchestration + gate tests] 补连续两轮闭环回归。
- [x] 6.4 [P0][deps: 6.1,6.2,6.3][input: touched files + OpenSpec/Trellis contracts][output: focused Vitest、typecheck、targeted lint、strict validation 通过][verify: command exit 0] 完成增量门禁。

## 7. Attempt-owned Execution Target

- [x] 7.1 [P0][deps: 4.2][input: Shared picker/target persistence/IPC][output: `modelCatalogEntryId + runtime model` 全链路分域，Shared picker 不丢 runtime model][verify: focused ModelSelect/target Vitest + Rust pair validator tests] 修复 Model identity contract。
- [x] 7.2 [P0][deps: 7.1][input: `sendSharedSessionTurnV2` + Rust V2 command][output: V2 actual-send 不再接收 flat Target；Rust 按 `attemptId` 读取 durable `turnRequested.target`][verify: poisoned legacy fields fake-runtime test] 建立唯一 Runtime authority。
- [x] 7.3 [P0][deps: 7.2][input: prepare/accept/commit boundaries][output: Context、accept、terminal commit 均从同一 attempt 派生 Target；mismatch 在 side effect 前 fail closed][verify: focused Rust attempt ownership tests] 关闭双权威旁路。
- [x] 7.4 [P0][deps: 7.1][input: new Shared Session creation + metadata][output: 新 Session 创建前要求完整 `initialTarget`；`selectedEngine` 只作 derived legacy mirror][verify: focused frontend/Rust create tests] 关闭 Engine-only 初始状态。
- [x] 7.5 [P0][deps: 7.4][input: Shared Composer target selector + selection persistence][output: Shared 不可达 Engine-only selector；selection persist-first，失败保持旧 store Target][verify: focused Composer/service rejection tests] 关闭 selection 双权威与 memory/disk drift。

## 8. Binding 与真实 Runtime dispatch

- [x] 8.1 [P0][deps: 7.2][input: selection command + legacy meta bindings + V2 SQLite binding][output: Picker selection-only；V2 `shared_binding_state` 是唯一 routing authority][verify: picker-no-binding + same-engine-two-provider Rust tests] 统一 Binding ownership。
- [x] 8.2 [P0][deps: 8.1][input: Codex/Claude shared adapters][output: attempt-owned Provider-aware dispatch，记录 effective target/binding/runtime owner，禁止 silent fallback][verify: fake runtime switching matrix] 替换 V2 的 V0 actual-send wrapper。
- [x] 8.3 [P0][deps: 8.2][input: 当前生产可达的 interrupt/recovery/reload/rebuild][output: 所有现有控制操作按 attempt/run owner 路由；rebuild Target 从 durable Binding row 派生；Probe 真实调用 Attempt/Binding evidence API][verify: focused owner/rebuild/probe routing tests] 完成当前发送控制面闭环。
- [x] 8.4 [P0][deps: 8.2][input: Runtime event ingress + coordinator bind/fan-out][output: atomic replay barrier 保序 early/live ingress；ContextEcho 不死锁；duplicate terminal exactly-once；cancel intent 正确定性][verify: focused coordinator early-order/terminal/cancel Rust tests] 关闭 lifecycle race。
- [x] 8.5 [P0][deps: 8.3][input: send state selectors + Recovery UI][output: `recovery-required` 无 blind retry；本 Change 不伪造 Retry/Regenerate，未来入口必须另建 `new attemptId + retryOfAttemptId` contract][verify: focused send-state/Recovery tests] 锁定基石设计的 Retry 安全边界。

## 9. Canonical terminal、history 与逐轮 provenance

- [x] 9.1 [P0][deps: 8.2][input: Rust runtime lifecycle + canonical assembler][output: fan-out/drop 前收集 assistant/reasoning/tool/artifact/outcome，Rust critical sink 幂等 commit][verify: canonical terminal fixture + reload Rust tests] 补齐历史内容事实源。
- [x] 9.2 [P0][deps: 9.1][input: Shared projection data source + legacy loader][output: V2 canonical default-on；legacy dual-read 不丢历史；不读取 Native session files][verify: focused history loader/projection tests] 接管 Shared history。
- [x] 9.3 [P0][deps: 9.1,9.2][input: live events + MessageRow badge][output: 每轮 CLI/Provider/Model label 来自 attempt snapshot，failed/reload/late event 均稳定][verify: focused provenance/badge Vitest] 恢复实时与历史标识。
- [x] 9.4 [P0][deps: 9.2,9.3][input: prompt protocol classifier + projection anchors][output: exact Shared prompt echo 只隐藏重复 user transport item；reasoning/tool-only Turn 保留无正文 provenance badge][verify: focused contextProtocol/Messages/projection tests] 防止历史正文与逐轮标识再次丢失。

## 10. 增量闭环门禁

- [x] 10.1 [P0][deps: 7.5,8.3,8.4,9.4][input: frontend touched files][output: focused Vitest、typecheck、targeted ESLint、runtime-contracts 通过][verify: command exit 0] 执行 frontend 增量门禁。
- [x] 10.2 [P0][deps: 7.3,8.3,8.4,9.4][input: Rust touched modules][output: target/model/binding/dispatch/assembler/projection focused tests 通过][verify: command exit 0] 执行 backend 增量门禁。
- [x] 10.3 [P0][deps: 10.1,10.2][input: diff + OpenSpec/Trellis contracts][output: cross-layer audit、strict validation 通过；不跑全量测试][verify: `openspec validate fix-shared-target-send-rollout --strict --no-interactive`] 完成规范与交付核对。
