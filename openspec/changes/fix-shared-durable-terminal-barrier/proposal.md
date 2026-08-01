## Why

Shared Session 的 Runtime 已经写入 durable `conversation.turnCommitted` 后，迟到的
assistant、reasoning 或 item realtime event 仍可能把 frontend `isProcessing` 重新写成
`true`。这会让 Claude Code 搭配 Kimi、MiniMax 等 Provider 偶发长期显示 Stop / “思考中”，
即使答案与 canonical commit 都已经完成。

## 目标与边界

- 让 exact Shared Turn 的 durable commit 成为 Composer control state 的单向 terminal barrier。
- terminal barrier 必须覆盖 `turn/started`、assistant/reasoning delta、item update 等迟到投影。
- realtime event 仍可在结算前补充展示内容，但不能在 durable commit 后复燃已结束 Turn。
- 下一次新 Turn 必须能够正常解除上一回合的 thread-level settled state。
- 修复必须对 Shared 支持的 CLI / Provider 组合保持 engine-neutral，不按 Kimi、MiniMax 等
  model 名称写分支。

## 非目标

- 不改变 Native Session 的既有 realtime lifecycle。
- 不改变 `conversation.turnCommitted` 的数据库 schema 或历史事实。
- 不重写 Shared transcript projection、history hydrate 或 Provider selection。
- 不把 frontend transient `turn/completed` 恢复为 Shared control flow 的唯一 authority。

## What Changes

- 将 Shared send response 已有的 exact `runtimeTurnId` 接入 frontend realtime terminal ledger。
- durable await 返回 committed 后，先登记 terminal barrier，再清理 Shared Composer processing state。
- 统一阻止已结算 Turn 的迟到 normalized event、legacy delta 与 raw item update 复燃 processing。
- 补充“没有 frontend terminal event、只有 durable commit”的竞态回归测试。
- 保留下一回合开始、异常恢复与 Native Session 的原有行为。

## 方案对比

### 方案 A：仅由 backend 补发 synthetic `turn/completed`

改动表面较小，但 transient event 仍可能丢失或晚于队列中的 item event，无法满足
“frontend terminal event 完全缺失时 Composer 仍结束”的现有 durable contract。

### 方案 B：durable response 安装 exact-turn terminal barrier（采用）

复用 backend durable await 与 frontend realtime terminal ledger。控制态由 durable commit
收口，event handler 只消费 barrier；既消除竞态，也不引入新的状态机。

### 方案 C：所有 Shared realtime event 永远不得写 processing

隔离最彻底，但会破坏首包到 durable commit 之间的现有进度展示，并扩大 Native/Shared
分流范围，不符合本次最小修复边界。

## Capabilities

### New Capabilities

<!-- 本次不新增独立 capability。 -->

### Modified Capabilities

- `shared-send-pipeline`: durable `conversation.turnCommitted` 必须为 exact Shared Turn 建立
  frontend terminal barrier，迟到 realtime projection 不得复燃 Composer。

## 验收标准

- Shared Turn 已 durable committed 且 frontend `turn/completed` 缺失时，Composer 回到 idle。
- durable commit 后到达的 assistant、reasoning、item 与 delayed `turn/started` 不得重新显示 Stop。
- terminal barrier 只作用于已结算 exact Turn；同一 Shared Thread 的下一 Turn 可正常开始。
- Claude Code 搭配 Kimi、MiniMax 等 Provider 使用同一 engine-neutral 路径。
- targeted frontend tests、Rust settlement tests、typecheck 与 runtime contract check 通过。

## Impact

- Frontend Shared send orchestration、thread messaging 与 realtime event terminal ledger。
- Shared send / realtime hook 的 focused Vitest tests。
- `shared-send-pipeline` behavior contract 与对应 Trellis cross-layer contract。
- 无新增 dependency、无数据库 migration、无 breaking API。
