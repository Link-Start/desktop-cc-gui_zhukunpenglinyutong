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

- Composer 四级选择只写 `selectedNextTarget`；不得创建 Binding 或改写
  `activeTurnTarget`。
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
- Projection/Badge 只读 canonical snapshot。Provider 删除后保留
  `providerProfileNameSnapshot`，另算 `providerAvailable=false`。
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
