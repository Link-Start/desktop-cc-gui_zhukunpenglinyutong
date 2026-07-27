# Tasks: assemble-shared-canonical-facts

## 1. Canonical Fact 类型与校验（A2.1）

- [ ] 1.1 [P0, depends: A1] `shared_event_log/canonical/types.rs`：定义 `CanonicalFact` enum、`TurnExecutionSnapshot`、`CanonicalAssistantBlocks`、`AtomicToolExchange`、`CanonicalOmission`、`Outcome`、`UsageRecordedFact`、`ControlFact` 等；与 Wave 0 JSON Schema 字段一一对应。
- [ ] 1.2 [P0, depends: 1.1] `shared_event_log/canonical/validator.rs`：必填字段、枚举值、互斥条件校验；非法 payload 返回 typed `StoreError::ValidationFailed`；单元测试覆盖缺失字段 / 未知枚举 / 合法路径。

## 2. Writer API 扩展（A2.1、A2.2）

- [ ] 2.1 [P0, depends: 1.2] `writer.rs` 新增 `append_canonical_fact(session_id, fact)`：按 fact type 生成 `event_id`、`attempt_id`、`dedupe_key`，调 `append_event`；单元测试覆盖成功写入与校验失败。
- [ ] 2.2 [P0, depends: 2.1] 为每个 canonical fact 定义 idempotency key 规则：`turnRequested` / `deliveryPrepared` / `deliveryAccepted` / `turnAccepted` / `turnCommitted` / `controlFact` 走 `(session_id, attempt_id, fact_type)`；`usageRecorded` 走 `dedupe_key = usageRecordId`。

## 3. Run/Turn Assembler（A2.3、A2.5）

- [ ] 3.1 [P0, depends: 1.1] `shared_event_log/canonical/assembler.rs`：定义 `AssembledTurn` 与 `AssemblyError`；从 authoritative final snapshot 解析 assistant blocks、tool calls/results、artifacts、omissions。
- [ ] 3.2 [P0, depends: 3.1] Tool Exchange 配对：按 tool call id 配对，未配对 call → `response.status = "incomplete"`，未配对 result → 丢弃并可选记 `controlFact`；单元测试覆盖成对 / 缺 result / 缺 call。
- [ ] 3.3 [P0, depends: 3.2] Outcome 映射：completed / failed / cancelled / replaced，失败时填充 `errorCode`；测试覆盖四种 outcome。

## 4. Critical Commit Sink（A2.4）

- [ ] 4.1 [P0, depends: 2.1、3.3] `shared_event_log/canonical/sink.rs`：`commit_turn(session_id, run_id, final_snapshot)` → 组装 `turnCommitted` → `append_canonical_fact`；失败返回 typed error，不推进 settlement。
- [ ] 4.2 [P0, depends: 4.1] 幂等测试：同一 settled snapshot 提交 100 次，只有一行 `turnCommitted`；重复返回 `Duplicate`。

## 5. Usage Normalization（A2.6）

- [ ] 5.1 [P0, depends: 2.1] `usageRecorded` 写入：attempt-scoped，带 `usageRecordId` 作为 dedupe_key；同 `usageRecordId` 100 次只有一行。
- [ ] 5.2 [P0, depends: A1 ledger] `provider.usageAggregateRecorded` 写入：通过 `record_provider_usage` 进入 Ledger；验证 revision/supersedes 链；aggregate-only 无 session 字段。
- [ ] 5.3 [P0, depends: 5.1、5.2] 投影优先级测试：同一 attempt 同时存在 `runtime-final` 与 `provider-report` 时，投影选择 provider-report 且不相加。

## 6. V0 Shadow Log（A2.7）

- [ ] 6.1 [P0, depends: 2.1] `shared_event_log/canonical/shadow_v0.rs`：把 V0 final evidence 映射为 `presentation-only` canonical fact；字段缺失时允许降级，不触发校验错误。
- [ ] 6.2 [P0, depends: 6.1] 只读隔离测试：shadow facts 写入后不影响 `next_sequence` 单调性，不参与新 Turn 装配。

## 7. Gate 2 验证

- [ ] 7.1 [P0, depends: 4.2、5.3、6.2] `src-tauri/tests/assemble_canonical_facts.rs`：synthetic Runtime Events 驱动，覆盖 duplicate Terminal、dropped delta、failed/cancelled/replaced outcome、Tool Exchange 配对、Usage 分流。
- [ ] 7.2 [P0, depends: 7.1] `cargo test --manifest-path src-tauri/Cargo.toml` 相关测试全绿；`openspec validate assemble-shared-canonical-facts --strict --no-interactive` 通过。
- [ ] 7.3 [P0, depends: 7.2] 回填 `docs/plans/2026-07-27-multi-cli-provider-session-foundation-task-checklist.md` Gate 2 勾选。
