## Context

Shared V2 has three distinct authorities:

1. `SharedRuntimeCoordinator` owns the exact in-memory Runtime Attempt and accumulates its terminal snapshot.
2. `conversation.turnCommitted` is the durable canonical terminal authority.
3. The frontend Promise/state machine is only an observer and presentation owner.

The current implementation violates that separation. `shared_session_v2_await_turn_terminal` applies a 30-minute deadline to the observer. On expiry, frontend code marks the Binding `recovery-required`, clears `isProcessing` and `activeTurnTarget`, while the coordinator still owns a healthy Attempt. `shared_session_v2_recover_attempt(status=active)` then returns only an enum and does not restore the terminal observer.

## Goals / Non-Goals

**Goals:**

- accepted Runtime Attempts wait for authoritative terminal evidence without an arbitrary full-Turn deadline。
- observer failure MUST NOT rewrite a still-active accepted Runtime owner into a failed/recovery Runtime fact。
- `Probe(active)` restores exact Attempt identity、frozen Target provenance and terminal observation。
- durable terminal commit remains idempotent and independently owned by the existing backend critical sink。

**Non-Goals:**

- 不修改 context ACK、prompt ACK、provider request、health probe 等局部 timeout。
- 不恢复进程重启后已经消失的 in-memory Runtime owner。
- 不改 DB schema、canonical event format、Queue/Fusion 或 compaction policy。

## Decisions

### 1. Full-Turn observation uses event-driven settlement

`SharedRuntimeCoordinator::wait_for_settlement` will wait on the exact Attempt's `Notify` until settlement or owner removal. It will no longer accept a duration. Waiters register before rechecking coordinator state，settlement/removal 则唤醒该 Attempt 的全部 observers，避免旧 observer 与 reattachment 并存时只有一个被唤醒。The Tauri command still checks durable `conversation.turnCommitted` before and after the wait, preserving the existing race-safe/idempotent path.

Alternative: increase 30 minutes to a larger constant. Rejected because every finite value remains a false-terminal boundary for legitimate agent work.

Desktop 与 daemon 的 Provider event forwarder 同样不得从 Turn start 计算总 deadline；
否则 coordinator waiter 虽无 timeout，也永远收不到晚到 terminal。Gemini/Claude typed
completion 后的 reasoning/stdout drain 仍保留 bounded grace，因为它只约束 cleanup
phase，不决定 active Runtime 的生死。

### 2. Observer failure cannot demote an accepted active owner

`shared_session_v2_mark_recovery` will re-read durable acceptance evidence. If the Attempt is accepted and still owned by `SharedRuntimeCoordinator`, it returns `status=active` without mutating Binding state. Pre-acceptance ambiguity continues to enter `recovery-required`.

Alternative: remove `mark_recovery` from all frontend error paths. Rejected because pre-ACK ambiguity still needs fail-closed durable recovery.

### 3. Active recovery returns the frozen owner envelope

`shared_session_v2_recover_attempt(status=active)` will include `nativeThreadId`、`runtimeTurnId` and the durable `executionTargetSnapshot` already held by the coordinator. Frontend MUST NOT reconstruct these fields from the current Picker.

### 4. Reattachment is deduplicated outside the React component lifecycle

A small module-level reattachment registry keys observers by `workspaceId + threadId + attemptId`. `SharedSendStatusBar` starts it after `Probe(active)`；`useSharedSendStateRestore` 在 renderer restart 检出唯一 accepted/live owner 时，也执行一次 authoritative `recover_attempt(active)` 后进入同一 registry。The registry:

1. restores `setSharedSendActiveAttempt` and `beginTurn` with the returned frozen snapshot；
2. transitions `recovery-required → running`；
3. awaits the existing durable terminal command；
4. transitions through `runSettled → canonicalCommitted` and clears Attempt/Target only after commit；
5. returns to `recovery-required` if observation itself fails。

The Promise is not owned by the status component, so hiding/unmounting the card does not orphan the observer. Backend terminal ingestion remains the canonical commit authority even if the renderer disappears.

Terminal cleanup uses an exact `attemptId` compare-and-clear。若旧 observer 在 successor
Attempt 已成为 thread owner 后才返回，frontend 仍安装旧 `runtimeTurnId` terminal
barrier，但不得清 successor processing、owner 或 frozen Target。

Alternative: add polling to `useSharedSendStateRestore`. Rejected because it adds root-chain wakeups and still treats sampled UI state as lifecycle authority.

### 5. Active provenance survives ambiguous observer errors

The send orchestrator clears `activeTurnTarget` only when its exact active Attempt was released by terminal commit or explicit recovery. A typed frontend error identifies observer detachment so the generic messaging catch does not prematurely clear `isProcessing` for a known accepted active Attempt.

## Risks / Trade-offs

- [A malicious or broken Runtime never emits terminal] → the observer remains pending, matching Runtime truth; user Stop still targets the exact Attempt and Runtime shutdown remains authoritative。
- [Duplicate Probe clicks create duplicate waiters] → module-level exact-Attempt dedup returns the same Promise；backend coordinator 也会唤醒同一 Attempt 的全部跨 renderer waiters。
- [Old observer resolves after owner replacement] → exact Attempt guard keeps the successor lifecycle intact while still publishing the old Runtime terminal barrier。
- [Renderer restarts] → the JS observer is lost, but backend critical settlement and durable Attempt evidence remain；restore hook 对 live owner 一次性 reattach，owner 已消失则保持 recovery surface。
- [Owner disappears without durable commit] → waiter returns the existing ambiguous owner-ended error and recovery stays fail closed。
- [Provider process never emits terminal] → event forwarder remains alive with its Runtime session；explicit interrupt/session teardown closes the receiver and owner-removal path, rather than elapsed time fabricating settlement。

## Migration Plan

1. Ship code-only behavior change; no schema migration。
2. Existing false-timeout rows remain recoverable: `Probe(active)` reattaches, while already committed Attempts immediately converge to `idle`。
3. Rollback uses the existing Shared V2 feature flag; committed canonical facts remain readable。

## Open Questions

无。当前事故的 rollout、SQLite event log 与 source path 已提供完整证据。
