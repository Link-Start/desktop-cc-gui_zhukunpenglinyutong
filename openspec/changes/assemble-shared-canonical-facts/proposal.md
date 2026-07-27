# Proposal: assemble-shared-canonical-facts

## 2026-07-27 Implementation Calibration

当前只完成 Canonical types/validation、Writer、synthetic Assembler/Sink 与 Shadow mapper substrate。真实 Runtime Lifecycle Owner final snapshot ingress、`run.settled` SQLite ACK gate、run identity durable association、真实 V0 mirror 尚未接入。故本 change 保持 in-progress，Gate 2 不得关闭。

## Why

Wave 0 冻结了 Canonical Fact Schema，Wave 1（A1）建成了 SQLite WAL Canonical Event Storage，但 Shared Session V2 仍然只是把“原始 JSON 字符串”塞进 `shared_event_log`：没有 Rust 端的 Canonical Fact 类型、没有 payload 字段级校验、没有 Run/Turn 装配逻辑、没有 Commit Sink。本 change 在 A1 存储地基之上，把 Runtime 事件流装配成符合 Wave 0 Schema 的 canonical fact，并作为唯一写入口写入 SQLite，为 Wave 3 的 UI Projection 提供可信、可审计、可重放的 authoritative source。

## What Changes

- 新增 `src-tauri/src/shared_event_log/canonical/` 子模块：Canonical Fact 类型、payload 校验器、Run/Turn Assembler、Critical Commit Sink。
- 扩展 `SharedEventWriter` API：新增 `append_canonical_fact(fact: CanonicalFact)`，内部做字段级校验、checksum 计算、sequence 分配与落盘；非法或不符合 Schema 的 payload 拒绝写入并返回 typed error。
- 在 Runtime 完成/结算路径插入 Canonical Ingress：当一次 `turnRequested` 到达 terminal 状态（completed/failed/cancelled/replaced）时，组装一条 `conversation.turnCommitted` fact；当存在 usage 时，同时产出 `conversation.usageRecorded` 与 `provider.usageAggregateRecorded`（Ledger）。
- 实现 Critical Commit Sink：`run.settled` 边界推进必须与 SQLite transaction ACK 同步；重复 terminal 事件利用 A1 的幂等键保证仅有一个 Commit。
- 实现 Atomic Tool Exchange 配对验证：incomplete/error 状态必须显式结算，未配对的 Tool Call 不能落盘为成功 Tool Outcome。
- 新增 V0 final-evidence read-only mirror（Shadow Canonical Log）：把旧 Shared 会话的 final evidence 映射为 `fidelity = "presentation-only"` 的只读 canonical fact，用于 A2 装配结果对比，不回写产品状态。
- 新增集成测试：用 synthetic Runtime Events 驱动 duplicate Terminal、dropped delta、failed/cancelled outcome、Turn/Aggregate Usage 等场景。

## Capabilities

### New Capabilities

- `assemble-shared-canonical-facts`: Shared Session V2 的 Canonical Fact 装配与 Commit Sink——字段级 payload 校验、Run/Turn 装配、Tool Exchange 配对、Critical Commit Sink、Usage 分流与 V0 Shadow Log。

### Modified Capabilities

- `shared-event-storage`: Writer API 增加 canonical fact 入口与 payload 校验；事件表结构不变，但写入语义从“任意 JSON envelope”升级为“校验后的 canonical fact”。

## Impact

- Backend: `src-tauri/src/shared_event_log/canonical/`（新增类型/校验/装配/Sink）、`src-tauri/src/shared_event_log/writer.rs`（新增公开 API）、Runtime lifecycle/turn settlement 调用点（新增 Canonical Ingress 钩子）。
- 产品行为：零变化（dark launch；Shared 真实流量仍在 V0）。
- 依赖：零新增（继续使用 `rusqlite`、`serde_json`、仓库已有 `jsonschema` 或手写校验器）。
- 后续依赖：Wave 3 A3 的 UI Projection 消费本 change 产出的 canonical fact；Wave 4 B 的 Execution Target 通过本 change 固化的 `executionTarget` 与 `bindingKey` 关联 Native Binding。

## 验收标准

- Synthetic Runtime Events 驱动下：duplicate Terminal、dropped delta、failed/cancelled outcome、Turn/Aggregate Usage 全部正确落盘。
- 每个 `turnRequested` 最终只有一个 Terminal Commit；重复 terminal 返回幂等 outcome，不产生第二行。
- 非法 payload 在校验阶段拒绝，不进入 SQLite。
- V0 Shadow Log 只读，不影响现有产品状态。
- `cargo test --manifest-path src-tauri/Cargo.toml` 通过相关新增/修改测试；`openspec validate assemble-shared-canonical-facts --strict --no-interactive` 通过。
