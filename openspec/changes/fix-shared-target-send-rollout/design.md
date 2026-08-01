## Context

基石设计把 Shared Session 定义为 `Canonical Shared Thread + selected ExecutionTarget + Hidden Bindings`。Phase 1 明确 dark launch，Phase 2 与 Change B 则要求真实 Send 切到 V2。当前实现已完成 Picker 与 V2 durable facts，但所谓 Provider-aware Runtime dispatch 实际仍由 V2 wrapper 调用 V0 command；canonical Target 与 Runtime flat fields 是两套权威。早期 rollout flag 缺省回到 V0 的问题虽已修复，却没有修复真正的 Runtime authority。

另一个缺口是 Rust `SharedSelectedTarget` 只保存 Engine/Provider，而前端 `selectedNextTarget` 是 memory-only。进程重启后 Model/Reasoning 丢失，违背 `SharedSessionMetaV2.selectedTarget: ExecutionTarget`。

## Goals / Non-Goals

**Goals:**

- 默认配置进入已经建成的 V2 Send。
- 显式保留 V0 rollback，且 rollback 不删除 V2 facts。
- 持久化、加载并重新注入完整 `selectedNextTarget`。
- 在现有 send boundary 证明 Provider/Model 精确透传和 fail closed。
- 由 Rust 按 `attemptId` 读取 durable `turnRequested` 并执行，不接受 frontend 重复声明
  Target。
- 将 `modelCatalogEntryId` 与 runtime `model` 分域并执行精确 pair validation。
- 让 Picker 只选择、Binding 只在发送阶段 provision，V2 binding state 成为唯一权威。
- 将 canonical terminal assembly 放到 Runtime lifecycle owner，保留 Reasoning/Tool/
  Artifact/structured outcome。
- 新 V2 Turn 默认从 canonical projection 读取，legacy history 通过 dual-read 保留。
- 每轮 label 始终来自该轮 immutable snapshot。

**Non-Goals:**

- 不扩展 V0。
- 不改变 Native Session。
- 不重建 Context Compiler 或 Picker UI。
- 不改变 Native Session runtime/history ownership。
- 不新增依赖。

## Decisions

### D1：flag 使用 default-on + explicit-negative rollback

判定优先级：

```text
localStorage explicit true/false
  → build flag explicit true/false
  → default true
```

继续使用同一个 key 和 build env，避免引入第二套 rollout 配置。`false/0/no/off` 是明确回滚；删除 override 恢复 build/default。相比仅在打包环境补一个 env，该方案可防止 dev、test、不同发行脚本再次漂移。

### D2：V0 保留，但仅路由器可显式选择

不删除 `sendSharedSessionTurn`，因为 Change B 要求可回滚。正常入口 `sendSharedSessionTurnRouted` 默认走 V2；V0 不获得 Provider 字段，防止形成第二条“半 V2”生产链路。

### D3：新 Session 与 selection persistence 从第一笔起只接受完整 Target

在现有 meta JSON 的 `selectedTarget` 上增加可选字段：

- `modelCatalogEntryId`
- `model`
- `reasoning`
- `providerProfileNameSnapshot`
- `providerProfileSource`

旧文件通过 serde defaults 兼容；但新建 Shared Session 必须传完整
`initialTarget`，缺失 `modelCatalogEntryId`、runtime `model`、可读 Provider snapshot
或 source 时，在创建目录/meta 前 fail closed。`selectedEngine` 只允许由
`initialTarget.engine` 派生为 V0 rollback mirror；两者不一致时拒绝，禁止先创建
Engine-only Session 再靠 global selection 补齐。

Shared UI 只允许四级 `ExecutionTarget` selector。Engine-only `ConfigSelect` /
`onSelectEngine` 在 Shared surface 不可达；兼容字段不能成为第二个 production
selection authority。

Picker selection 采用 `persist-first → publish store`：只有完整 Target 成功写入 meta
后才更新 `selectedNextTarget`。持久化失败保留旧 UI Target 并显式报错，不能产生
memory/disk drift。

selection persistence 禁止创建 pending Native Thread、写
`bindings_by_engine/bindings_by_target` 或触碰 V2 `shared_binding_state`。Binding 只能由
发送阶段基于 frozen attempt Snapshot provision。

### D4：加载边界一次性 hydrate target store

`load_shared_session` 返回 `selectedTarget`；Shared history loader 在加载成功时用该值初始化对应 thread 的 `selectedNextTarget`。这是一条 Session 级低频状态更新，不进入 AppShell 高频事件链。

### D5：测试锁定真实 Runtime side effect，不依赖模型自报或 mocked RPC

回归测试必须通过 fake Runtime/session registry 观测实际 Provider process key、
Binding 与 `turn/start.model`。只检查 `sharedSessionV2BeginTurn`、mocked
`sendSharedSessionMessage` 或直接调用 begin/commit core 不构成路由证据。Runtime 自报
只作为用户手工 smoke evidence。

### D6：Provider source 分域强类型，只在 freeze boundary 转换

Foundation executable schema 定义：

```text
CatalogProviderSource   = "disk" | "managed"
CanonicalProviderSource = "local" | "managed"
```

两者不能继续共用裸 `string`。Picker、catalog 和 persisted `selectedNextTarget` 保留
selection-domain 的 `CatalogProviderSource`；`TurnExecutionSnapshot`、
`SharedV2ExecutionTargetPayload` 与 Rust canonical DTO 只允许
`CanonicalProviderSource`。

唯一转换发生在 `freezeTurnSnapshot`：

```text
selection "disk"    → canonical "local"
selection "managed" → canonical "managed"
missing + no profile id → canonical "local"
missing + managed profile id → absent（不猜测 legacy identity）
unknown persisted value → loader boundary 丢弃该 source，不进入 send
```

Rust `ExecutionTargetInput` 和 canonical `TurnExecutionSnapshot` 复用同一个 serde enum。
因此 backend 收到 `"disk"` 或未来未知值时会在 IPC/canonical boundary fail closed，
而不是暗中修正。`SharedSelectedTarget` 属于 selection persistence，继续保存
`"disk" | "managed"`，以便 reload 后恢复 Picker。

`resolveSnapshotProviderLabel` 继续只读兼容 legacy `"disk"`，但新 canonical facts 只产生
`"local" | "managed"`。

### D7：Shared Composer 拆分 Input、Submit、Picker 三类 gate

`disabled` 是 ChatInputBox 的 hard interaction gate，会直接设置
`contentEditable = false`。它不能承载 Shared Send 的线性顺序约束。

采用三个独立 selector：

```text
Input gate  = cancel-pending | recovery-required
Submit gate = state != idle
Picker gate = state != idle，target-unavailable 除外
```

因此 `preparing-context`、`awaiting-acceptance`、`running`、`settling` 期间用户可继续
编辑下一条草稿，但所有 submit 入口必须 fail closed 且不得清空草稿。当前阶段不把该草稿
解释为 Queue 或 Steer；只有状态回到 `idle` 后才能提交。`cancel-pending` 与
`recovery-required` 属于 ambiguous ordering，继续锁定整个 Composer。

Submit gate 同时落在 ChatInputBox 的统一 submit handler 与 Composer orchestration
boundary：前者防止 Enter/按钮先清空草稿，后者防止 quick command、fork 或未来
programmatic caller 绕过。

拒绝方案：

- 在 Rust `to_snapshot()` 临时执行 `disk → local`：错误 selection 值仍跨过 IPC，
  TypeScript contract 继续失真。
- 把全项目统一为 `local | managed`：会抹掉 Native catalog 的 disk/provider-home
  来源语义，影响范围超出 Shared。
- 放宽 canonical schema 接受 `disk`：违反 Foundation/Wave 0 SSOT。

### D8：Rust coordinator 在 UI fan-out 前拥有 lifecycle，并以 atomic replay barrier 接管早到事件

`runtimeTurnId` / `runId` 在一次 Runtime Run 内不可变；`nativeThreadId` 会在
pending Binding materialize、Native Session identity ACK、Shared owner projection 时
变化。Rust `SharedRuntimeCoordinator` 的 owner matcher 采用：

```text
双方都有 runtimeTurnId → workspace + engine + runtimeTurnId exact match
任一方缺 runtimeTurnId → workspace + engine + nativeSessionId fallback
```

禁止要求 `runtimeTurnId + nativeThreadId` 同时相等。也禁止在 Runtime start ACK 前把
复用 Binding 的 `nativeSessionId` 注册给新 Attempt；旧 Turn 的迟到 event 可能携带同一
Native identity。

Runtime event 必须先进入 coordinator，再进入普通 `AppServerEvent` fan-out。start ACK
前无法认领的 ingress 暂存为 bounded unowned event。`bind_runtime_turn` 在同一 lock 内：

```text
register exact runtime identity
  → open attempt replay barrier
  → move now-owned early ingress into ordered barrier queue
```

barrier 存在期间，早到与新到 visible ingress 全部排队。dispatcher 循环 drain，每个
batch 必须先 publish authoritative observation，再 emit projected UI event；只有一次
drain 在 coordinator lock 内观察到空队列时才清 barrier。这样 bind 与 replay emit 之间
到达的新 event 不能越过早到 event。

Claude replay user-message 的 exact package/checksum marker 是 Context ACK。它必须在
barrier 内立即应用并唤醒 ACK waiter，避免 dispatcher 等 ACK、barrier 又等 dispatcher
drain 的死锁；其余 assistant/reasoning/tool/terminal 仍按 arrival order 排队。

Frontend observer 只负责可见 terminal 等待与状态推进，不再组装或提交 canonical
assistant text。canonical lifecycle 始终由 Rust
`Runtime Event → SharedRuntimeCoordinator/Assembler → Critical Commit Sink` 拥有。

### D9：Restore 必须带 store mutation revision

`state === idle` 不是足够的 stale-response guard：一次完整
`idle → running → settling → idle` 后值再次等于 `idle`，旧 RPC 仍可能覆盖新状态。

每个 Shared Thread store key 维护单调 `revision`。Restore 发起前冻结 revision；
响应返回时仅当 revision 未变化且状态仍为 `idle` 才允许 hydrate。revision 只存在内存，
不进入 React root state，也不增加 polling。

### D10：Durable Attempt Snapshot 是唯一 Runtime Authority

携带 Target 的 `shared_session_v2_prepare_context` 只允许作为 read-only preview：
可以校验 Target、读取现有 Binding/Cursor、编译 Manifest 预览，但不得创建 Attempt、
写 `deliveryPrepared`、推进 Cursor、物化 Binding 或调用 Runtime。

`shared_session_v2_begin_turn(target, text)` 是 production lifecycle 唯一接收完整 Target
的 mutation，并先落盘 `conversation.turnRequested`。此后 V2 Runtime mutation 只接收
`workspaceId/threadId/attemptId`、artifact identity 与非 Target operational options。
Rust 在产生任何 CLI side effect 前读取 durable Attempt：

```text
begin_turn(target snapshot)
  → load requested fact by attemptId
  → validate exact model identity
  → resolve/provision binding from snapshot
  → prepare_delivery(attemptId) from the same snapshot
  → dispatch adapter from the same snapshot
  → internal accept_context/accept_turn from real Adapter evidence
  → terminal commit from coordinator settlement
```

frontend 不再向 V2 actual-send 传
`engine/model/effort/providerProfileId/text/logicalTurnId/bindingKey`。Context/Prompt
acceptance 是 dispatcher 内部 mutation，frontend 不得调用独立 accept command 伪造
ACK。`prepare_delivery`、dispatch、commit、recovery、interrupt 全按 attempt 派生；
任何重复 Target 不能成为执行输入。目标不是“传两份再比较”，而是让类型层无法表达
`canonical=A/runtime=B`。

### D11：Model selection identity 与 Runtime identity 分域

Frozen target 同时保存：

```text
modelCatalogEntryId  // UI/catalog identity
model                // Runtime identity
```

Backend 必须在同一 Engine、同一 Provider-scoped catalog 中验证：
`candidate.id == modelCatalogEntryId && candidate.model == model`。legacy snapshot 缺少
catalog id 时，只允许按 `candidate.model == model` 验证；禁止用 `candidate.id == model`
放行。验证失败在进程启动、Binding materialize 或 prompt side effect 前 fail closed。

复用 Native Provider Continuation 已有 pair validation 规则，提取共享 helper；不复制
第二套宽松 matcher。

### D12：Binding 单一权威与发送时 provision

V2 只读写 SQLite `shared_binding_state`，key 为
`(workspaceId, sharedThreadId, engine, providerProfileId)`。Picker 不创建 Binding。
legacy meta 的 `bindings_by_engine/bindings_by_target` 只用于 V0 rollback 或一次性兼容读取，
不得覆盖 V2 state。切换 Target 创建/复用对应 Binding；切回原 Target 必须复用其 Binding。
Provider failure 必须保留原 Target 并失败，不得回退 default Provider。

`probe_binding(bindingKey)` 是 read-only evidence query。显式
`rebuild_binding(bindingKey)` 也不能接受 caller 提供的 Engine/Provider；它必须先加载
对应 durable row，再从 row 派生 Target、归档旧 Native identity 与创建新 provisioning
intent。bindingKey 不存在、row identity 不完整或 key/row 不一致时 fail closed。Recovery
UI 不得借 rebuild 形成第二套 Target authority。

### D13：Runtime-owned Canonical Terminal 与 Projection

Runtime adapter 在普通 UI fan-out、delta throttle/drop 之前把 authoritative events 交给
attempt-owned assembler。Assembler 收集正文、Reasoning/Redacted Reasoning、Tool
call/result、Artifact、private refs/omissions 与 structured outcome；`run.settled` 触发
Rust critical sink 幂等写入 `conversation.turnCommitted`。terminal snapshot 必须能覆盖
delta accumulation 的不完整正文；duplicate terminal 只保留第一次同 owner settlement。
commit 失败时 settlement cache 保留，供 `commit_turn/probe` 重试；durable commit 成功后
才清 Runtime owner、identity index 与 replay barrier。

新 V2 facts 默认由 canonical projection 消费。Legacy Shared 使用 dual-read 合并，
不得读 Native CLI session files，也不得删除 V0 history。Turn badge 以
`attemptId/logicalTurnId → immutable snapshot` 投影；live、failed、cancelled、reload 后
均不读取当前 Picker。Reasoning-only/tool-only completed Turn 生成无可见正文的 provenance
anchor，仍携带 per-turn CLI/Provider/Model label。

Shared Context Package prompt echo 是 Runtime transport evidence，不是第二条用户消息。
presentation classifier 只隐藏严格匹配版本、package/checksum 双 marker 与完整 envelope
的重复 user echo；它不能吞掉后续 assistant/reasoning/tool，也不能用宽泛
`includes("MOSSX")` 误杀用户正文。原始 Runtime/Canonical evidence 不删除。

### D14：Interrupt 先冻结 attempt-owned cancel intent

`shared_session_v2_interrupt_turn(attemptId)` 从 durable Snapshot +
`SharedRuntimeCoordinator` owner 解析 Engine、Provider、Binding、native Thread 与 exact
runtime Turn；不能回退当前 Picker、active Engine 或 workspace-wide route。

调用 Runtime interrupt 前先在 coordinator 登记 cancel intent，防止 Runtime 同步发出的
`TurnError` 抢先按 failed 结算。intent 存在时该 Attempt 的 Runtime error 归一为
`cancelled`；若 interrupt side effect 自身失败，必须清除 intent，使后续真实 error
保持 failed。settled Attempt 禁止再次登记 cancel intent。

### D15：Composer admission 使用一次性 mutation revision

早期 `getSharedSendState() === idle` 只能作为快速 preflight，不能充当并发发送锁：两个
caller 可以同时通过只读检查，再在异步上下文准备后分别创建 optimistic message。

真正的 admission 必须在最后一个异步 preflight 之后、任何 optimistic message、
activity timestamp 或 processing mutation 之前同步执行：

```text
async preflight
  → tryAcquireSharedSend()        # idle → preparing-context，返回 revision
  → optimistic / activity / processing
  → sendSharedSessionTurnV2()     # exact revision 只能消费一次
```

旧 revision、重复消费或 non-idle caller 全部 fail closed，且 Runtime RPC 为零。handoff
前同步失败只允许按 exact unconsumed revision 释放，不能误解锁另一个 caller 或已创建的
Attempt。

### D16：Recovery Probe 必须执行真实 owner query

Recovery UI 不能把“显示 Probe 按钮”当成已经定性。存在 durable Attempt 时调用
`recover_attempt(attemptId)`；只有 recovery-required Binding 时先调用
`probe_binding(bindingKey)`，若返回唯一 Attempt 再按其 identity 恢复。零个/多个
Attempt、`unknown` 或 Probe/Rebuild RPC 失败都保持锁定；失败必须可见。只有明确
terminal/not-accepted evidence 或无任何 recovery owner 时才能回到 `idle`。

### D17：Shared terminal 与 degraded context 使用 Engine-neutral 默认行为

Shared Runtime dispatch 的同步返回只证明本次 Attempt 已被 Adapter 接受，不证明 Run
已经结束。所有 CLI 统一采用：

```text
dispatch returns accepted start ACK
  → await backend exact-Attempt settlement
  → confirm durable conversation.turnCommitted
  → idle
```

禁止根据 `engine` 要求某个 Adapter 必须同步返回 terminal。新增 CLI 只需提供 typed
dispatch ACK 与 Attempt-owned terminal ingress，即可复用同一 durable 收敛流程。

Context Package 的 `degraded` 表示“可发送但存在 fidelity loss”，不再表示需要人工审批。
Shared Send 自动携带可迁移内容和当前 user request，Manifest 继续持久化 omissions、
dispositions、compression 与 mode 供历史/诊断使用。compile failure、ownership mismatch、
ambiguous ACK 与 Provider rejection 仍 fail closed，不能借自动发送绕过。

### D18：Shared Send 的控制终态必须由 backend durable await 收敛

D17 仍遗漏了一条关键 trust boundary：frontend `app-server-event` 能证明“UI 看到了某个
terminal”，却不能作为“一次 Shared Send 已完成”的 authority。Claude 的 detached
forwarder、Tauri emit、WebView listener 或订阅安装时序任一处丢失 transient event，都可能
出现 canonical SQL 已完成、通知音已播放，但 Composer 仍永久 `running`。

统一 contract：

```text
Runtime terminal
  → SharedRuntimeCoordinator settlement signal
  → Rust critical sink idempotently commits conversation.turnCommitted
  → shared_session_v2_await_turn_terminal(attemptId)
       1. check durable turnCommitted
       2. consume cached exact-Attempt settlement when present
       3. await exact-Attempt settlement notification
       4. re-check durable turnCommitted after every wake/removal race
  → frontend runSettled + canonicalCommitted
  → idle
```

- `conversation.turnCommitted` 是成功结束 control flow 的最终证据。
- coordinator notification 只负责无 polling 地唤醒 backend waiter；不是第二份 durable
  truth。settlement 被 event sink 先 commit 并 remove 时，waiter 必须通过 SQL re-check
  正常返回。
- projected `app-server-event`、Agent Event Bus 与 inline terminal 继续服务 rendering、
  notification sound 和 diagnostics，但不得决定 Composer 是否结束。
- command 只接受 Workspace/Shared Thread/Attempt identity；Target、Engine、Provider、
  Runtime identity 均从 durable Attempt 派生。
- timeout 只表示终态仍无法定性，才进入 recovery；不得因 frontend listener 漏事件把已
  commit Attempt 标成 recovery。
- Claude、Codex 与未来 CLI 共享同一 command；Native Session lifecycle 完全不变。

### D19：Provider Logical Terminal 与 CLI Cleanup 分离

`EngineEvent::TurnCompleted` 不能同时隐含“业务结果已确定”和“CLI process 已清理”两种
语义。Claude CLI 会先发 typed `result`，随后才等待 stdout/stderr、Stop hook、MCP child
与 usage probe 收尾；若 Shared coordinator 只承认后者，正文已完整显示后 Composer 仍会
无意义地保持 Stop。

统一规则：

```text
typed Provider final/result
  → exact Shared owner validation
  → terminal evidence / run.settled
  → durable commit / frontend idle

late TurnCompleted / process exit / pipe drain / usage
  → cleanup-only duplicate
  → exactly-once absorb
```

- Claude `Raw result` 只在 `engine=Claude` 且 ingress 已归属 exact Shared Attempt 时提升为
  terminal；Native Claude 继续沿原 cleanup 后 `TurnCompleted` 路径。
- `is_error/subtype/api_error_status/terminal_reason/result` 必须归一为 typed outcome、
  error、stop reason 与 fallback final text，不能把失败 result 误判 Completed。
- 后到的 `TurnCompleted` 由 Attempt accumulator 的 exactly-once gate 吸收；不得重复
  commit、重复正文或复活 processing。
- 新 CLI adapter 必须明确区分 logical terminal evidence 与 cleanup completion
  evidence；只有前者拥有 Shared 控制终态。

## Risks / Trade-offs

- [V2 默认启用暴露残余缺陷] → 保留显式 negative rollback；只修改 Shared router。
- [旧 localStorage 仅支持 positive override] → parser 兼容旧 `"1"`；新增 `"0"` 表示 rollback。
- [meta schema 增量与旧版本兼容] → 字段全部 optional/default；继续写 `selectedEngine`。
- [loader 写 target store 产生重复通知] → target 等值时不写，且仅在 history load 时 hydrate。
- [历史 selectedTarget 已含未知 source] → loader 只接受 `"disk" | "managed"`；
  source 无效时保留其余 Target 字段但丢弃 source，发送冻结时不传播未知枚举。
- [跨语言 enum 再次漂移] → TypeScript exact payload tests + Rust serde/validator tests
  同时锁定 `"local" | "managed"`。
- [允许编辑被误解为 Queue/Steer] → 非 idle 只允许 draft mutation，不调用 `onSend` /
  `onQueue`，不产生新的 canonical fact。
- [Runtime authority 改造影响旧 rollback] → V0 command 保留给显式 rollback；V2 不再调用
  V0。两者不得静默互相 fallback。
- [persist-first 让 Picker 更新出现短暂等待] → selection write 是低频操作；保留旧 Target
  比展示未落盘 Target 更符合事实，失败显式 toast。
- [early replay 与 live ingress 交错] → bind/open/move 与 empty-drain/clear 都在同一
  coordinator lock 内；非空 batch 发布期间 barrier 保持，期间新 event 继续排队。
- [Context echo 被 barrier 阻塞形成 ACK deadlock] → exact ContextEcho action 在 queue
  boundary 立即应用，仅 visible actions 排队。
- [Cancel intent 污染普通 error] → interrupt side effect 失败必须 clear intent；terminal
  exactly-once 后拒绝二次 cancel。
- [两个 caller 同时通过只读 preflight] → optimistic UI 前使用一次性 revision 做原子
  admission；第二个 caller 不得产生 user bubble、processing 或 Runtime RPC。
- [Recovery UI 假 Probe] → Attempt/Binding 两条路径都必须调用后端 evidence query；
  RPC 失败保持 fail-closed 并显示错误。
- [Rebuild 仍成为 Target 修改入口] → public signature 只接收 bindingKey，Engine/Provider
  从 durable row 派生并校验。
- [canonical projection 接管造成 legacy history 缺失] → 采用 dual-read，migration marker
  前保留 legacy source；新 V2 Turn 只以 canonical facts 为真相。
- [terminal event 高频回灌 React root] → assembler 位于 Rust lifecycle owner，
  `liveAssistantTextChannel` 继续承载 streaming 文本，不恢复逐 delta reducer dispatch。
- [未来 CLI 复制 Engine 特判] → terminal completion contract 只按 ACK/terminal capability
  判断，不按 Engine enum 分支；inline terminal 仅是可选 fast path。
- [terminal 已 commit 但 transient event 丢失] → backend await 每次先查并在 wake 后复查
  `conversation.turnCommitted`；frontend event 只作 presentation，不作 control authority。
- [frontend polling 放大 root render] → await command 由 Rust exact-Attempt notifier 驱动，
  不新增 timer、root store polling 或 per-event React state。
- [typed final 被误当普通 Raw] → Shared coordinator 在 exact owner scope 内提升为 logical
  terminal；Native adapter 与 Native Session lifecycle 不变。
- [cleanup completion 再次到达] → Attempt accumulator exactly-once，后续 terminal 只作
  duplicate cleanup，不产生第二次 commit/回复。
- [自动 degraded context 隐藏迁移损失] → Manifest/Canonical Log 保留完整 omission
  diagnostics，但不再用底部确认条阻塞用户当前发送。

## Migration Plan

1. 先补 flag 与 router tests，证明默认 V2、显式 V0。
2. 扩展 Rust meta/command/load payload；新建要求完整 Target，旧文件仅兼容读取。
3. 前端 service 与 loader hydrate 完整 Target，并以 persist-first 关闭 memory/disk drift。
4. 拆分 selection/canonical source 类型，并在 freeze boundary 建立唯一 mapper。
5. Rust canonical DTO 改为 enum，补 local/managed/unknown contract tests。
6. 跑相关 Vitest、Rust 定向测试、typecheck、OpenSpec strict validation。
7. 删除 V2 actual-send 的 V0 wrapper；`begin_turn` 后所有 mutation 改为 attempt-only，
   acceptance 只由 dispatcher 内部真实证据触发。
8. 统一 V2 Binding authority；rebuild target 从 durable row 派生。
9. 接入 Rust Runtime-owned assembler、atomic replay barrier 与 cancel intent；默认
   canonical projection，并补逐轮 badge/strict prompt echo filter。
10. 用 fake Runtime、canonical reload、poisoned legacy fields 与 early-event fixtures
    跑增量回归。
11. 补 Composer atomic admission race 与 Attempt/Binding Recovery Probe 回归。
12. 用户手工验证 CLI/Provider/Model 切换、Reasoning、控制操作与重开恢复。
13. 以 backend durable await 替换 frontend transient terminal control wait；补“UI event
    完全缺失但 SQL 已 commit”回归。
14. 将 Provider typed final 与 CLI process cleanup 分域；Shared-owned Claude `result`
    立即进入 Attempt terminal，迟到 cleanup terminal 幂等吸收。

Rollback：写入 `mossx.sharedV2Send = "0"` 或 build flag `VITE_MOSSX_SHARED_V2_SEND=false`。V2 Canonical facts 与完整 meta 不删除。

## Open Questions

无。当前缺陷与既有 Phase 2/Change B 契约完全对应。
