## Context

Shared V2 send 已经把 `conversation.turnCommitted` 设为 Composer control flow 的 durable
authority。Claude CLI 的 raw `type=result` 会在 process cleanup 前结算 Runtime attempt，
`shared_session_v2_await_turn_terminal` 随后返回 canonical commit。

Frontend 仍保留一套 realtime terminal ledger，用于拒绝 `turn/completed` 后迟到的 delta /
item event。当前 Shared durable response 只执行 `markProcessing(false)` 与
`setActiveTurnId(null)`，没有把 response 中已有的 `runtimeTurnId` 写入该 ledger。因此，
如果 frontend `turn/completed` 缺失，durable commit 后排队到达的 realtime event 可以再次
执行 `markProcessing(true)`，且再无 terminal event 将其关闭。

约束：

- durable evidence 继续拥有 Shared Composer control authority。
- 不恢复 per-delta root reducer dispatch，不破坏现有 render performance baseline。
- 不为不同 Provider / Model 增加分支。
- Native Session lifecycle 必须保持不变。

## Goals / Non-Goals

**Goals:**

- durable commit 返回时，为 response 的 exact `runtimeTurnId` 安装 realtime terminal barrier。
- barrier 安装后，迟到的带 turn id 或无 turn id event 都不能复燃 Shared Thread。
- 在安装 barrier 前同步 flush 已排队 realtime batch，使已有内容先收敛；随后由现有 Shared
  response path 清理 processing / active turn。
- 下一 Turn 的 `turn/started` 继续通过 `noteRealtimeTurnStarted` 解锁 thread-level settled
  fallback。

**Non-Goals:**

- 不新增 backend synthetic `turn/completed` 作为 correctness 依赖。
- 不改变 canonical event schema、Shared DB、Native history 或 projection assembler。
- 不调整 Provider target selection、session creation 或 Grok/OpenCode 独立问题。

## Decisions

### 1. 复用 realtime terminal ledger，不创建 Shared 专用状态机

`useThreadItemEvents` 已维护 exact terminal turn ids、active turn id 与 settled threads，并在
normalized、legacy delta、raw item path 上执行 guard。本次扩展一个
`settleDurableRealtimeTurn(threadId, runtimeTurnId)` 能力：

1. flush 当前 pending realtime batches；
2. 调用既有 `markRealtimeTurnTerminal`；
3. 不直接生成 transcript fact，不调用 Native `turn/completed` side effects。

相比新增 Shared-only store，这能保持 terminal 判断只有一个实现。

### 2. 通过注册 callback 跨越 Hook 初始化顺序

`useThreadMessaging` 当前早于 `useThreadEventHandlers` 初始化。`useThreads` 将维护一个稳定
callback ref：

- messaging 收到 Shared durable committed response 时调用 ref；
- event handlers 初始化后注册上述 durable settlement function；
- 注册/卸载沿用项目已有的 `onThreadTransientCleanupReady` callback pattern。

该 callback 只接受 `threadId + runtimeTurnId`，不接收 engine/model，保持 engine-neutral。

### 3. barrier 必须先于 processing=false

Shared response 的顺序固定为：

1. 验证 `v2.committed === true` 与非空 `runtimeTurnId`；
2. 同步安装 durable terminal barrier；
3. `markProcessing(threadId, false)`；
4. `setActiveTurnId(threadId, null)`。

这样 barrier 安装前已排队内容先被 flush；安装后的 timer/event 会被 ledger 丢弃，不能覆盖
最终 `false`。

### 4. 缺少 runtimeTurnId 时安全失败，不伪造 identity

成功 Shared V2 dispatch 的 response contract 已提供 `runtimeTurnId`。若 committed response
异常缺失该字段，系统仍执行现有 UI cleanup，但记录结构化 debug evidence；不得使用
`logicalTurnId` 或 `attemptId` 冒充 Runtime identity。

## Risks / Trade-offs

- [Risk] callback 尚未注册时 durable response 到达 → 使用稳定 ref，并在正常用户交互前的
  首次 render 同步注册；测试覆盖首个 Shared Turn。
- [Risk] flush 全局 pending batch 增加一次终态工作量 → 复用当前
  `turn/completed` 已采用的 bounded flush，且每 Turn 只执行一次。
- [Risk] thread-level settled fallback 误杀下一 Turn 的无 id event →
  保留 `noteRealtimeTurnStarted` 对 settled state 的解锁，并补下一 Turn 回归测试。
- [Risk] runtimeTurnId 缺失导致 exact id event 未被 barrier 拦截 → 保留可观测 debug 记录，
  不用错误 identity 扩大隔离范围。

## Migration Plan

1. 先加入 focused tests，复现 durable commit 后迟到 realtime event 复燃。
2. 注册 durable terminal barrier callback，并接入 Shared committed response。
3. 同步 Trellis / OpenSpec contract，运行 targeted tests、typecheck 与 strict validation。
4. 无 data migration；回滚时 revert 本次 frontend 与 spec 变更即可，durable facts 不受影响。

## Open Questions

无。Backend synthetic terminal event 可作为未来 observability enhancement，但不进入本次
correctness path。
