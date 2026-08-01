## Context

Shared Session V2 已具备 durable-first `turnRequested → deliveryPrepared → turnAccepted → turnCommitted` 链路，但 Composer 把所有 non-idle 状态视为不可提交，导致 Native Session 已有的 Queue/Fusion 在 Shared 表面回退。

Codex auto-compaction 的当前调度只在“同一个携带 usage 的 event”上决策。processing 期间达到阈值会被丢弃；更关键的是 `turn/start` 发出前没有先声明 user-dispatch intent，auto-compaction 可在同一 native thread 上抢先发出 `thread/compact/start`，把刚接受的用户 Turn 标为 `replaced`。Shared runtime normalization 又只读取顶层 `status`，未读取 `params.turn.status`，因此该 Attempt 被错误提交为成功且 assistant 为空。

约束：

- `TurnExecutionSnapshot`、Binding generation 与 Runtime owner 不得从当前 Picker 或 thread-id prefix 推断。
- `run.settled` 与 canonical `turnCommitted` 才能释放 Shared linear ordering。
- `cancel-pending`、`recovery-required` 与 ambiguous ACK 必须 fail closed。
- 高频 streaming state 不得重新进入 AppShell root reducer；本变更只投影低频 lifecycle scalar。
- 不增加依赖，不跑全量测试，不改变 Native history。

## Goals / Non-Goals

**Goals:**

- Shared `running` / `settling` 期间允许创建 follow-up，冻结完整 payload、target 与 predecessor identity。
- queue item 仅在 Shared typed committed ACK 后移除；blocked/error 保留可恢复。
- `input.mid-turn=supported` 才允许 same-run steer；`compat-input` 使用 interrupt → predecessor settle → successor start 的 explicit cutover。
- Codex high-watermark 在 processing 期间保留，并在 safe barrier 触发。
- Codex compaction 与 user dispatch 通过同一 native-thread gate 串行，压缩完成后原请求继续首次发送。
- manual compact 根据 Shared durable Target/Binding 路由 Codex 或 Claude；unsupported engine 明确拒绝。
- Shared Composer 显示真实 compaction lifecycle。

**Non-Goals:**

- 不为 unsupported CLI 模拟 steer 或 compaction。
- 不在 Target、Provider、Model 或 Binding generation 改变后融合旧 queue item。
- 不实现 runtime 已明确接受后的一般性自动 replay；out-of-band `replaced` 只准确落账，避免重复副作用。
- 不新建 backend queue schema；queue payload 使用现有 client-store，dispatch durability 继续由 V2 Tx1 提供。

## Decisions

### 1. Queue 复用现有 Composer queue，并补齐 Shared immutable envelope

Queued item 增加冻结的 Shared Execution Target 与 predecessor Attempt identity，并只持久化 Shared queue 到现有 `composer` client-store。drain 时把 frozen Target 作为 send override，不能读取此刻 Picker。

选择该方案而非新增 SQLite queue table：现有 queue 已承担排序、UI、Fusion timeout 与 payload 保存；新增第二套 backend scheduler 会重复状态机。真正的 runtime side effect 仍只在 V2 `turnRequested` durable commit 后发生。

### 2. Shared dispatch 返回值贯通到 queue drain

`sendUserMessageToThread` 对 Shared 返回 V2 typed result。queue drain 保留 item 为 in-flight，只有 `status=accepted` 且 `v2.committed=true` 才删除。`blocked`、target unavailable、ambiguous error 都保留原 item，并等待新的 settlement evidence 或用户修复。

### 3. `compat-input` 不是 steer

Capability resolver 对 `compat-input` 返回 follow-up degradation（显式允许 fallback 时）或 rejected。Fusion 对它执行 cutover：

1. exact owner interrupt；
2. 等 predecessor terminal pulse；
3. 使用 frozen payload/Target 创建 successor；
4. 等 successor run start/continuation evidence 后结算 Fusion。

只有 `supported` 进入 same-run steer。

### 4. Codex 使用 native-thread compaction/send barrier，禁止 blind replay

`AutoCompactionThreadState` 增加：

- pending high-watermark；
- user dispatch reservation；
- manual compaction request；
- in-flight timeout/cooldown。

`send_user_message_core` 在 `turn/start` 前原子 reserve user dispatch。若 compaction in-flight，则等待 `thread/compacted` / `thread/compactionFailed` 通知后继续；若 user dispatch 已 reserve，auto/manual compaction 只能等待 terminal。

processing 期间观察到 high-watermark 时只 latch。terminal event 到达后，在同一 mutex 内先判断 pending user/manual control，再决定是否把 compaction 标为 in-flight。该原子边界关闭“terminal 与下一次 send”竞态。

该设计优于 `replaced` 后 replay：accepted ACK 之后 replay 无法证明前一 Attempt 没有副作用，违反 ambiguous ACK fail-closed。barrier 在 prompt 首次发送前消除竞态。

### 5. Runtime terminal status 读取规范化嵌套结构

Codex `turn/completed` outcome 按 `params.status`、`params.turn.status`、`params.result.status` 的受控 alias 顺序读取。`replaced` 必须提交为 `Replaced`，不得回退为 `Completed`。该修复是事实准确性 guard，不触发自动重试。

### 6. Manual compact 由 durable Shared route 分支

Shared thread 不再按 id prefix 猜 CLI。backend 从：

1. unresolved Attempt 的 exact durable owner；否则
2. `shared_sessions_v2.selected_target_json`

解析 engine/provider，再读取匹配 Binding 的 native identity。Codex 进入 compaction barrier；Claude 调用既有 `/compact` 路径并显式传 provider profile；其他 engine 返回 unsupported。

Claude prompt-overflow recovery 不改写：仍由同一个 `engine_send_message` 调用内部完成 `/compact → retry once`，Shared owner 保持到最终 terminal。

### 7. Compaction UI 复用已有低频 status projection

`useLayoutNodes` 已拥有 `activeThreadStatus`。Shared Composer 直接消费其中的 `isContextCompacting`、Codex lifecycle/source/timestamps，不再硬编码 idle。native-to-shared bridge 已按 Binding 映射 lifecycle event，无需新增 root subscription。

## Risks / Trade-offs

- [Risk] client-store queue 写入是 debounced，进程在 300ms 内崩溃可能丢最后一次 enqueue → enqueue/删除使用 immediate write；normal UI update 仍保持局部 state。
- [Risk] compaction lifecycle event 永久缺失会让 send 等待 → 使用既有 in-flight timeout；超时后释放 barrier并记录 diagnostics。
- [Risk] stale terminal 与下一次 pending send 交错 → terminal 不得清除已 reserve 的 user dispatch。
- [Risk] frozen Target 后续变为 unavailable → fail closed，保留 queue item，不切换 Provider。
- [Risk] Claude manual compact 与 active Shared Attempt 并发 → active Attempt 时拒绝 manual compact；Claude overflow recovery继续由其内部串行路径负责。
- [Trade-off] 不新增 backend queue table，canonical log 在 drain 前看不到 queued intent；这是复用当前产品 queue contract 的边界，runtime side effect 仍保持 durable-first。

## Migration Plan

1. 先提交 capability resolver、nested status 与 Codex state-machine tests。
2. 接入 compaction/send barrier及 manual Shared route。
3. 接入 Shared queue frozen envelope、persistence、typed drain 与 Fusion cutover。
4. 接入 Composer lifecycle projection并同步 executable contract。
5. 只跑受影响 Vitest、Rust module tests、typecheck、`cargo fmt --check`、targeted `cargo check` 与 OpenSpec strict validation。

Rollback 可按上述批次逆序回退；无 DB migration、无不可逆数据变更。旧 client-store 不含新 key 时按空 queue 处理。

## Open Questions

无阻塞项。backend canonical queued-intent 可在未来单独 capability 中评估，不纳入本次恢复范围。
