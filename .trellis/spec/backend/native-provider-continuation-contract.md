# Native Provider Continuation Contract

## Scenario: 从既有 Native Session 创建独立的跨 Provider 续接

### 1. Scope / Trigger

- Trigger：修改 `native_history/**`、`native_continuation/**`、session catalog lineage、
  Codex cross-provider fork、`createNativeProviderContinuation` 或 Sidebar 续接入口。
- 目标：来源 vendor history 只读；目标 side effect 前持久化 immutable materialization；
  retry 不盲建；Continuation 保持顶层且不冒充 Subagent。

### 2. Signatures

```rust
create_native_provider_continuation(
    workspace_id,
    operation_id,
    source: NativeHistorySource,
    destination: ExecutionTargetInput,
    confirm_degraded,
) -> Result<Value, String>
```

```typescript
createNativeProviderContinuation({
  workspaceId,
  operationId,
  source,
  destination,
  confirmDegraded?,
}): Promise<NativeProviderContinuationResponse>
```

### 3. Contracts

- `source.sessionId` MUST 等于 `<engine>:<nativeSessionId>`；Codex source MUST 带
  authoritative `providerProfileId`。
- destination V1 支持 Claude/Codex。Kimi target 与 remote daemon MUST 返回 typed
  `unsupported-target-acceptance`，禁止 fallback。
- phase 顺序：`prepared -> creating -> ready`；不确定 ACK 进入
  `recovery-required`。相同 `operationId` + 相同 request 复用 artifact/target identity；
  request 不同返回 `operation-conflict`。
- `prepared` 且尚无 target side effect 时，旧版本 checksum 或损坏 artifact MAY 删除旧
  prepared operation 后按同一 request 重新 materialize；`creating/ready/recovery-required`
  MUST 保留 durable identity 并 fail closed。
- Native history 单文件读取 MUST 有明确 byte limit，并在 blocking worker 中执行；超限返回
  typed `source-too-large`，禁止在 async runtime worker 上无界读取。
- Reader 只允许 portable text 与完整 Tool Call/Result pair；private reasoning、
  signature/encrypted/redacted block 与 unknown block MUST omission，禁止泄露到目标 Provider。
- Codex runtime 调用使用裸 thread id；operation/catalog/UI 使用 `codex:<thread-id>`。
- Codex `thread/inject_items` capability MUST 由无目标副作用的 JSON-RPC method probe
  决定；`method not found` 才视为 unsupported。unsupported 时 MUST 使用已声明的
  portable prompt transport，禁止仍调用缺失 method。
- Claude 首次 bootstrap 以目标 session identity、冻结 artifact checksum 和 CLI
  invocation 成功返回作为 accepted evidence；模型是否逐字复述 marker 不得决定创建成功。
- Claude recovery 只复用既有 target identity，并检查 durable history：user entry 必须
  同时包含 exact package marker 与 `MOSSX_NATIVE_CONTEXT_V1`，或 assistant exact echo
  acceptance marker。仅出现 marker 字样不是证据。
- bootstrap turn id 使用 `provider-continuation-*`；renderer event ingress MUST 在统一入口
  隔离该 control exchange，禁止进入普通 processing/reasoning/message/title 链。
- degraded response MUST 带 `projectionMode`、`omissions`、
  `sourceEstimatedTokens`、`packageEstimatedTokens` 与 `adapterDroppedEntries`。
- catalog MUST 保存 Provider Binding、Origin 与 Conversation Family；MUST NOT 写
  `parentThreadId`。删除来源 MUST NOT 级联删除 Continuation。

### 4. Validation & Error Matrix

| 条件 | 结果 | 禁止行为 |
|---|---|---|
| stable cursor 不可证明 | `unsupported-stable-cursor` | 写 materialization / 创建目标 |
| source identity 或 Provider 漂移 | typed validation error | 从其他 Provider 猜来源 |
| operation 参数变化 | `operation-conflict` | 复用旧 artifact |
| prepared、无 target side effect 且 artifact checksum 失败 | 删除旧 prepared 后重新冻结 | 复用损坏 artifact |
| 已触发 target side effect 后 artifact checksum 失败 | `recovery-required` | 重读来源或新建第二目标 |
| target side effect 后 ACK 不确定 | `acceptance-ambiguous` | 创建第二个目标 |
| Claude CLI 完成但模型未复述 marker | 按同一 target identity 持久化 ready | 报假失败并要求重复创建 |
| recovery history 有完整 bootstrap user entry | 复用既有 target 并补 catalog | 只认模型输出、创建第二个 target |
| metadata 写入失败 | `catalog-commit-failed` | 丢失 result identity |
| remote daemon | typed unsupported | local/default fallback |

### 5. Good / Base / Bad Cases

- Good：Claude Provider A → Codex Provider B → 原 Claude Provider；每一步创建独立顶层
  Session，继承 family，保留来源链。
- Base：package 无 omission，直接创建；同 operation retry 返回同一 target。
- Bad：复制 Codex rollout 到另一个 `CODEX_HOME`，或把
  `lineageParentSessionId` 填入 `parentThreadId`。
- Bad：把模型是否严格服从“只回 marker”当 transport ACK；这会造成首次假失败、第二次才恢复。
- Bad：Claude recovery 只做 `jsonl.contains(marker)`；普通用户文本也可能包含相同字样。

### 6. Tests Required

- Rust：Reader append/drift/corrupt、operation conflict/phase/result identity、artifact checksum、
  byte limit、private/unknown omission、atomic Tool pair、Codex method probe/portable fallback、
  Claude completed bootstrap、durable bootstrap history、assistant exact ACK compatibility、
  unrelated marker rejection、catalog family/delete non-cascade。
- Vitest：DTO mapping、Claude/Codex target menu、double-click guard、degraded detail、
  canonical target selection、顶层“供应商续接”标签与来源导航。
- Contract：`cargo check --lib`、`npm run typecheck`、
  `npm run check:runtime-contracts`、OpenSpec strict validation。
- Release gate：真实 Desktop 执行 Claude A → Codex B → Claude A，人工观察历史连续性、
  degraded confirmation 与 recovery；自动化不可替代。

### 7. Wrong vs Correct

#### Wrong

```rust
if history_jsonl.contains(&marker) {
    mark_ready();
}
```

#### Correct

```rust
let accepted = bootstrap_completed
    || history_has_exact_package_and_native_version(history_jsonl)
    || assistant_text_blocks(history_jsonl)
        .any(|text| text.trim() == marker);
if accepted {
    commit_existing_target_identity();
}
```

## Scenario: Provider Continuation Product Projection

### 1. Scope / Trigger

- Trigger：修改 Continuation 入口、确认 UI、catalog title、幕布消息或来源导航。

### 2. Signatures

```ts
classifyContextProtocolText(text): ContextProtocolKind | null
ProviderContinuationDialog({ state, onCancel, onConfirm })
ProviderContinuationContextCard({ thread, source, onOpenSource })
```

### 3. Contracts

- 点击目标 Provider 只打开 application-owned Dialog；首次 confirm 前 MUST NOT 调用
  `createNativeProviderContinuation`。
- `confirmation-required` MUST 在同一 Dialog 展示 projection mode、token estimate、
  omissions 与 adapter drops；二次确认才发送 `confirmDegraded: true`。进入 recovery 后
  retry MUST 保留该确认，不得退回未确认状态。
- recovery 主文案 MUST 面向用户解释“是否可能已创建、重试是否会重复”；raw backend
  error 只能放在默认折叠的“技术详情”。
- renderer production code MUST NOT 使用 `alert/window.alert` 或 native system confirm。
- exact `MOSSX_CONTEXT_PACKAGE/ACCEPTED` 与完整 native context prompt 启动一个
  control exchange；直到下一条普通 user message 之前的 reasoning/assistant/lifecycle
  projection MUST 全部隐藏。普通包含 MOSSX 的用户文本 MUST 保留。
- protocol title MUST 投影为“继续：来源标题”或可读 fallback。
- continuation metadata MUST 通过既有 `.messages` timeline-leading slot 接入，默认折叠，
  不得成为 Canvas 根 sibling，也不得参与 message grouping、streaming、terminal 或
  scroll-anchor 计算。展开后显示 source → target snapshot；来源缺失时 disabled。

### 4. Validation & Error Matrix

| 场景 | 结果 | 禁止行为 |
|---|---|---|
| 首次取消 | 无 target side effect | 先创建再询问 |
| degraded | 产品内二次确认 | native Alert / 只显示空洞警告 |
| recovery retry | 保留 degraded confirm；只校验同一 target | 创建第二个 target |
| bootstrap control exchange | 整段幕布隐藏 | hash/reasoning/问候作为普通聊天显示 |
| 普通用户讨论 marker | 正常显示 | 宽泛 substring 误删 |
| 来源缺失 | 卡片解释并禁用导航 | 跳到同名/相邻 Session |

### 5. Good / Base / Bad Cases

- Good：Dialog 显示 Claude A → Codex B；取消不调用 command；确认后创建。
- Base：ready continuation 显示可读标题和默认折叠的来源 metadata。
- Bad：把 `MOSSX_CONTEXT_PACKAGE:sha256:...` 当 Sidebar title 和 user bubble。

### 6. Tests Required

- Dialog confirm/cancel/degraded/recovery retry tests。
- Sidebar command-before-confirm negative assertion 与 Kimi disabled state。
- complete control exchange classifier + Messages render regression。
- readable title、source card navigation 与 missing-source tests。

### 7. Wrong vs Correct

#### Wrong

```ts
if (window.confirm(message)) {
  await createNativeProviderContinuation(request);
}
```

#### Correct

```ts
setDialogState({ stage: "confirm", request });
// command 仅由 Dialog confirm handler 调用
```
