# Design: assemble-shared-canonical-facts

> 上游：Foundation Design §14.2（[`mossx-multi-cli-provider-session-foundation-design.md`](../../docs/research/mossx-multi-cli-provider-session-foundation-design.md)）、Wave 0 契约（`establish-session-foundation-contracts`）、Wave 1 存储地基（`establish-shared-event-storage`）。
> 本文把 §14.2 的 Canonical Turn Contract 落成 Rust 模块设计；行为语义见 `specs/assemble-shared-canonical-facts/spec.md`。

## Context

Wave 1 完成后，`SharedEventWriter` 已能可靠地写入任意 JSON envelope，但尚未理解 Canonical Fact 的语义。Runtime 事件流（stream-json、JSON-RPC、ACP）在进入存储层之前，必须被装配为符合 Wave 0 Schema 的 canonical fact：

- `conversation.turnRequested`：用户意图 + frozen `TurnExecutionSnapshot`。
- `context.deliveryPrepared` / `context.deliveryAccepted` / `conversation.turnAccepted`：Context Package 投递生命周期。
- `conversation.turnCommitted`：Terminal authoritative fact，含 Assistant blocks、Tool Exchange、Artifact Ref、Omission、Outcome。
- `conversation.usageRecorded`：attempt-scoped usage，按 `usageRecordId` 幂等。
- `conversation.controlFact`：用户取消、替换、重试等控制动作。
- `provider.usageAggregateRecorded`：不进入 Shared Event Log，写入独立 Provider Usage Ledger。

本 change 实现上述装配、校验与 Commit Sink contract。Phase 1 只由 synthetic
fixtures 与 V0 final-evidence mirror 驱动；真实 `run.settled` 接线属于 Change B。

## Goals / Non-Goals

**Goals:**

1. Rust 端定义全部 `SharedCanonicalFact` 类型，与 Wave 0 JSON Schema 一一对应。
2. `SharedEventWriter` 暴露 `append_canonical_fact`，对 payload 做字段级校验；非法 fact 拒绝落盘。
3. 实现 Run/Turn Assembler：从 Runtime authoritative final snapshot 产出 `conversation.turnCommitted`。
4. 实现 Critical Commit Sink：`run.settled` 触发一次 terminal commit，利用 A1 幂等键保证“每个 attempt 只 commit 一次”。
5. Atomic Tool Exchange 配对验证：incomplete/error 必须显式结算，未配对 Tool Call 不落盘为成功。
6. Usage normalization：`conversation.usageRecorded` 按 `usageRecordId` 幂等；`provider.usageAggregateRecorded` 进入独立 Ledger。
7. V0 final-evidence read-only mirror：生成 `fidelity = "presentation-only"` 的 shadow canonical facts，用于对比，不回写状态。

**Non-Goals:**

- 不实现 UI Projection（A3）。
- 不切换真实 Shared 流量到 V2（dark launch 纪律）。
- 不实现 Context Compiler（C）或 Provider Adapter 改造（B/C/D）。
- 不迁移旧 Native Session 数据（D）。
- 不做跨 Provider Compatibility Transformer（C3）。

## Decisions

| # | 决策 | 依据 |
|---|---|---|
| D1 | Canonical Fact 用 Rust enum + serde 表示，再序列化为 envelope JSON | 类型安全 + 与 Wave 0 Schema 对齐；A1 存储层仍保存 JSON TEXT，字段校验在写入前完成 |
| D2 | 校验层混合：结构/必填/枚举走手写 Rust 校验，复杂 JSON Schema 约束（如 `oneOf`、`if/then`）在测试中用 Wave 0 `validate.mjs` 做交叉验证 | 零新增依赖；手写校验保证运行时路径轻量，schema 交叉验证保证契约一致 |
| D3 | Assembler 只消费 Runtime Lifecycle Owner 的 authoritative final snapshot，不消费 streaming delta | Foundation §14.2.2 规则 6：delta 只进 Live Projection，Terminal Fact 才进 Canonical Log |
| D4 | Phase 1 用 synthetic fixtures 验证 Commit Sink ACK/幂等 contract；Change B 再挂接真实 `run.settled` | 遵守 dark launch，避免提前切换真实写路径 |
| D5 | Tool Exchange 配对在 Assembler 内完成：遇到未配对 Tool Call 时补 `incomplete` result，遇到未配对 Tool Result 时忽略或记 control fact | 保证 Canonical Log 不自相矛盾 |
| D6 | Usage 分两条路径：`conversation.usageRecorded` 进 Shared Event Log（attempt-scoped）；`provider.usageAggregateRecorded` 进 Provider Usage Ledger（window-scoped） | Foundation §14.2.1：Aggregate 不伪造 Session ownership |
| D7 | V0 Shadow Log 通过只读映射生成 `presentation-only` fact，不触发 A2 校验失败 | 允许旧数据形状不完全匹配新 schema，但必须在 fidelity 上诚实标记 |
| D8 | 每个 fact 的 `event_id` 由调用方按规则生成，Writer 只校验唯一性；`attemptId + factType` 幂等用于非 usage fact | Foundation §14.2.2 规则 5；A1 已建好索引 |

## Module结构

```text
src-tauri/src/shared_event_log/
  canonical/
    mod.rs          // 公开导出
    types.rs        // SharedCanonicalFact / TurnExecutionSnapshot / AtomicToolExchange / Outcome 等
    validator.rs    // payload 字段级校验
    assembler.rs    // Run/Turn Assembler + Tool Exchange 配对
    sink.rs         // Critical Commit Sink：run.settled → append turnCommitted
    shadow_v0.rs    // V0 final-evidence → presentation-only canonical fact
  writer.rs         // 新增 append_canonical_fact API
src-tauri/tests/
  assemble_canonical_facts.rs   // synthetic runtime event 驱动集成测试
```

## 关键 API

```rust
pub enum CanonicalFact {
    TurnRequested(TurnRequestedFact),
    DeliveryPrepared(DeliveryPreparedFact),
    DeliveryAccepted(DeliveryAcceptedFact),
    TurnAccepted(TurnAcceptedFact),
    TurnCommitted(TurnCommittedFact),
    UsageRecorded(UsageRecordedFact),
    Control(ControlFact),
}

pub enum CanonicalAppendOutcome {
    Inserted { sequence: i64, payload_checksum: String },
    Duplicate { existing_sequence: i64 },
}

impl SharedEventWriter {
    pub fn append_canonical_fact(
        &self,
        session_id: String,
        fact: CanonicalFact,
    ) -> Result<CanonicalAppendOutcome, StoreError>;
}
```

- `append_canonical_fact` 内部：校验 → 计算 `event_id` / `attempt_id` / `dedupe_key` → 调用 `append_event`。
- checksum 仍由 Writer 内部按 deterministic-json 计算，调用方不可伪造。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| A2.3 Assembler 需要理解所有 Runtime 的 final snapshot 格式 | 复杂度集中 | 本 change 先定义 Canonical 输入契约，具体 Runtime 适配器在 Wave B/C 按契约填充；测试使用 synthetic event |
| 严格校验导致旧 V0 evidence 无法映射 | Shadow Log 失败 | D7：presentation-only 允许降级映射，不强制新 schema |
| `run.settled` 现有路径与 Commit Sink 耦合过紧 | 阻塞 settlement | Sink 必须 fail closed：SQLite ACK 失败则 settlement 不推进；测试覆盖该失败路径 |
| Tool Exchange 配对规则在不同 Provider 间语义差异 | 错误结算 | 先实现最小规则（call-result 按 id 配对，缺 result → incomplete），Provider 特殊行为后续通过 `providerPrivateRef` 补充 |
