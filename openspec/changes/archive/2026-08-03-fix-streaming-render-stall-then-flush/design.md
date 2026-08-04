## Context

`liveAssistantTextChannel` 已把正文 delta 从根 reducer 热路径外移，但此前每个 delta 都同步 `notifyThread`。订阅行收到更新后，`MessageRow` 使用 `useDeferredValue`，Markdown scheduler 又使用 `startTransition`。在 delta 持续到达、主线程已有 render pressure 时，background render 可被后续输入反复打断，形成“数据已到 channel，但可见 DOM 长时间不前进”的一个放大因素。

后续排查确认了独立的 cross-layer root cause：

1. Codex `BatchedTauriEventSink` 把普通 event 留在 40ms queue，却让 `turn/completed` 等 critical event 立即单独 emit；
2. unified frontend `appServerEventBackpressure` 对同一批事件再次让 critical event 同步 bypass；
3. frontend terminal guard 在 settlement 后拒绝 late delta / item completion。

MiniMax-M3 的 sparse / bursty output 使 final content 与 terminal 更容易落入同一竞态窗口，但 provider behavior 只是放大器。实现必须保留 phase attribution，区分：

1. runtime/source delta arrival；
2. live channel accumulated；
3. published snapshot notification；
4. row render / Markdown rendered value；
5. terminal reducer settlement；
6. Shared authoritative owner defer / overflow。

上一变更已将 `TIMELINE_ADAPTIVE_RENDERING_ENABLED` 硬禁用。conversation lightweight mode、virtualized canvas 与 anchor 坐标迁移不属于本设计；本设计不得暗中恢复它们。Markdown 的 staged streaming rendering 是 row 内部增量策略，与 conversation lightweight mode 不是同一功能。

## Goals / Non-Goals

**Goals:**

- channel 对每个 delta 无损累积，但只按 bounded cadence 发布给 React。
- `useSyncExternalStore` snapshot 在通知之间保持稳定。
- 首段立即可见；稳定 streaming 使用 48ms trailing cadence。
- clear / drain / rename / reset 与 terminal 路径不会丢掉尚未 published 的正文。
- 移除同一路径上的重复 interruptible scheduling。
- settlement terminal 不得越过同 sink / 同 workspace 已接受的 causal predecessors。
- interactive critical event 保持 urgent，不因 terminal ordering 修复退化为普通队列事件。
- 用 focused tests 覆盖 timer、终态与 thread migration 边界。

**Non-Goals:**

- 不提供“150ms 内 DOM 必定 commit”之类浏览器无法保证的硬实时 SLA。
- 不使用 byte threshold 绕过 cadence frequency cap。
- 不恢复 virtualization、conversation lightweight mode、渲染预算提示或 anchor 坐标切换。
- 不修改 Shared authoritative owner barrier、provisional owner binding、其他 engine adapter 或当前无 production subscriber 的 `AgentEventBus`。

## Decisions

### 1. accumulated entry 与 published snapshot 分离

每个 thread 保留：

- `entriesByThread`：权威内存累积值，逐 delta 更新；drain 从这里读取。
- `publishedEntriesByThread`：仅在 notify 前更新；`getSnapshot` 只读这里。
- `publishTimersByThread`：最多一个 trailing timer。
- `lastPublishedAtByThread`：计算剩余 cadence。

伪代码：

```text
append(thread, item, delta):
  next = append(entriesByThread, delta)
  if new item:
    cancel pending timer
    publish(next) immediately
    return first
  if cadence elapsed:
    publish(next) immediately
  else:
    ensure one trailing timer
  return growth

trailing timer:
  read latest accumulated entry
  publish(latest) once
```

备选：只 debounce。拒绝，因为连续流会一直推迟。采用 throttle + trailing，确保持续输入下仍有 bounded publish opportunity。

### 2. terminal 操作以 accumulated value 为准

- `drainLiveAssistantTextTail` 先取消 timer，再从 accumulated entry 计算 `tailDelta`，删除 accumulated / published 状态并通知一次。
- `clearLiveAssistantText` 同步取消 timer，删除双方状态并通知一次。
- `reset...ForTests` 清掉所有 timer，再清 map / listeners。
- `renameLiveAssistantTextThread` 把 accumulated 与 published snapshot 迁移到新 thread；旧 timer 取消，新 thread 立即 publish latest accumulated value，避免闭包回写旧 id。

备选：等待 trailing timer 后再 terminal。拒绝，因为 terminal 顺序必须权威且不能依赖 timer 是否获调度。

### 3. channel-backed row 绕过 `useDeferredValue`

`MessageRow` 仍为非 channel 路径保留既有 deferred 策略；当 `liveAssistantText !== null` 时，`streamingDisplayText` 直接使用 channel published text。channel 已是速率边界，再 defer 一次只会增加可中断窗口。

### 4. scheduled Markdown commit 不使用 `startTransition`

Markdown 的 48–220ms timer / progressive step 已经是 bounded scheduler。timer 触发后直接 `setState`，避免每次都进入可被新 value 重启的 transition。复杂度控制仍由原 throttle 与 progressive chunk 保留，不增加新 abstraction 或 dependency。

备选：为 transition 增加超时升级队列。拒绝，状态机更复杂，而现有 timer 已提供唯一所需节奏。

### 5. diagnostics 只证明 phase，不泄漏正文

复用现有 `streamLatencyDiagnostics` 的 bounded event pattern，记录 thread/item identity 的已有安全摘要、长度、version、pending age 与 phase timestamp。Shared owner defer/queue overflow 必须作为独立 upstream phase；本轮不得把它写成“无关”或把 frontend 修复当成对它的替代。

### 6. terminal critical 与 interactive critical 分离

`turn/completed`、`turn/error`、`runtime/ended` 是 settlement barrier。它们可以绕过 timer 等待，但不得越过此前已接受的正文、snapshot 或 `item/completed`。

`approval/request`、`item/tool/requestUserInput`、`collaboration/modeBlocked`、`collaboration/modeResolved` 是 interactive urgent event。它们不建立 turn terminal quarantine，继续保留现有 immediate bypass。

备选：所有 critical event 都先 drain predecessors。拒绝，因为大量正文可能不必要地延迟 approval / user input。

### 7. Codex backend 只修真实 reorder boundary

Codex batch sink 收到 settlement terminal 时，通过 per-sink emit-order lock 串行化 ticker 与 critical emitter，并在 state mutex critical section 内：

```text
acquire emit-order lock
drain queued events for terminal.workspace_id
append terminal
update queued_bytes / flush statistics
release state lock
emit one ordered batch
release emit-order lock
```

state lock 不跨 `app.emit`，避免阻塞普通 submit；dedicated emit-order lock 必须覆盖“ticker drain ownership → emit”，否则 ticker 已 drain 但尚未 emit 时，terminal 仍可抢先。其他 workspace queue 不动。Claude / Gemini / Kimi / Grok / OpenCode 当前使用 sequential direct `app.emit`，没有这层 Rust queue，不修改各自 adapter。`CCGUI_APP_SERVER_EVENT_BATCH=0` 的 single sink 也不在 backend 重排，但仍由下一层 frontend contract 保护。

### 8. unified frontend backpressure 建立 causal terminal barrier

`createEventBackpressure` 增加 optional `criticalBarrierKey(event)`。只有 app-server event 配置该 option，terminal 返回 `workspace_id`，interactive critical 返回 `null`。

terminal push 时从当前 backpressure queue 提取相同 barrier key 的 predecessors，保持它们的原始顺序，先交给已有 downstream render scheduler，再交付 terminal。其他 workspace event 留在原 queue。这里同步发生的只是 queue ownership transfer；React reducer / render 仍由既有 budgeted scheduler 分片执行。

备选：

- 把 terminal 降为 non-critical：会被 unrelated workspace 队列阻塞；
- terminal 前 drain 全局 queue：破坏 workspace isolation；
- 在每个 engine adapter 单独修：重复 policy，且无法覆盖 frontend 第二次重排。

## Risks / Trade-offs

- [Risk] 48ms cadence 降低每秒 row render 数，但每次 published 文本跨度更大 → 保留 Markdown 复杂度分档与 progressive reveal。
- [Risk] rename 与 trailing timer 竞态产生旧 thread 回写 → rename 取消旧 timer并同步发布迁移后的 latest accumulated entry。
- [Risk] clear 时 published 已为空、accumulated 仍存在等不一致 → 所有终态操作集中清理双方 map，并只在可观察 snapshot 变化时通知。
- [Risk] 去除 `startTransition` 可能让单次 Markdown render 更紧急 → 不移除 48–220ms throttle；focused test 验证 cadence，真实设备继续由现有 latency diagnostics 观察。
- [Risk] 主线程被同步长任务占用时 timer 仍会延迟 → 文档明确 cadence 是 publish opportunity，不是 DOM hard deadline；下一步依据 phase evidence 处理真正长任务。
- [Risk] terminal 前存在大量同 workspace predecessors，settlement 可见时间会后移 → 这是 causal correctness；predecessors 只同步移交给 scheduler，不同步执行 reducer。
- [Risk] generic backpressure 行为被意外改变 → `criticalBarrierKey` 是 optional，terminal-output/runtime-status 等既有 caller 不启用。
- [Risk] Shared replay 与 live fan-out 竞态 → 保持现有“非空 drain 不放行、空 drain 原子清 barrier”contract，并用 projected event integration test 验证，不预防性重构 coordinator。

## Migration Plan

1. 先落 delta specs 与设计文档修订。
2. 修改 channel 与 focused unit tests。
3. 修改 row / Markdown scheduler 与 focused hook tests。
4. 修复 Codex Rust terminal barrier 与 unified frontend causal barrier。
5. 运行 focused Rust/Vitest、typecheck、定向 ESLint、OpenSpec strict validation。
6. 保持 `ccgui.perf.liveTextExternalization` 与 `CCGUI_APP_SERVER_EVENT_BATCH=0` 既有 rollback；无需新增永久 flag。

## Open Questions

- 48ms 是否在 Windows WebView2 上需要平台校准，以真实设备 trace 为准；本轮不按 OS 分叉。
- `AgentEventBus` 的 critical lane 优先语义在出现 production subscriber 前单独审计；本轮不借机扩散。
