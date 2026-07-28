# Shared Session V2 Execution Target / Send Contract

## Scenario: Attempt-owned Provider-scoped Shared Turn

### 1. Scope / Trigger

- Trigger：修改 Shared Session 创建、四级 Target、V2 send、Binding provisioning、
  Runtime event ingress、terminal commit、Interrupt/Recovery、Projection attribution。
- 目标：`conversation.turnRequested.target` 是一次 Attempt 的唯一执行权威；CLI、
  Provider、Model、Reasoning 在 UI、IPC、Runtime side effect、历史重载中不得分裂。
- Foundation SSOT：
  `docs/research/mossx-multi-cli-provider-session-foundation-design.md`。
- Behavior SSOT：
  `openspec/changes/fix-shared-target-send-rollout/**`。

### 2. Signatures

Frontend orchestration：

```ts
startSharedSession(
  workspaceId,
  initialTarget: ResolvedExecutionTarget,
): Promise<SharedSession>

persistSharedSessionSelectedTarget(
  workspaceId,
  threadId,
  target: ResolvedExecutionTarget,
): Promise<void>

sendSharedSessionTurnV2({
  workspaceId,
  threadId,
  target, // 只供 Tx1 freeze；dispatch 不再接收 Target
  text,
  ...
}): Promise<SendSharedSessionTurnV2Result>

selectNextTarget(workspaceId, threadId, target): void
isComposerInputLocked(state): boolean
isComposerSubmitLocked(state): boolean
isPickerLocked(state): boolean
getSharedSendStateRevision(workspaceId, threadId): number
tryAcquireSharedSend(workspaceId, threadId):
  { acquired: true, state: "preparing-context", revision } | blocked
consumeSharedSendAdmission(workspaceId, threadId, revision): boolean
releaseSharedSendAdmission(workspaceId, threadId, revision): boolean
restoreSharedSendStateFromTurnState(
  workspaceId,
  threadId,
  turnState,
  expectedRevision?,
): boolean
```

Production Tauri commands：

```text
start_shared_session(workspaceId, selectedEngine?, initialTarget)

# read-only preview；不创建 Attempt/Binding，不写 Cursor，不触碰 Runtime
shared_session_v2_prepare_context(workspaceId, threadId, target)

# Tx1：唯一一次接收完整 Target
shared_session_v2_begin_turn(workspaceId, threadId, target, text)

# 以下 mutation 都只接收 durable identity
shared_session_v2_prepare_delivery(workspaceId, threadId, attemptId)
shared_session_v2_dispatch_turn(
  workspaceId, threadId, attemptId,
  artifactId, artifactChecksum,
  disableThinking?, accessMode?, images?, collaborationMode?,
  preferredLanguage?, customSpecRoot?
)
shared_session_v2_commit_turn(workspaceId, threadId, attemptId)
shared_session_v2_mark_recovery(workspaceId, threadId, attemptId, reason?)
shared_session_v2_interrupt_turn(workspaceId, threadId, attemptId)

# bindingKey 只作 durable row identity；重建 target 从 row 派生
shared_session_v2_rebuild_binding(workspaceId, threadId, bindingKey)
shared_session_v2_probe_binding(workspaceId, threadId, bindingKey)
shared_session_v2_turn_state(workspaceId, threadId)
```

Rust internal boundaries：

```text
durable_attempt_owner(sessionId, attemptId)
accept_context_for_attempt_core(writer, sessionId, owner, ...)
accept_turn_for_attempt_core(writer, sessionId, attemptId, ...)

SharedRuntimeCoordinator.register_attempt(owner)
SharedRuntimeCoordinator.bind_runtime_turn(
  attemptId, runtimeTurnId?, nativeSessionId?
)
SharedRuntimeCoordinator.ingest_*_event(...)
SharedRuntimeCoordinator.drain_replay_barrier(attemptId)
SharedRuntimeCoordinator.mark_cancel_intent(attemptId)
SharedRuntimeCoordinator.clear_cancel_intent(attemptId)
```

Domain / Storage：

```text
ResolvedExecutionTarget {
  engine,
  providerProfileId?,
  modelCatalogEntryId,
  model,                         # Runtime model
  reasoning?,
  providerProfileNameSnapshot,
  providerProfileSource          # selection: disk | managed
}

TurnExecutionSnapshot {
  engine,
  providerProfileId?,
  modelCatalogEntryId,
  model,                         # Runtime model
  reasoning?,
  providerProfileNameSnapshot,
  providerProfileSource          # canonical: local | managed
}

SharedSessionMeta.schemaVersion = 2
Binding Key = "{engine}:{providerProfileId || default}"
shared_binding_state.provisioning_json.state =
  prepared | creating | ready | recovery-required
```

### 3. Contracts

#### 3.1 Session creation and mutable selection

- 新 Shared Session MUST 提供完整 `initialTarget`。`selectedEngine` 仅可作为由
  `initialTarget.engine` 派生的 legacy mirror；缺 Target、partial Target 或 Engine
  不一致时，必须在创建任何目录/meta 前 fail closed。
- Shared UI MUST 只有四级 `ExecutionTarget` 选择入口。Engine-only `ConfigSelect`、
  `onSelectEngine` 或只写 `selectedEngine` 的 action 不得在 Shared surface 可达。
- Picker 只更新 `selectedNextTarget`。持久化必须先成功，再把同一 Target 发布到
  in-memory store；写盘失败时 UI 保留上一 Target 并显示错误，不能出现
  “界面已切换、重载又回退”的双状态。
- `selectedNextTarget` 只影响下一 Attempt。`activeTurnTarget`、Runtime owner 和历史
  Badge 只能读 immutable Snapshot。
- local/disk selection 在 freeze boundary 转成 canonical `local`；managed 保持
  `managed`。canonical boundary 收到 `disk` 或未知值必须拒绝。

#### 3.2 Preview, Tx1 and attempt ownership

- `shared_session_v2_prepare_context(target)` 是可丢弃的 read-only preview。它可以校验
  Target、读取现有 Binding/Cursor、编译预览 Manifest；不得创建 Attempt、写
  `context.deliveryPrepared`、推进 Cursor、物化 Binding 或调用 Runtime。
- `shared_session_v2_begin_turn(target, text)` 是 production lifecycle 唯一接收完整
  Target 的 mutation。它先校验完整 Provider provenance 与
  `modelCatalogEntryId + runtime model` pair，再 durable append
  `conversation.turnRequested`。
- Tx1 成功后，Engine、Provider、Model、Reasoning、Binding、Context、Control、
  terminal commit 全部从 `attemptId → conversation.turnRequested.target` 派生。
  frontend、legacy V0 flat fields、当前 Picker、global model state 均不能覆盖它。
- `modelCatalogEntryId` 用于 catalog/provenance；`model` 是 CLI/API Runtime identity。
  两者必须匹配同一 Provider-scoped catalog entry，Runtime adapter 只消费 `model`。

#### 3.3 Delivery and actual Runtime dispatch

- `prepare_delivery(attemptId)` 从 durable owner 编译 Context Package，并在外部 side
  effect 前原子写 artifact、`context.deliveryPrepared` 与 pending delivery。
- `dispatch_turn(attemptId, artifact identity, operational options)` 不接受第二套
  Engine/Provider/Model/Reasoning/Text。它先复核 artifact、package、pending phase 与
  durable owner，再按 `(workspace, engine, providerProfileId)` 物化/复用 Runtime。
- V2 dispatch MUST NOT 调用 V0 `send_shared_session_message`。Provider/Model rejection
  必须结算原 Attempt，不得回退 default Provider/Model。
- Context/Prompt acceptance 只能由 dispatcher 内部用真实 Adapter evidence 写入；
  frontend 不得调用独立 accept command 伪造 ACK。
- typed dispatch ACK 必须与 frozen owner 的 Engine、Provider、runtime Model、
  Reasoning、Binding 相等。字段缺失或冲突视为 ambiguous/contract violation，不能进入
  `running`。
- explicit rebuild 只接收 `bindingKey`，Engine/Provider 必须从对应 durable
  `shared_binding_state` row 派生；caller 不得借 rebuild 改写 Binding Target。

#### 3.4 Rust lifecycle owner and atomic replay

- Runtime event 必须先进入 `SharedRuntimeCoordinator`，再进入普通 UI fan-out。
  coordinator 按 `workspace + engine + exact runtimeTurnId` 认领；只有任一侧缺 Run
  identity 时才允许 `nativeSessionId` fallback。
- Runtime send 返回 exact identity 前到达的 event 进入 bounded unowned queue。
  `bind_runtime_turn` 必须在同一 coordinator lock 内注册 identity、开启 replay
  barrier、搬运已归属 ingress。
- barrier 存在期间，同 owner 的早到与新到 visible ingress 都按到达顺序排队。
  dispatcher 每批必须先发布 authoritative observation，再 emit 对应
  `AppServerEvent`；只有一次 drain 在 lock 内观察到空队列时才能原子清除 barrier。
  这防止 bind 与 emit 之间的新 event 越过 replay。
- Claude replay user-message 中的 exact context marker 是 transport ACK。它必须在
  barrier 内立即应用并唤醒 ACK waiter；不得因等待 visible drain 形成死锁。其余
  assistant/reasoning/tool/terminal 仍保持原顺序排队。
- assembler 在 ordinary fan-out/drop 前收集 assistant、Reasoning、Tool
  call/result、Artifact、private refs/omissions 与 structured outcome。terminal
  exactly-once 生成 immutable settlement；canonical commit 成功后才清 Runtime owner
  与 replay cache。

#### 3.5 Control, recovery and projection

- Interrupt 只接收 `attemptId`，从 durable snapshot + coordinator owner 解析
  Engine、Provider、Binding、native Thread、runtime Turn。不得回退当前 Picker、
  active Engine 或 workspace-wide interrupt。
- 发 Runtime interrupt 前必须登记 attempt-owned cancel intent；同步/早到
  `TurnError` 结算为 `cancelled`。若 interrupt side effect 自身失败，必须清除 intent，
  后续真实 Runtime error 仍结算为 `failed`。
- ACK/terminal/commit 不确定时进入 `recovery-required`；同 Attempt 禁止盲重发。
  Restore 必须用 per-thread mutation revision 拒绝跨完整 send cycle 的 stale hydrate。
- 早期 idle read 只作 preflight。最后一个异步 preflight 后、任何 optimistic user
  message、activity timestamp 或 processing mutation 前，必须同步
  `tryAcquireSharedSend`；V2 orchestrator 只能消费一次 exact revision。失败 caller 的
  Runtime RPC 与上述 UI mutation 都为零。
- handoff 前同步失败只允许 `releaseSharedSendAdmission(exactRevision)`；已消费、旧
  revision 或别的 caller 禁止解锁。
- Recovery Probe 必须真实调用 durable owner API：Attempt 走
  `shared_session_v2_recover_attempt`，仅有 Binding 时先走
  `shared_session_v2_probe_binding`。零个/多个/unknown/error 均保持锁定，RPC error
  必须可见。
- canonical projection 默认用于新 V2 Turn；legacy Shared snapshot 使用 dual-read，
  不读取或拼接 Native CLI session files。
- 每轮 Badge 只读 `TurnExecutionSnapshot`。Reasoning-only/tool-only completed Turn
  必须投影空正文 provenance anchor，仍显示 CLI/Provider/Model；不得伪造 assistant
  content。
- 完整 `MOSSX_CONTEXT_PACKAGE` Shared Runtime prompt echo 是 transport/control item。
  presentation 只隐藏严格版本化、双 marker 匹配的重复 user echo；必须保留 canonical
  user input 及其后的 assistant/reasoning/tool 内容。禁止宽泛 `includes("MOSSX")`。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| 新建缺失/partial `initialTarget` | 创建前 `invalid-shared-target` | 写 Engine-only meta |
| `selectedEngine != initialTarget.engine` | fail closed | 静默选任一方 |
| Shared engine-only action | UI 不可达；backend 不得制造新的 partial target | 覆盖完整 Target |
| Picker persistence 失败 | 保留旧 store Target + 可读错误 | 先改内存后吞错 |
| read-only `prepare_context` | 零 canonical/Binding/Runtime side effect | 把 preview 当 Tx3 |
| managed Provider 缺失 | `target-unavailable`，Runtime 零副作用 | 改发 default |
| `modelCatalogEntryId/model` pair 不匹配 | Runtime 前 fail closed | 用 catalog id 调 CLI |
| durable Target A + poisoned flat Target B | Runtime/Binding/Context/Badge 全用 A | B 产生任何 side effect |
| artifact/package/pending owner 不匹配 | fail closed + recovery evidence | 发送后再补校验 |
| typed ACK Provider/Model/Reasoning 不匹配 | 不进入 running | 只校验 Engine/Binding |
| 同 Engine Provider A → B → A | 两个 Binding，第三轮复用 A | engine-only Binding |
| rebuild caller 伪造 Engine/Provider | 忽略 caller target；从 row 派生或拒绝 | 改写 durable Binding |
| event 在 Runtime identity bind 前到达 | 缓存，bind 后有序 replay | 丢 event |
| event 在 replay drain 期间到达 | 排在 barrier 后部，不能越过早到 event | live emit 抢跑 |
| Claude context echo 早到 | ACK waiter 可立即观察；visible event 仍有序 | barrier deadlock |
| duplicate terminal | 只保留首次 settlement/commit | 第二条 final |
| exact `runtimeTurnId` + rebound native id | exact Run owner 结算 | 因 Thread id 变化丢 terminal |
| cancel intent 后同步 `TurnError` | commit `cancelled` | 显示普通 failure |
| interrupt side effect 失败 | 清 cancel intent，保留真实 failure 语义 | 永久把错误标取消 |
| Provider 已删除 | snapshot name + unavailable | 历史 Badge 消失 |
| legacy identity 不完整 | “历史配置未知” | 伪造“本地配置” |
| reasoning/tool-only Turn | provenance anchor + badge | 无 label 或伪造正文 |
| exact Shared prompt echo | 只隐藏 duplicate user transport item | 吞 assistant/reasoning |
| 用户正文讨论 `MOSSX` | 原样显示 | substring 误杀 |
| running/settling 编辑 draft | editable、保留 draft、submit blocked | 关闭 `contentEditable` |
| cancel-pending/recovery-required | Input/Submit/Picker 全锁 | 切 Target 绕过顺序 |
| 两个 caller 同时通过 idle preflight | exact 一个 admission；loser 零 optimistic/processing/RPC | read-check 当锁 |
| Recovery Binding 无 direct Attempt | 真实 probe binding；唯一 Attempt 再 recover | 只改 UI 文案假 Probe |
| Probe/Rebuild RPC 失败 | 保持 recovery-required + 可见错误 | 吞异常后伪装可恢复 |

### 5. Good / Base / Bad Cases

- Good：`begin_turn(Target A)` 后只传 `attemptId`；Rust 从 Tx1 读取 A，Provider process
  key 与 CLI runtime model 都可观测为 A。
- Good：早到 terminal 与 drain 期间新 delta 均留在 barrier；authoritative
  observation 先于 UI event，terminal 只 commit 一次。
- Base：`prepare_context(Target A)` 只返回预览，真正 Tx3 仍由
  `prepare_delivery(attemptId)` 从 Tx1 重新派生。
- Bad：V2 wrapper 在 Tx1 后调用 V0 command，并再次传
  `engine/model/effort/providerProfileId`。
- Bad：看到 `turn/start` response 或可见 final text 就由 frontend 构造 canonical
  `run.settled`。
- Bad：先 `selectNextTarget(newTarget)`，持久化失败后仍让 UI 显示 newTarget。
- Bad：`rebuild_binding(bindingKey, engine, providerProfileId)` 信任 caller Target。

### 6. Tests Required

只跑增量验证：

```bash
pnpm vitest run \
  src/features/shared-session/services/sharedSessions.test.ts \
  src/features/shared-session/runtime/sendSharedSessionTurnV2.test.ts \
  src/features/shared-session/runtime/sharedSessionBridge.test.ts \
  src/features/shared-session/runtime/sharedSendStateStore.test.ts \
  src/features/shared-session/components/SharedSendStatusBar.test.tsx \
  src/features/threads/hooks/useThreadMessaging.test.tsx \
  src/features/shared-session/target/targetStore.test.ts \
  src/features/composer/components/ChatInputBox/selectors/ModelSelect.test.tsx \
  src/features/composer/components/Composer.file-reference-token.test.tsx \
  src/features/composer/components/ChatInputBox/ChatInputBox.submit-button.test.tsx \
  src/features/messages/presentation/sharedProjection/dataSource.test.ts \
  src/features/messages/components/MessagesRows.stream-mitigation.test.tsx \
  src/features/messages/components/Messages.user-input.test.tsx \
  src/features/threads/loaders/sharedHistoryLoader.test.ts

pnpm exec tsc --noEmit --pretty false
pnpm run check:runtime-contracts

cargo test --manifest-path src-tauri/Cargo.toml --lib shared_runtime_coordinator
cargo test --manifest-path src-tauri/Cargo.toml --lib execution_target_contract_tests
cargo test --manifest-path src-tauri/Cargo.toml --test shared_session_v2
cargo test --manifest-path src-tauri/Cargo.toml --test shared_session_v2_target_matrix
cargo test --manifest-path src-tauri/Cargo.toml --test shared_projection
cargo check --manifest-path src-tauri/Cargo.toml --lib
```

关键断言：

- 新建 Session 的 meta 一开始就含完整 Target；不存在 Engine-only 新 Session。
- persist-first：selection IPC 失败时 in-memory Target 与 durable Target 都不变。
- `prepare_context` 零写入；`begin_turn → prepare_delivery → dispatch_turn` 只有 Tx1
  接收 Target。
- poisoned flat fields 无法影响实际 Provider process key、Binding 或 CLI model。
- `modelCatalogEntryId != model` 时两者均落盘，Runtime 只收到 `model`。
- pre-bind event、drain 期间 event、duplicate terminal 的顺序与 exactly-once。
- 两个并发 caller 只有一个 optimistic/processing/send；admission revision 只能消费一次。
- Recovery Attempt/Binding Probe 均真实调用 owner API；unknown/error 不解锁。
- context echo 不被 barrier 阻塞，assistant/reasoning/tool 不被 prompt filter 吞掉。
- cancel intent/clear intent 分别产生 cancelled/failed。
- canonical reload 保留 rich blocks、outcome、per-turn provenance；legacy dual-read 不丢
  历史且不导入 Native session history。

### 7. Wrong vs Correct

#### Wrong

```ts
await sharedSessionV2BeginTurn(workspaceId, threadId, target, text);
await sendSharedSessionMessage(
  workspaceId,
  threadId,
  engine,
  text,
  { providerProfileId, model, effort },
);
```

#### Correct

```ts
const begun = await sharedSessionV2BeginTurn(
  workspaceId,
  threadId,
  freezeTurnSnapshot(target),
  text,
);
const prepared = await sharedSessionV2PrepareDelivery(
  workspaceId,
  threadId,
  begun.attemptId,
);
await sharedSessionV2DispatchTurn(workspaceId, threadId, {
  attemptId: begun.attemptId,
  artifactId: prepared.artifactId,
  artifactChecksum: prepared.artifactChecksum,
});
```

#### Wrong

```ts
selectNextTarget(workspaceId, threadId, target);
await persistSharedSessionSelectedTarget(workspaceId, threadId, target);
```

#### Correct

```ts
await persistSharedSessionSelectedTarget(workspaceId, threadId, target);
selectNextTarget(workspaceId, threadId, target);
```

#### Wrong

```rust
emit_ui_event(event);
coordinator.ingest(event);
```

#### Correct

```rust
let observation = coordinator.ingest(event);
publish_shared_runtime_observation(&observation);
emit_projected_ui_event(event);
```

## Scenario: Shared Provider-aware Target Picker

### 1. Scope / Trigger

- Trigger：修改 Shared Composer 模型菜单、Provider Profile catalog、
  `selectedNextTarget` 或 target display。

### 2. Signatures

```ts
getEngineModels(engine, { providerProfileId }): Promise<EngineModelInfo[]>
onExecutionTargetChange({
  engine,
  providerProfileId,
  modelCatalogEntryId,
  model,
  reasoning,
  providerProfileNameSnapshot,
  providerProfileSource,
}): void
```

### 3. Contracts

- Picker hierarchy MUST be `CLI → Provider Profile → Model`，Reasoning 作为同一
  Target 的相邻级；选择 Model MUST 形成完整 `ResolvedExecutionTarget`。
- catalog request/cache key MUST include `engine + providerProfileId`。
- `__local_settings_json__`、`__disk__`、`__local_config_toml__` 只用于 catalog
  lookup；写入 Target 前 MUST normalize 为 `providerProfileId = null`。
- catalog item 的 `id` 与 `model` 必须分别写入 `modelCatalogEntryId` 与 runtime
  `model`；不能用一个字段兼任两种 identity。
- Shared surface MUST NOT 同时展示或响应 Engine-only `ConfigSelect`。所有 CLI 切换都
  必须经过同一四级 Target callback。
- target change 必须串行执行 `persist → publish store`；持久化失败时保留旧 selection。
- 当前按钮 MUST 从完整 Target catalog 解析 Model label，不得回读旧 Engine catalog。
- 未验证 target acceptance 的 CLI MUST visible-disabled with reason；MUST NOT fallback。
- root menu open MUST NOT fetch every model catalog；model fetch 只能由用户展开 CLI 触发。

### 4. Validation & Error Matrix

| 场景 | 结果 | 禁止行为 |
|---|---|---|
| Provider A/B 有同名 Model | 按完整 Target 选择正确 Binding | 按 Model ID 猜 Provider |
| local sentinel | Target 写 `null` | 创建 `engine:__local_*__` 重复 Binding |
| catalog `id != model` | 同时保存两者 | 把 `id` 发给 Runtime |
| Shared 点击另一 CLI | 打开/选择完整四级 Target | 调用 Engine-only handler |
| selection persistence 失败 | 仍显示旧 Target并提示错误 | memory/disk 漂移 |
| 一个 profile catalog 失败 | 只显示该 profile error | 清空其他 CLI/Profile |
| Kimi target 未验证 | 显示 disabled reason | 隐藏或改发其他 CLI |

### 5. Good / Base / Bad Cases

- Good：展开 Codex CLI 后只加载 Codex 各 Provider catalog，点击模型一次写完整 Target。
- Base：本地 Claude catalog 使用 sentinel 查询，Target 保存 canonical `null`。
- Good：持久化完成后才更新按钮 label；失败时按钮仍显示上一次 durable Target。
- Bad：切到 Codex 后按钮继续从 Claude models 找 label，显示成“选择模型”。
- Bad：Shared 同时保留 `ConfigSelect.onSelectEngine`，让 Engine 与四级 Target 各自成为
  selection authority。

### 6. Tests Required

- `ModelSelect.test.tsx`：跨 Provider 点击、同名 Model、`id != model`、local sentinel、
  Target label、Shared 不走 Engine-only callback。
- `useSharedProviderTargetCatalog.test.tsx`：lazy/cache、partial failure、binding error。
- `Composer.file-reference-token.test.tsx`：明确的 `null` 不得回退旧
  Provider/reasoning；persistence rejection 不得更新 store。
- `sharedSessions.test.ts`：new Session 缺 partial target fail closed。

### 7. Wrong vs Correct

#### Wrong

```ts
onSelectModel(modelId);
```

#### Correct

```ts
const target = {
  engine,
  providerProfileId: isLocalProfile ? null : providerProfileId,
  modelCatalogEntryId: catalogEntry.id,
  model: catalogEntry.model,
  reasoning: sameBinding ? current.reasoning : null,
  providerProfileNameSnapshot,
  providerProfileSource,
};
await persistSharedSessionSelectedTarget(workspaceId, threadId, target);
selectNextTarget(workspaceId, threadId, target);
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
shared_session_v2_prepare_delivery(workspaceId, threadId, attemptId)
shared_session_v2_dispatch_turn(
  workspaceId, threadId, attemptId, artifactId, artifactChecksum, ...
)
accept_context_for_attempt_core(
  writer, sessionId, durableAttemptOwner,
  packageId, nativeSessionId, nativeRequestId?
)
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
- `prepare_delivery` 与 Adapter delivery 必须从同一 `attemptId` 加载 durable Target、
  logical Turn 与 Binding；frontend 不得重复传 `target/logicalTurnId/bindingKey` 作为
  mutation authority。
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
| caller 尝试重复声明 Target/Binding | command shape 不接收；内部只读 durable owner | 比较后仍允许 caller 覆盖 |
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
const prepared = await sharedSessionV2PrepareDelivery(
  workspaceId,
  threadId,
  attemptId,
); // Tx3 已落盘
await sharedSessionV2DispatchTurn(workspaceId, threadId, {
  attemptId,
  artifactId: prepared.artifactId,
  artifactChecksum: prepared.artifactChecksum,
}); // dispatcher 内部验证真实 ACK 并按 durable owner accept
```
