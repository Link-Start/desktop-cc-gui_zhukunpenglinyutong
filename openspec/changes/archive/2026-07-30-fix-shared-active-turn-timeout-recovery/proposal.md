## Why

Shared V2 currently gives the terminal observer a fixed 30-minute wall-clock deadline. A valid long-running Codex Turn therefore enters `recovery-required` while the exact Runtime Attempt remains active; the original Promise and UI owner are cleared, and `Probe(active)` only changes an enum without reattaching terminal observation. This creates a ghost run and makes canonical context appear lost until the Runtime eventually commits.

## What Changes

- Remove the arbitrary full-Turn terminal deadline. Runtime terminal evidence, explicit interrupt, or authoritative Runtime failure remains the only normal settlement authority.
- Remove the same full-Turn deadline from desktop and daemon Provider event forwarders; keep only phase-local and post-completion grace timeouts.
- Make `Probe(active)` restore the exact durable Attempt owner, frozen `TurnExecutionSnapshot`, and a deduplicated terminal observer instead of only switching `recovery-required → running`.
- Preserve active UI ownership across ambiguous terminal-observer failures; clear it only after durable terminal commit or an explicit recovery decision.
- Add focused Rust and frontend regression coverage for a Turn that outlives the former 30-minute boundary and for active recovery followed by late terminal commit.

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-send-pipeline`: 明确 accepted Attempt 不受任意 wall-clock terminal deadline 约束，并补全 `Probe(active)` 的 owner/observer 恢复与 durable terminal 收口契约。

## Impact

- Backend: `shared_session_v2_await_turn_terminal`、`SharedRuntimeCoordinator` recovery owner projection、desktop/daemon Provider event forwarders。
- Frontend: Shared V2 recovery service types、`SharedSendStatusBar`、`useSharedSendStateRestore`、terminal reattachment lifecycle。
- Tests/specs: Shared runtime coordinator、Shared V2 command contract、recovery UI/runtime tests。
- Dependencies/DB schema: 无新增依赖，无 migration。

## 目标与边界

- 只修复 Shared V2 accepted Attempt 的长时运行与 active recovery continuity。
- 保持 context ACK、prompt ACK、provider request、health probe 等局部 bounded timeout。
- exact `AttemptId`、`BindingKey`、`RuntimeTurnId` 和 frozen Target 仍是唯一 owner identity。

## 方案取舍

- **方案 A：扩大 30 分钟常量**。改动最小，但任何固定值都会再次误杀合法长任务，且不修复 `Probe(active)` 无 observer 的死路，拒绝。
- **方案 B：移除 full-Turn deadline，并让 active recovery 重附 terminal observer**。符合普通 Codex app-server 的 event-driven lifecycle，保留局部 timeout，采用。

## 非目标

- 不改变各 CLI 的首包、context ACK、request ACK 或健康检查 timeout。
- 不重构 Shared canonical event log、queue/fusion 或 compaction 策略。
- 不为进程已重启且 Runtime owner 已消失的 `unknown` Attempt 伪造恢复。

## 验收标准

- accepted Shared Turn 超过原 30 分钟边界仍保持 `running`，Binding 不进入 `recovery-required`。
- `Probe(active)` 恢复 exact Attempt 与 frozen Target，并能在晚到 terminal 后回到 `idle`。
- ambiguous observer failure 不清空仍活跃 Attempt 的 Stop/Queue owner。
- terminal commit 继续幂等，`unknown`/restart 分支继续 fail closed。
