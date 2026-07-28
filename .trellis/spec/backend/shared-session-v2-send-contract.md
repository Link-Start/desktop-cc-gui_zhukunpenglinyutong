# Shared Session V2 Execution Target / Send Contract

## Scenario: Provider-scoped Shared Turn

### 1. Scope / Trigger

- Trigger：修改 Shared Composer target、V2 send、Binding provisioning、terminal
  settlement、Projection attribution、Interrupt/Recovery routing。
- 目标：同一 Shared Session 在 Claude/Codex 多 Provider 间切换时，身份不串线；
  未获可靠 ACK/terminal 时 fail closed，不伪造成功或失败。
- Behavior SSOT：`openspec/changes/compose-shared-session-execution-target/**`。

### 2. Signatures

Frontend：

```ts
selectNextTarget(workspaceId, threadId, target): void
sendSharedSessionTurnV2(input): Promise<SendSharedSessionTurnV2Result>
captureSharedRuntimeTerminal(workspaceId).waitFor({
  nativeThreadId,
  runtimeTurnId,
}): Promise<SharedRuntimeTerminal>
engineInterruptTurn(workspaceId, turnId, engine, providerProfileId?): Promise<void>
```

Tauri commands：

```text
shared_session_v2_prepare_context(workspaceId, threadId, target)
shared_session_v2_begin_turn(workspaceId, threadId, target, text)
shared_session_v2_accept_turn(workspaceId, threadId, attemptId,
  logicalTurnId, target, nativeSessionId)
shared_session_v2_commit_turn(workspaceId, threadId, attemptId,
  logicalTurnId, target, assistantText, outcome, nativeSessionId)
shared_session_v2_mark_recovery(workspaceId, threadId, bindingKey,
  engine, providerProfileId, reason)
shared_session_v2_probe_binding(workspaceId, threadId, bindingKey)
engine_interrupt_turn(workspaceId, turnId, engine, providerProfileId?)
```

Storage：

```text
SharedSessionMeta.schemaVersion = 2
Binding Key = "{engine}:{providerProfileId || default}"
shared_binding_state.provisioning_json.state =
  prepared | creating | ready | recovery-required
```

### 3. Contracts

- Composer 四级选择只写 `selectedNextTarget`；该 store 是 send boundary 的权威输入，
  不得被旧的 global Composer selection 重组覆盖，也不得创建 Binding 或改写
  `activeTurnTarget`。
- `selectedNextTarget` MUST 同时保存 Provider display snapshot/source；发送时将
  CLI、Provider、Model、Reasoning 一次冻结进 immutable target snapshot。
- unsupported historical target MUST fail closed 并要求重新选择；不得静默 fallback 到
  Claude/default/local。
- `begin_turn` 必须先落 `conversation.turnRequested` + immutable
  `TurnExecutionSnapshot`，再触碰 runtime。
- managed Provider 不存在、Model 不在该 Provider catalog 时返回
  `target-unavailable`；禁止 fallback 到 default Provider/Model。
- typed prompt ACK 后才调用 `accept_turn`。`accept_turn` 与 `commit_turn`
  必须核对同 attempt 的 `turnRequested.logicalTurnId + target snapshot`。
- Claude command 成功返回是 settled 边界；Codex `turn/start` 只代表 accepted，
  必须等待 `turn/completed|turn/error`，并按
  `workspaceId + nativeThreadId + runtimeTurnId` 认领。
- Codex terminal observer 必须在 `turn/start` 前订阅，缓存快速 terminal；
  不得接管或吞掉既有 realtime consumer。
- ACK/terminal/commit 不确定时写 `recovery-required`；同 attempt 禁止盲重发。
- Projection/Badge 只读 canonical snapshot。CLI 使用产品 display label；Provider
  删除后保留 `providerProfileNameSnapshot`，另算 `providerAvailable=false`。
  explicit disk/local 才显示“本地配置”；legacy identity 缺失显示“历史配置未知”。
- Interrupt 必须携带 active snapshot 的 `providerProfileId`；Desktop 与 daemon
  都只操作该 Provider session。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| managed Provider 缺失 | `target-unavailable`，Tx1/Runtime 均无副作用 | 改发 default |
| Model 出 Provider catalog | `target-unavailable` | 自动换 Model |
| prompt ACK 缺失/超时 | `recovery-required`，不写 accepted | 猜测 rejected 后重发 |
| Codex `turn/start` 成功但未 terminal | 保持 running，等待 owner-matched terminal | 直接写 committed |
| terminal owner 不匹配 | 忽略该 event | 提交到当前 attempt |
| 同 attempt target 与 requested snapshot 不同 | command 返回 owner mismatch | 改写历史 target |
| duplicate terminal，语义相同 | 返回 duplicate，单条 committed | 追加第二条 final |
| duplicate terminal，语义冲突 | fail loud | 静默覆盖 |
| provisioning 强杀 | restart 后 recovery-required | 新建第二个 Binding |
| Provider 已删除 | Badge 显示 name snapshot + unavailable | 历史 Badge 消失 |
| store target 与 global selection 不同 | 发送 store target，冻结其 display identity | 用旧 selection 覆盖 |
| historical target 为 Kimi/Gemini 等 unsupported engine | fail closed + 可读错误 | 偷偷改发 Claude |
| legacy snapshot 无 Provider identity | 显示“历史配置未知” | 伪装成“本地配置” |

### 5. Good / Base / Bad Cases

- Good：Codex `turn/start` 返回 accepted；renderer critical channel 收到匹配的
  `turn/completed` 后，V2 sink 才写 `turnCommitted`。
- Base：Claude 阻塞 send 成功返回，同时携带 typed accepted + settled。
- Bad：看到 Codex `turn/start` response 就构造假的 `run.settled`。
- Bad：按 Engine 查 Claude session 后 interrupt，忽略 `providerProfileId`。

### 6. Tests Required

```bash
npm run typecheck
npx vitest run src/features/shared-session \
  src/features/messages/presentation/sharedProjection/dataSource.test.ts \
  src/features/messages/components/MessagesRows.stream-mitigation.test.tsx \
  src/features/composer/components/Composer.file-reference-token.test.tsx
npx vitest run src/features/threads/hooks/useThreadMessaging.test.tsx \
  -t "routes a shared Claude interrupt to the active provider binding"
cargo test --manifest-path src-tauri/Cargo.toml \
  --test shared_session_v2 \
  --test shared_session_v2_target_matrix \
  --test shared_projection
cargo check --manifest-path src-tauri/Cargo.toml --bin cc_gui_daemon
npm run check:runtime-contracts
```

关键断言：

- `turnRequested → turnAccepted → turnCommitted` 顺序与 duplicate 幂等。
- process kill 后只有一条 `turnRequested`、一个 Target Binding。
- Codex terminal 只匹配自己的 native owner，并保留 assistant final。
- Picker 变化不改写历史 snapshot；deleted Provider Badge 可解释。
- stale global selection 不覆盖 store target；unsupported historical target 零 send side effect。
- explicit local 与 legacy unknown 的 Badge fallback 不同。
- Shared Claude Interrupt payload 含 active `providerProfileId`。

### 7. Wrong vs Correct

#### Wrong

```ts
const response = await sendSharedSessionMessage(...);
await commitTurn({ outcome: "completed" }); // turn/start 不是 terminal
```

#### Correct

```ts
const terminalCapture = captureSharedRuntimeTerminal(workspaceId);
const response = await sendSharedSessionMessage(...);
await acceptTurn(response);
const terminal = await terminalCapture.waitFor({
  nativeThreadId: response.nativeThreadId,
  runtimeTurnId: response.turn.id,
});
await commitTurn({ outcome: terminal.outcome });
```

## Scenario: Shared Provider-aware Target Picker

### 1. Scope / Trigger

- Trigger：修改 Shared Composer 模型菜单、Provider Profile catalog、
  `selectedNextTarget` 或 target display。

### 2. Signatures

```ts
getEngineModels(engine, { providerProfileId }): Promise<EngineModelInfo[]>
selectNextTarget(workspaceId, threadId, {
  engine, providerProfileId, model, reasoning
}): void
```

### 3. Contracts

- Picker hierarchy MUST be `CLI → Provider Profile → Model`，Reasoning 作为同一
  Target 的相邻级；选择 Model MUST 原子写完整 Target。
- catalog request/cache key MUST include `engine + providerProfileId`。
- `__local_settings_json__`、`__disk__`、`__local_config_toml__` 只用于 catalog
  lookup；写入 Target 前 MUST normalize 为 `providerProfileId = null`。
- 当前按钮 MUST 从完整 Target catalog 解析 Model label，不得回读旧 Engine catalog。
- 未验证 target acceptance 的 CLI MUST visible-disabled with reason；MUST NOT fallback。
- root menu open MUST NOT fetch every model catalog；model fetch 只能由用户展开 CLI 触发。

### 4. Validation & Error Matrix

| 场景 | 结果 | 禁止行为 |
|---|---|---|
| Provider A/B 有同名 Model | 按完整 Target 选择正确 Binding | 按 Model ID 猜 Provider |
| local sentinel | Target 写 `null` | 创建 `engine:__local_*__` 重复 Binding |
| 一个 profile catalog 失败 | 只显示该 profile error | 清空其他 CLI/Profile |
| Kimi target 未验证 | 显示 disabled reason | 隐藏或改发其他 CLI |

### 5. Good / Base / Bad Cases

- Good：展开 Codex CLI 后只加载 Codex 各 Provider catalog，点击模型一次写完整 Target。
- Base：本地 Claude catalog 使用 sentinel 查询，Target 保存 canonical `null`。
- Bad：切到 Codex 后按钮继续从 Claude models 找 label，显示成“选择模型”。

### 6. Tests Required

- `ModelSelect.test.tsx`：跨 Provider 点击、同名 Model、local sentinel、Target label。
- `useSharedProviderTargetCatalog.test.tsx`：lazy/cache、partial failure、binding error。
- `Composer.file-reference-token.test.tsx`：明确的 `null` 不得回退旧 Provider/reasoning。

### 7. Wrong vs Correct

#### Wrong

```ts
onSelectModel(modelId);
```

#### Correct

```ts
selectNextTarget(workspaceId, threadId, {
  engine,
  providerProfileId: isLocalProfile ? null : providerProfileId,
  model: modelId,
  reasoning: sameBinding ? current.reasoning : null,
});
```

## Scenario: Shared Context Package Delivery

### 1. Scope / Trigger

- Trigger：修改 `shared_context` compiler、Context Package、Artifact Store、Context
  ACK、Binding cursor 或 degraded-context UI。
- 目标：跨 Provider 切换时只从 Shared Canonical Log 派生上下文；未获得 Adapter
  证据时 fail closed，禁止重复注入或提前推进 cursor。
- Behavior SSOT：`openspec/changes/add-shared-context-compiler/**`。

### 2. Signatures

```text
shared_session_v2_prepare_delivery(workspaceId, threadId, attemptId,
  logicalTurnId, target)
shared_session_v2_accept_context(workspaceId, threadId, attemptId,
  logicalTurnId, bindingKey, packageId, nativeSessionId, nativeRequestId)
shared_context_retrieve_artifact(workspaceId, threadId, artifactId, checksum)
shared_context_scan_orphans()

ContextPackage {
  schemaVersion, packageId, sessionId, bindingKey, destination,
  stablePrefix, delta, promptPrefix, manifest, compression
}

Binding context cursor {
  acceptedThroughSequence,
  committedThroughSequence,
  pendingDelivery
}
```

### 3. Contracts

- Compiler source 只能是 Shared Canonical Log；当前 `turnRequested` 的 sequence 是
  exclusive upper boundary，禁止把本轮 user prompt 重复编进 Context Package。
- mode 固定按 capability 选择：
  `native-delta > native-history-import > native-history-clone >
  portable-transcript > checkpoint`。缺 destination identity 时不得选
  `native-delta`。
- `context.deliveryPrepared` 与 pending 必须先于外部 context side effect 落盘。
  Adapter ACK 只推进 accepted；terminal canonical commit 才推进 committed 并清
  pending。
- Codex `thread/inject_items` 只有 JSON-RPC success 才算 strong ACK。Claude
  transcript/checkpoint 只有匹配 package/checksum 的 replay echo 才算 strong ACK。
  weak fidelity 必须显式返回，禁止宣称 exactly-once。
- tool call/result 成对保留或成对省略；private reasoning、failed/aborted assistant、
  unsupported image 和 historical control 必须写 Manifest disposition。
- package id MUST 覆盖 compiler version、destination identity、capabilities、effective
  budget、source range 与 Binding；上述任一输入变化 MUST 产生不同 identity。
- Artifact 按 workspace/session 隔离；checksum MUST 覆盖序列化后的
  `ContextPackage` payload，读取时必须重算。损坏的现有 artifact MUST 隔离并原子重写，
  读取结果永远 `referenceOnly=true`。orphan scan 只报告，不自动删除。
- Artifact publish MUST 使用同目录 create-new temp + file sync + atomic rename；Unix
  额外 sync parent directory，Windows 使用 rename durability boundary，失败路径清理 temp。
- UI 只在 prepare/confirm/ACK/terminal 等阶段边界更新；禁止 per-entry setState
  和新增 polling。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| compile 失败 | 无 pending、无 cursor 推进、无 runtime side effect | 先发 prompt 再补事实 |
| 当前 turn 已写 Tx1 | package upper bound 为该 sequence 前一条 | 把当前 user prompt 重复放入 prefix |
| Codex import timeout/disconnect | 保留 pending，进入 recovery | fallback prompt-prefix 后重复发送 |
| Claude checksum echo 缺失/不匹配 | `ackAmbiguous` + recovery-required | 推进 accepted |
| context 已 accepted、run failed | accepted 不回退；terminal 后 committed 前进 | 重放同一 package |
| 另一 Target 发现 unresolved pending | 返回 recovery-required | 绕过 pending 开新线性操作 |
| cross-workspace/session artifact | ownership error | 返回内容 |
| package destination/capability/budget 改变 | 新 package id | 复用旧 artifact |
| artifact payload 被篡改 | integrity error；prepared 且无外部副作用时隔离重写 | 返回篡改内容 |
| degraded package 未确认 | 无 context/prompt side effect | 自动发送 |

### 5. Good / Base / Bad Cases

- Good：Tx1 写当前 user intent；compiler 只读上一条 sequence；Tx3 写 pending；
  Adapter ACK 推进 accepted；terminal commit 推进 committed。
- Base：目标只支持 transcript，UI 显示 omissions/compression，用户确认后携带
  marker 发送。
- Bad：把 `turnCommitted.sequence` 当 context cursor；这是 runtime terminal 的
  sequence，不是 package 的 `throughSequenceInclusive`。
- Bad：Claude process 写入成功就立即构造 fake terminal 或 context ACK。

### 6. Tests Required

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib shared_context
cargo test --manifest-path src-tauri/Cargo.toml --test shared_context
cargo test --manifest-path src-tauri/Cargo.toml --test shared_session_v2
cargo test --manifest-path src-tauri/Cargo.toml --lib \
  convert_event_preserves_replayed_user_message_as_raw_ack_evidence
cargo test --manifest-path src-tauri/Cargo.toml --lib \
  context_import_requires_jsonrpc_success
pnpm vitest run \
  src/features/shared-session/runtime/sendSharedSessionTurnV2.test.ts \
  src/features/shared-session/runtime/sharedRuntimeTerminal.test.ts
pnpm exec tsc --noEmit --pretty false
```

关键断言：

- 相同 source range 的 package id/checksum/stable prefix 确定。
- destination/capability/effective budget 改变时 package id 必须改变。
- artifact payload tamper 必须被读取复核拒绝；并发 writer 只能发布完整 payload。
- 当前 user prompt 不进入 prefix；accepted/committed 分阶段推进。
- artifact cross-workspace 拒绝且读取为 reference-only。
- strong ACK 缺失进入 recovery；弱 ACK 不伪装 exactly-once。

### 7. Wrong vs Correct

#### Wrong

```ts
await sendSharedSessionMessage(...);
await sharedSessionV2AcceptContext(...); // 没有 Adapter 证据
```

#### Correct

```ts
const prepared = await sharedSessionV2PrepareDelivery(...); // Tx3 已落盘
const delivery = await sendSharedSessionMessage(...);
assertMatchingContextAck(delivery, prepared.packageId, prepared.sourceChecksum);
await sharedSessionV2AcceptContext(...);
```
