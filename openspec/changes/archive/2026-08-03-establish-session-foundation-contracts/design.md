# Design: establish-session-foundation-contracts

> 上游：[`mossx-multi-cli-provider-session-foundation-design.md`](../../../docs/research/mossx-multi-cli-provider-session-foundation-design.md)（下称 Foundation Design，§编号均指该文档）
> 本文冻结 Foundation Design §十五 Phase 0 的全部领域契约；字段级 JSON 表达见 `schemas/`，行为语义见 `specs/session-foundation-contracts/spec.md`。

## 1. 决策总览

| # | 决策 | 依据 |
|---|---|---|
| D1 | Canonical Fact 以 JSON Schema draft-07 落地，envelope 与 payload 分离 | draft-07 同时被 ajv 6/8、python jsonschema、Rust `jsonschema` crate 支持，工具兼容性最好；Wave 1 的 A2 payload 校验直接消费 |
| D2 | `provider.usageAggregateRecorded` 独立 schema，不进入 Shared envelope | Foundation §14.2.1：ownership 是 Provider+Window，不属于任何 `logicalSessionId` |
| D3 | Binding Key = `engine + providerProfileId`，Model 不进入 Key | Foundation §5.4；换 Model 不制造新 Binding |
| D4 | 兼容策略：unknown field 透传保留，unknown enum/schemaVersion/checksum algorithm fail closed | 见 §3；向前兼容靠新增字段，不靠新增枚举值被旧读者吞掉 |
| D5 | `EngineType` 枚举与 `src/types/engine.ts` 对齐（`claude/codex/gemini/kimi/opencode`） | 代码事实是契约来源；Shared V2 实际支持范围由 runtime capability probe 决定，不由 schema 限制 |
| D6 | 时间戳一律 integer ms（epoch, UTC）；checksum 一律 `sha256:<lowercase-hex>` | algorithm prefix 保留未来迁移空间；未知 algorithm fail closed |
| D7 | Spike 结论以本机实测 binary 为准，报告必须携带 binary identity + sha256 | Foundation §14.3.1：CLI 升级后必须重新 Probe，历史 Turn 不用新版本能力反向解释 |
| D8 | fixtures 只裁剪不伪造：删除整行或标记 `…[truncated in fixture]`，不改写字段语义 | Foundation 红线 24：Legacy/fixture 不得伪造 Tool ID、Reasoning Signature、provenance |

## 2. 领域契约（T0.2）

以下类型为逻辑契约（TypeScript 表达仅为精确语义，不代表立即落码）。Wave 1+ 实现时的命名可调整，语义不得偏离。

### 2.1 ExecutionTarget 与 TurnExecutionSnapshot

```typescript
interface ExecutionTarget {
  engine: EngineType;                    // "claude" | "codex" | "gemini" | "kimi" | "opencode"
  providerProfileId?: string;            // 缺省 = local/default profile
  model?: string;
  reasoning?: ReasoningSelection;        // { effort: string, ... }；取值由 target capability 决定，契约不枚举
}

interface TurnExecutionSnapshot extends ExecutionTarget {
  providerProfileNameSnapshot?: string;  // Provider 删除后历史仍可解释
  providerProfileSource?: "local" | "managed";
  runtimeCapabilityFingerprint?: string; // Capability Cache Key（engine+binary+version+protocol fingerprint）
}
```

规则：

- `ExecutionTarget` 是"下一 Turn 发给谁"的可变选择；`TurnExecutionSnapshot` 在 Tx 1 固化后不可变，是 Usage/Error/Retry/Recovery 的唯一归属依据。
- Snapshot 不含 `nativeSessionId`；Native identity 属于 Binding（Foundation §5.2）。
- 两层 Turn Identity：`logicalTurnId`（用户意图及 variants）+ `attemptId`（一次具体 runtime execution，恰好一个 Snapshot）。Retry/Regenerate 复用 `logicalTurnId`、新建 `attemptId`，写 `retryOfAttemptId`。

### 2.2 SessionOrigin 与 ConversationFamilyRef

```typescript
type SessionOrigin =
  | { kind: "root" }
  | { kind: "subagent"; parentSessionId: string; agentRole?: string; spawnedByToolCallId?: string }
  | { kind: "user-fork"; sourceSessionId: string; sourceTurnId?: string }
  | { kind: "provider-continuation"; sourceSessionId: string; sourceProviderProfileId?: string }
  | { kind: "shared-binding"; sharedSessionId: string };

interface ConversationFamilyRef {
  familyId: string;
  familyRootSessionId: string;
  lineageParentSessionId?: string;
  lineageKind: "root" | "user-fork" | "provider-continuation";
  lineageDepth: number;
}
```

边界（Foundation §5.5、§6）：

- `parentSessionId` 只表达 runtime-owned Subagent ownership，是唯一触发 Sidebar 嵌套的字段。
- `lineageParentSessionId` 表达用户血缘（Fork/Continuation），V1 不触发嵌套。
- Subagent 与 Shared Binding 不进入 Conversation Family；Shared Session 自身可作为独立 Family Root。
- `sourceSessionId` 是 migration input 与兼容读取字段；新写入以 `ConversationFamilyRef` 为 authoritative contract，迁移前 dual-read；不得把 `sourceSessionId` 改写为 `parentThreadId`。
- 历史 Session 无 authoritative lineage 时，以自身 stable session key 建立独立 Family；禁止按标题、时间或内容相似度猜测血缘。

### 2.3 BindingKey 与 BindingContextCursor

```typescript
// bindingKey = `${engine}:${providerProfileId ?? "local"}`（规范化拼接，不含 model）
interface BindingContextCursor {
  acceptedThroughSequence?: number;   // 目标 CLI 已确认接收；防 Retry 重复注入
  committedThroughSequence?: number;  // Terminal Fact 已落 Canonical Log；恢复与审计
  pendingDelivery?: PendingDelivery;  // ACK 边界崩溃的幂等恢复证据
}

interface PendingDelivery {
  packageId: string;
  sourceChecksum: string;             // sha256:<hex>
  throughSequence: number;
  operation: "context-import" | "prompt-send";
  phase: "prepared" | "sent-awaiting-ack" | "accepted-awaiting-commit";
  clientTurnId: string;
  nativeRequestId?: string;
  nativeSessionId?: string;
  nativeTurnId?: string;
  startedAt: number;
  lastProbeAt?: number;
  probeAttempts: number;
}
```

- `accepted` 与 `committed` 不可合并（Foundation §5.6）：一次 Run 失败不代表 Prompt 未进入 Native History；已收到 acceptance ACK 必须推进 `accepted`，否则 Retry 重复注入。
- `checkpoint` 是显式 lossy mode：目标 ACK 后仍推进 `accepted`；omitted entries 只能按 `retrievableRef` progressive retrieval，不自动补发。

### 2.4 BindingProvisioningState

```typescript
interface BindingProvisioningState {
  operationId: string;
  bindingKey: string;
  target: ExecutionTarget;
  capabilityFingerprint: string;
  phase: "prepared" | "started-awaiting-ack" | "ready" | "recovery-required";
  nativeSessionId?: string;
  nativeRequestId?: string;
  startedAt: number;
  lastProbeAt?: number;
}
```

- Lazy Create Native Session 是会留下长期身份的外部 side effect，必须独立持久化（Foundation §14.3.4）：调用 `thread/start` / `session/new` / spawn 前原子写入 `prepared`。
- 同一 `bindingKey` 同时最多一个未结算 Provisioning；ACK 不确定 → `recovery-required`，禁止盲目再建。
- `BindingProvisioningState`（Session 是否已创建）与 `PendingDelivery`（Context/Prompt 是否被接收）是两类 Pending，不得混用。

### 2.5 NativeHistoryReader 与 NativeHistoryMaterialization

契约全文见 Foundation §9.1.1；本 change 冻结以下关键边界：

- Reader 是只读 anti-corruption layer：输出 canonical-shaped `ContextSourceEntry`，不分配 Shared sequence，不写 Shared Event Log，不修改 vendor history file。
- Provider Continuation 只接受 `stableCursor = true` 且有 `currentThroughCursor` 的 Reader；否则 typed unsupported、fail closed，第一阶段不做"边读边增长"猜测。
- 目标 side effect 前必须持久化 immutable `NativeHistoryMaterialization`（fingerprint/cursor/checksum/artifact refs）；Retry 从 Artifact Ref 重放，不重读漂移中的来源。
- source 不存在、损坏、版本不支持、权限不足必须返回 typed error，不得静默生成"看似完整"的 transcript。

### 2.6 Legacy fidelity

- 旧 Shared snapshot 只投影为 `fidelity = "presentation-only"` 的 Entry，原文件不改写。
- 已知裁剪（文本、Tool Output、Image）必须显式记录为 omissions；禁止伪造 Tool Call ID、Reasoning Signature、Provider Response ID。
- 旧 snapshot 无法证明 Provider/Model 时只保留 Engine provenance，不猜测 Target。

## 3. 兼容性策略（系统兼容性写法）

适用于所有 Schema、payload 与未来新增契约对象：

| 情形 | 规则 | 理由 |
|---|---|---|
| `schemaVersion` 不匹配 | fail closed，typed error；禁止 coerce | envelope 语义可能整体变化，猜测比拒绝更危险 |
| 未知字段（envelope 或 payload） | 允许存在（`additionalProperties: true`），reader 忽略；read-modify-write 必须原样保留 | 向前兼容的唯一安全通道是"新增字段"，旧版本不能因新字段拒读 |
| 未知枚举值（`factType`、`mode`、`outcome.status`、`fidelity`…） | fail closed，typed error；禁止映射为 `"unknown"` 继续 | 枚举是行为分支条件，吞掉等于静默改语义 |
| 未知 checksum algorithm（非 `sha256:` 前缀） | fail closed | algorithm agility 只向前，不向后猜测 |
| 可选字段缺省 | 省略字段本身，不写 `null`；`null` 不是合法取值（除显式声明外） | 避免 `undefined`/`null`/缺省三态歧义 |
| 时间戳 | integer ms（epoch UTC）；浮点/字符串时间拒绝 | 跨语言一致性 |
| ID 类字段 | opaque non-empty string，不假设格式/长度/前缀 | 各 CLI identity 格式不可控 |
| `sequence`/`revision` | 非负 integer，per-owner 单调；reader 不假设连续无洞 | crash 后允许序号空洞，单调即可 |
| JSON Schema draft | draft-07 | ajv 6/8、python jsonschema、Rust jsonschema crate 全兼容 |

新增契约字段的原则：**只加可选字段，不改既有字段语义，不复用字段名表达新含义**；必须做 breaking 变化时 bump `schemaVersion` 并提供 reader 双读窗口。

## 4. Canonical Fact 集合（T0.1 范围）

Envelope `SharedCanonicalEntry`（schemaVersion=2）承载 7 类 Shared Fact；`provider.usageAggregateRecorded` 独立 schema（Provider Usage Ledger，无 `logicalSessionId`/`sequence`）：

| factType | 关键字段 | 幂等键 |
|---|---|---|
| `conversation.turnRequested` | logicalTurnId, attemptId, input, target, requestedAt | attemptId+factType |
| `context.deliveryPrepared` | logicalTurnId, attemptId, bindingKey, packageId, sourceChecksum, throughSequenceInclusive, mode, operation | attemptId+factType |
| `context.deliveryAccepted` | …, nativeRequestId?, acceptedAt | attemptId+factType |
| `conversation.turnAccepted` | …, clientTurnId, nativeSessionId, nativeTurnId?, acceptedAt | attemptId+factType |
| `conversation.turnCommitted` | …, inputEntryId, assistant, atomicToolExchanges, artifactRefs, target, providerPrivateRefs, omissions, outcome, committedAt | attemptId+factType |
| `conversation.usageRecorded` | usageRecordId, reportSubjectId, revision, supersedes?, target, bindingKey, nativeSessionId, usage, source, verification, observedAt | usageRecordId（dedupe_key 例外路径） |
| `conversation.controlFact` | controlKind（namespaced string）, logicalTurnId?/attemptId?/bindingKey?, reason?, details? | eventId |
| `provider.usageAggregateRecorded` | usageRecordId, providerProfileId, window, coveredAttemptIds?, usage, breakdown, revision, observedAt | provider+window+subject+revision |

Usage 规则（Foundation §14.2.1）：

- `reportSubjectId` 必须 attempt/native-turn scoped；`usageRecordId = hash(source + reportSubjectId + revision)`。
- 同 subject 多 revision 重建只选最高有效版本；superseded 不重复累计；aggregate-only 禁止按 Token/时长/Turn 数猜测分摊。
- `committed` 表示 Terminal Fact 可靠落盘，不代表 Agent 成功；failed/cancelled/replaced 也必须且只能 Commit 一次。

## 5. Spike 计划（T0.3–T0.5）

| Spike | 目标 | 实测对象 | 产出 |
|---|---|---|---|
| S1 | Codex `thread/inject_items`：Item 类型、持久化、read-back、duplicate、`clientUserMessageId` 关联 | codex-cli 0.144.6 | `docs/research/spikes/2026-07-27-s1-codex-thread-inject-items.md` |
| S2 | Claude `--replay-user-messages`：echo 格式、checksum 关联、`result` vs process-exit | Claude Code 2.1.218 | `docs/research/spikes/2026-07-27-s2-claude-replay-user-messages.md` |
| S3 | Kimi ACP：initialize capability、`session/load` replay、prompt lifecycle、Provider 边界 | Kimi CLI 0.27.0 | `docs/research/spikes/2026-07-27-s3-kimi-acp.md` |

统一要求：binary path/version/sha256 落档；probe harness 存 `docs/research/spikes/harness/` 可重复执行；raw transcript 存证；模型调用控制在最小次数；结论给出 go/no-go 与 FAIL/PARTIAL 清单。CLI 升级后 Spike 需重跑（capability cache 失效）。

### 5.1 实测结论与降级约束（2026-07-27，三 Spike 全部完成）

| Spike | 结论 | 关键实测发现 | 转写为后续 Wave 的显式约束 |
|---|---|---|---|
| S1 Codex 0.144.6 | **GO（有条件）** | `thread/inject_items` 真实存在；注入 canary 后模型可正确引用（`native-history-import` 核心假设成立）；`clientUserMessageId` 存在并落盘为 `event_msg.user_message.client_id`；`codex app-server generate-json-schema` 可导出 schema 指纹 | ① server 无 read-back API（`thread/read` 返回 turns=0、`thread/items/list` 未实现）→ import 校验只能读 rollout 文件或标 PARTIAL；② server 不去重、不分配 id → 幂等完全由 mossx `packageId`/pendingDelivery 承担；③ 注入项挂到合成 `turn_id: "auto-compact-0"`，不渲染为 UI turn |
| S2 Claude 2.1.218 | **GO（有条件）** | echo 真实存在、逐字保真、`isReplay: true`、`uuid` 与磁盘 user entry 对齐；**但 echo 不是实时 ACK**（turn 结束才送达 stdout）；`system/init` 每个 turn 重发且不能证明 prompt accepted；session JSONL 的 `queue-operation/enqueue` 在 stdin 写入 ~0.5s 即落盘且带完整 content | ① "prompt accepted" 阶段不能映射到 echo；推荐 `queue-operation` 落盘作乐观 ACK + echo 作最终确认，Wave 5 定稿；② init 宣告 `interrupt_receipt_v1` / `msg_lifecycle_v1`，Wave 5 应查证更细 lifecycle ACK；③ 无 `result` 的 exit 一律按失败处理（运行期失败形态未实测） |
| S3 Kimi 0.27.0 ACP | **GO** | 完整 stdio NDJSON ACP server；Working/Tool/Completion 三阶段有真实信号；`session/cancel` 返回 `stopReason: "cancelled"`；provider 隔离可沿用 `KIMI_CODE_HOME` 物化 + `session/set_model` | ① Prompt Accepted 仍为 inferred（ACP 长 turn request 语义）；② `session/load` **不回放 assistant 正文**（thought 27→1 条）→ mossx 必须用本地持久化 transcript 渲染历史（R1，Wave 5 复核）；③ `session/new` 的 `model` 参数被静默忽略 → 模型切换必须走 `set_model`/`set_config_option` |

Adapter 实施顺序维持 Foundation §14.3.5（Codex → Claude → Kimi），但 Kimi 从"prompt adapter 标 weak"上调为"ACP adapter 可行"，前提是接受 R1 的历史回放降级。

## 6. Golden fixtures 计划（T0.6）

- 内容：Claude/Codex 各一套 native history（真实 session JSONL / rollout）+ live event stream（NDJSON / JSON-RPC notifications），覆盖 user、assistant、tool exchange、thinking/reasoning（若触发）、terminal。
- 脱敏：credential、token、个人路径（统一 `<HOME>`）必须移除；只裁剪不伪造（D8）。
- `manifest.json` 记录 source CLI、binary version、捕获日期、entry 类型清单、fidelity 说明。
- loader 测试逐一解析并校验必需字段，作为 Wave 2 Assembler 与 Wave 3 Canvas 防回归的可重复输入。

## 7. Gate 0 出口条件

1. 三个 Spike 产出实测 matrix，后续 Adapter contract 不以 CLI 文案或假设为依据。
2. Phase 0 全部契约 artifact（本 design + schemas + spec + Spike 报告 + fixtures）通过评审。
3. Schema 正/反例校验通过；fixtures loader 测试通过；`openspec validate --strict` 通过。
