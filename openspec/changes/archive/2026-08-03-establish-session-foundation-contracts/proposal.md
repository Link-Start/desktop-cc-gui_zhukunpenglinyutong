# Proposal: establish-session-foundation-contracts

## Why

多 CLI × 多 Provider 会话基石的上游设计（[`docs/research/mossx-multi-cli-provider-session-foundation-design.md`](../../../docs/research/mossx-multi-cli-provider-session-foundation-design.md)）已进入 Implementation-ready 状态，但所有后续 Wave（A1 存储、A2 Canonical Ingress、A3 Projection、B Execution Target、C Context Compiler、D Provider Continuation）都依赖一组尚未冻结的契约：Canonical Fact Schema、领域对象定义、Runtime ACK 能力边界与 golden fixtures。

当前若不先冻结契约就进入实现，会出现三类必然返工：Schema 字段语义在 Rust/TS 双侧各自理解漂移；Runtime Adapter contract 建立在 CLI 宣传文案而非实测能力之上；Wave 2/3 缺少可重复的回归输入。本 change 执行 [`2026-07-27-multi-cli-provider-session-foundation-task-checklist.md`](../../../docs/plans/2026-07-27-multi-cli-provider-session-foundation-task-checklist.md) 的 **Wave 0（T0.1–T0.6 + Gate 0）**，只产出契约与调研证据，不写产品代码。

## 目标与边界

- 落地 8 类 Canonical Fact 的 JSON Schema（draft-07）：`conversation.turnRequested` / `context.deliveryPrepared` / `context.deliveryAccepted` / `conversation.turnAccepted` / `conversation.turnCommitted` / `conversation.usageRecorded` / `provider.usageAggregateRecorded` / `conversation.controlFact`，附 envelope、校验脚本与正/反例样本。
- 冻结领域契约：ExecutionTarget / TurnExecutionSnapshot / SessionOrigin / ConversationFamilyRef / BindingKey 规则 / BindingContextCursor / BindingProvisioningState / NativeHistoryReader / NativeHistoryMaterialization / Legacy fidelity，以及跨版本兼容策略（schemaVersion、unknown field、unknown enum、checksum algorithm agility）。
- 完成三个实测 Spike 并落档 capability matrix：S1 Codex `thread/inject_items`（codex-cli 0.144.6）、S2 Claude `--replay-user-messages`（2.1.218）、S3 Kimi ACP（0.27.0）。
- 准备 Claude/Codex 代表性 Native History + Live Event golden fixtures，入库且可被 loader 测试重复加载。
- 全部产出为文档、Schema、fixtures 与 dev-only 校验脚本；Shared 产品行为不变，dark-launch 边界不破。

## 非目标

- 不实现任何 Runtime Adapter、SQLite schema、Event Writer、Assembler、Projection 或 UI（属于 Wave 1–3）。
- 不迁移、不改写任何现有 Session 数据（V0 snapshot、Native history、vendor history file）。
- Spike 不修改 vendor CLI 配置与历史，不评估 Claude/Codex/Kimi 之外的 Engine。
- 不新增运行时依赖；校验脚本仅使用仓库已有 node_modules 中的 ajv，缺失时明确报错而不静默跳过。
- 不为 Shared Session 接入任何真实流量（dark launch 期间产品行为保持 V0）。

## What Changes

- 新增 capability spec `session-foundation-contracts`：定义 Canonical Fact envelope、8 类 Fact payload、兼容策略、领域契约、Usage 归属与 Spike 证据的 Requirement/Scenario。
- 新增 `schemas/`：2 个 JSON Schema 文件（Shared envelope + Provider Usage Ledger entry）、校验脚本、valid/invalid 样本。
- 新增 `design.md`：T0.2 领域契约的正式定义与取舍论证（含兼容性策略、Binding Key 规则、Family 边界、Usage revision 规则）。
- 新增 `docs/research/spikes/`：三份实测报告（含 binary identity + sha256 + transcript evidence）与可重复执行的 probe harness。
- 新增 golden fixtures（按仓库现有 fixtures 约定落位）+ loader 测试 + manifest。

## Capabilities

### New Capabilities

- `session-foundation-contracts`: 多 CLI × 多 Provider 会话基石的契约层——Canonical Fact envelope 与 8 类 Fact 的字段/兼容语义、ExecutionTarget/TurnExecutionSnapshot/SessionOrigin/ConversationFamilyRef 等领域契约、Binding Key 与 two-phase cursor 规则、NativeHistoryReader/Materialization 只读边界、Turn 与 Provider Aggregate Usage 归属规则，以及 Runtime ACK capability 必须以本机实测为证据的要求。

### Modified Capabilities

- 无。本 change 只新增契约，不改变任何现有 capability 的行为要求；`shared-session-thread`、`conversation-fact-contract` 等的扩展由后续 Wave change 承担。

## 方案对比与取舍

1. **推荐：契约以机器可校验的 JSON Schema + OpenSpec Requirement 双轨落地。** Schema 承担字段级 correctness（Wave 1 起 Rust/TS 双侧直接消费），OpenSpec spec 承担行为语义与验收。优点是契约可被 CI 校验、样本可作 golden 输入；代价是 Wave 0 多花约 1 天写 Schema 与样本。
2. **备选：契约只写在 design.md 散文中。** 上手快，但字段语义靠读者自觉，Rust/TS 各自实现必然漂移，且无法做 invalid-payload 拒绝落盘的契约测试。不采用。
3. **Spike 证据取舍：本机实测 vs 引用 CLI 官方文档。** 官方文档与安装版本经常不一致（能力按 binary + protocol version 变化），设计红线已要求 capability probe 不以文案或假设为依据，因此三个 Spike 必须在本机真实 CLI 上执行并保留 transcript；binary identity（path/version/sha256）随报告落档，CLI 升级后需重跑。

## 验收标准

- 8 类 Fact 的 valid 样本全部通过 Schema 校验；invalid 样本（缺必填、错误枚举、错误 checksum 格式、错误 schemaVersion）全部被拒绝。
- Schema 兼容策略明文落档：unknown field 保留透传、unknown enum/schemaVersion/checksum algorithm fail closed、optional 省略而非 null、timestamp 为 integer ms。
- 三份 Spike 报告各自包含 binary identity + sha256、逐问实测 matrix（PASS/FAIL/PARTIAL）与 go/no-go 结论；任何 Adapter contract 不引用未实测能力。
- Golden fixtures 覆盖 user/assistant/tool exchange 等基本 entry 类型，manifest 完整，loader 测试通过且可重复。
- 五类对象（Native/Shared/Subagent/Fork/Continuation）在契约中互不混用 Parent/Family 字段；Model 不在默认 Binding Key；Provider 删除后历史 Turn 可由 Snapshot 字段独立解释。
- `openspec validate establish-session-foundation-contracts --strict --no-interactive` 通过。

## Impact

- OpenSpec：`openspec/changes/establish-session-foundation-contracts/**`（新增）；归档时新增 `openspec/specs/session-foundation-contracts/spec.md`。
- Docs：`docs/research/spikes/**`（新增报告与 probe harness）。
- Fixtures：仓库 fixtures 目录新增 Claude/Codex native history、live events 与 manifest；loader 测试新增于相应测试目录。
- 产品代码：零改动。Runtime、UI、存储、迁移均不受影响。
- 后续依赖：Wave 1（A1）以本 change 的 Schema 为 payload 校验依据；Wave 2（A2）以 Spike matrix 与 fixtures 为 Assembler 输入；Wave 5（C）以 Spike go/no-go 决定 Adapter 实现范围。
