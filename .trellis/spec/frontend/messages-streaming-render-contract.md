# Messages Streaming Render Contract

本文件适用于 `src/features/messages/components/Messages.tsx`、`MessagesTimeline.tsx`、`MessagesRows.tsx`、`Markdown.tsx`、`LiveMarkdown.tsx` 这一条 live conversation render pipeline。

## Scope / Trigger

- Trigger：修改 live assistant streaming、timeline grouping、anchor rail、sticky user bubble、turn boundary、Markdown progressive reveal、visible render diagnostics。
- 目标：保证长文 streaming 时，live row 持续可见增长，同时父层重派生不再被每个 text delta 拖入热路径。

## Why This Exists

- 本 contract 来自一次真实的 `Codex` 长文 streaming P0 卡顿：前段输出丝滑，但中后段开始整客户端按钮失去响应，幕布只能偶尔滚动，最终常常等输出完才一次性刷出。
- 根因不是单个 Markdown parse 慢，而是 parent timeline derivations 与 live text growth 耦合，导致 `grouping / anchors / sticky / final-boundary` 在长文尾段被反复全量驱动。
- 因此这里保护的重点不是某个 throttle 数字，而是数据流分层：`live row` 与 `stable parent snapshot` 必须分轨。
- 2026-05-15 的 Claude Code 流式卡顿修复进一步确认：`Codex` 与 `Claude Code` 的 live streaming 已进入成熟保护期。后续重构应默认保守，优先证明没有把 diagnostics、history reconcile、runtime ledger、process snapshot 或 parent timeline derive 重新塞回 stream hot path。

## Core Invariant

- `liveAssistantItem` / `liveReasoningItem` MAY 直接来自最新 `renderSourceItems`，保持实时可见增长。
- `groupToolItems`、`messageAnchors`、`historyStickyCandidates`、`assistantFinalBoundarySet`、`assistantFinalWithVisibleProcessSet`、`assistantLiveTurnFinalBoundarySuppressedSet` 这类 timeline-heavy derivations MUST 基于稳定的 deferred presentation snapshot。
- message outline / TOC floater 属于 auxiliary navigation state：它 MAY 跟随 live assistant Markdown 更新，但 MUST 以 throttled visible source 为边界，并通过 stable callback、source-keyed cache 与 idempotent state guard 避免反向驱动 live render hot path。
- parent timeline snapshot 可以附加“新插入的 live item id”，但 MUST NOT 因同一 item 的文本增长或 `isFinal` 翻转而在每个 delta 上全量重算整条时间线。
- deferred `renderSourceItems` / `presentationRenderedItems` snapshot MUST be scoped by `workspaceId + threadId`; tab/session 切换时 scope 不同的旧 snapshot 必须立即失效，禁止把上一会话的 grouped entries 与当前会话 live tail 混到同一幕布。
- streaming 结束后，stable snapshot MUST 自然收敛到 canonical latest presentation items；不得永久停留在旧快照。
- `liveTextExternalization` 只允许把逐 delta 文本移出 root reducer；terminal event MUST 将 Provider 的完整 final text 以同一 assistant item identity 一次性 settle 回 reducer。`seenDelta` 不能成为 Shared Session 跳过 terminal settlement 的理由，否则 snapshot persistence 会把首个 delta 永久误写为 final。
- `Claude Code` 与 `Codex` live row 收敛 MUST 先走 realtime path；history replay / reconcile 只能用于校验、补账或最终一致性，不得成为 live assistant text、reasoning、tool output 可见的唯一路径。
- backend diagnostics、runtime ledger persistence、Windows process diagnostics、first-token timing、context ledger 或 runtime pool refresh MAY 提供 observability，但 MUST NOT 成为每个 delta 的前置门槛。

## Shared Session Runtime / Projection Contract

- Shared Runtime event 的 canonical lifecycle owner 是 Rust
  `SharedRuntimeCoordinator`，不是 frontend terminal observer。authoritative
  observation/settlement MUST 在普通 `AppServerEvent` fan-out 前进入 coordinator；
  frontend 只消费已经投影到 Shared thread 的 live event 与 canonical history。
- Shared live event 的 `sharedOwner` MUST 携带
  `attemptId + logicalTurnId + bindingKey + engine + providerProfileId +
  executionTargetSnapshot`。embedded Snapshot 只要 malformed、Engine/Provider 与 owner
  冲突，就必须 fail closed；不得从当前 Picker 或 thread-level fallback 猜 Target。
- Runtime identity bind 前的 early event 与 bind 期间的新 event MUST 经 Rust atomic
  replay barrier 保序。每个 replay batch 必须先 publish authoritative observation，
  后 emit 对应 UI event；frontend 不得建立第二个 replay/terminal persistence authority。
- Shared canonical projection MUST default-on for new V2 facts。Legacy Shared history 通过
  dual-read 合并且按 stable Turn identity 去重；不得读取或拼接 Native CLI session
  files 来“补历史”。
- `conversation.turnCommitted` 的 assistant、Reasoning、Tool、Artifact、structured
  outcome 与 immutable Target 必须单向投影成既有 `ConversationItem` shape。
  presentation item 不得反向写 canonical fact。
- Reasoning-only / tool-only completed Turn MUST 生成空正文 provenance anchor，用来承载
  per-turn CLI/Provider/Model Badge；anchor 不得制造可见空泡或伪造 assistant 文本。
- Shared Runtime 的完整 Context Package prompt echo 只属于 transport/control。必须用
  strict versioned classifier 验证 package/checksum 双 marker 和完整 envelope 后，只隐藏
  重复 user echo；后续 assistant、Reasoning、Tool、Error 必须继续显示。禁止
  `text.includes("MOSSX")` 之类宽匹配。
- per-turn Badge MUST 只读 item 上的 immutable `executionTargetSnapshot`。Provider
  删除后使用 name snapshot + unavailable；explicit canonical `local` 才显示“本地配置”；
  legacy identity 不完整显示“历史配置未知”。

## Required Structure

- `Messages` 负责区分：
  - `renderSourceItems`：latest live source
  - `presentationRenderedItems`：当前真实 presentation surface
  - `timelinePresentationItems`：供 parent-level heavy derivations 消费的 stable snapshot
  - `history expansion mode`：manual reveal 与 jump-to-message reveal 必须分流；manual reveal 不得再用 `scrollHeight delta` restore 伪装“保视口”，而应进入稳定的 expanded-history presentation mode
- `MessagesTimeline` 负责：
  - 吃 `groupedEntries` / anchors / boundary sets 这类稳定派生
  - 用 `liveAssistantItem` / `liveReasoningItem` 对 active tail 做 override
  - 把 lightweight mode bar / history sticky header / collapsed-history reveal control 与 rows 放在同一个 `messages-full` padding contract 下；不要把顶部 surface 放在 timeline root 外再靠 offset hack 补位
- `messagesLiveWindow` 中的 snapshot helper 必须保持 pure helper 语义，方便单元测试锁定 contract。
- `sharedSessionBridge` 只负责验证/映射 Rust `sharedOwner`，不能从
  `selectedNextTarget` 拼 Snapshot。
- `sharedProjection/dataSource` 只负责 canonical Presentation mapping 与 legacy
  dual-read；不能读取 Native history，也不能把 unknown Provider 归一成 local。
- `contextProtocol` classifier 必须匹配完整 protocol envelope；过滤只发生在
  presentation boundary，原始 Runtime/Canonical evidence 保留。

## Forbidden Patterns

- 让 `groupToolItems(...)`、anchor/sticky 计算、final boundary 计算直接重新依赖最热的 live text source。
- 为了“看起来实时”，把整条 `presentationRenderedItems` 在每个 delta 上重新驱动到 parent timeline render。
- 在历史 reveal 时继续执行基于 `scrollHeight` 的 viewport restore，同时又切换 virtualized/static layout mode；这种 mixed strategy 会把顶部裁剪、抖动和重叠重新带回来。
- 把 lightweight mode bar、history sticky header 或 reveal control 放在 `messages-full` padding contract 之外，再额外给 root 塞 `padding-top` / sticky `top + 36px` 一类补丁。
- 在 JSX/render 中为 live assistant row 反复创建新的 outline callback，导致 `Markdown` effect 因 callback identity 抖动而重复扫描相同 `throttledValue`。
- 收到语义等价的 `{ messageId, outline }` 后仍提交新的 outline state object，造成 floater reset 或 timeline root rerender。
- 对同一个 throttled visible Markdown source 重复执行 outline full source scan；同源重复 effect 应复用最近一次 extraction result。
- 依赖 history reconcile 才看到 final Markdown / final boundary 的最终状态。
- 把这条 contract 退化成单纯的 throttle number 调优，而不保护数据流分层。
- 在重构中把 `Codex` / `Claude Code` 的 no-text interval 直接当成 terminal stuck；非文本 runtime activity、heartbeat、tool progress、request-user-input、reasoning delta 都可能是合法 progress evidence。
- 把 first-token diagnostics、process snapshot、runtime ledger write、context ledger persistence、history detail reload 插入 live delta emission 之前。
- 为了统一代码路径，删除 `liveAssistantItem` / `liveReasoningItem` override，或让 final visible state 只能等待 history replay。
- frontend 收到 Shared terminal 后自行拼 `assistantText/outcome` 并调用 canonical
  commit，形成 Rust 与 renderer 两个 terminal authority。
- `sharedOwner` Snapshot 无效时回退当前 Picker、thread metadata 或 Engine default。
- 为修复历史缺失，把 Hidden Binding 的 Native history 与 Shared canonical history
  直接拼接。
- 将 Context Package prompt echo 连同后续 assistant/reasoning 一起过滤。

## Validation Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| assistant 同 id 文本持续增长 | live assistant row 立即显示最新文本 | parent grouping/anchors/boundaries 每个 delta 全量重算 |
| assistant 同 id 从 non-final -> final | live row 可先拿到最新 final 状态；timeline boundary 允许在 deferred snapshot 上稍后收敛 | final boundary 必须同步卡住整条父层派生 |
| 新增 live tail item | stable snapshot 可立即追加新 id | 因稳定快照导致新 live item 完全不出现 |
| live assistant outline 重复上报 | 同 message + 同 outline entries 返回 previous state reference | 每次 callback replay 都创建新 outline snapshot |
| parent rerender 但 throttled Markdown 未变 | outline callback identity 稳定，或 Markdown 复用同源 cache | 因 callback identity 变化再次 full scan 相同 source |
| 切换 active conversation tab | 新 tab 只能消费同 `workspaceId + threadId` scope 的 stable snapshot | 上一会话 deferred snapshot 与当前会话 live row / working indicator 同屏 |
| streaming turn 完成 | stable snapshot 收敛到 canonical latest items | 停留在旧 boundary / 旧 grouping |
| Shared streaming 已收到 delta，随后收到 terminal full text | 同一 assistant item 一次性 settle 完整 final，并由 snapshot persistence 持久化 | 因 `seenDelta = true` 跳过 completion，只持久化首个 delta |
| Shared event 在 runtime identity bind 前到达 | Rust barrier 保序 replay，live row 不丢 | frontend 猜 owner 或永久丢 event |
| Shared event 的 embedded Snapshot 与 owner Provider 冲突 | 丢弃 Shared attribution/fail closed | 用当前 Picker 修正 |
| V2 history reload | canonical rich blocks + immutable Badge；legacy dual-read 保留 | 读取 Native session file 拼接 |
| reasoning-only / tool-only completed Turn | 无可见空正文，但保留 provenance Badge | 整轮 label 消失 |
| exact Shared Runtime prompt echo | 只隐藏重复 user transport item | 吞掉后续 assistant/reasoning/tool |
| 用户普通正文包含 `MOSSX` | 原样展示 | substring classifier 误杀 |
| Claude Code first token 慢 | diagnostics 标记 startup/first-token 阶段，UI 不伪造文本也不误判 frontend render stall | 把无首 token 归因到 Markdown/render 卡顿或强制 final-only 输出 |
| Claude Code delta 已到 backend forwarder | delta 先发给 frontend，diagnostics/ledger/process snapshot 后台或 checkpoint 执行 | 等 Windows process diagnostics、runtime ledger 或 history reconcile 完成后才发 delta |
| Codex 长时间无 assistant text 但有 runtime/tool 活动 | activity 计入 progress evidence，保持 non-terminal suspicion 或 normal processing | text-delta-only 判断导致误结算、误停止或误恢复 |

## Tests Required

- pure helper：覆盖“同 id 文本增长时复用 deferred snapshot”和“新增 live id 时追加到 stable snapshot”。
- pure helper：覆盖 deferred/current scope 不同时返回 current items，不能把当前 live items append 到旧 thread snapshot。
- `Messages` integration：覆盖“live assistant row 已拿到最新文本/最新 final 状态时，parent boundary set 仍可停留在稳定快照，然后再收敛”。
- `Messages` integration：覆盖 parallel Codex tab switch 时，新 `threadId` 的 `MessagesTimeline` 不接收旧 `threadId` 的 grouped entries。
- `Messages` integration：覆盖 manual history reveal 进入稳定 expanded-history mode，并把 viewport 复位到 revealed history head。
- `MessagesTimeline` integration：覆盖 expanded history 即使不再使用 absolute virtual canvas，也仍与 lightweight mode bar / sticky header 共享同一个 top-padding contract。
- regression：保留 `Codex` large streaming Markdown throttle / live row render path 测试，防止有人把问题误修成 plain-text-only fallback。
- outline regression：覆盖同一 throttled Markdown source 在 callback identity 变化时不重复 extraction；覆盖同 message + same outline 返回 previous snapshot reference。
- Claude Code regression：覆盖 first-token diagnostics 不阻塞 first visible delta，且 diagnostics/history reconcile 不成为 live delta 前置条件。
- Codex regression：覆盖 no-text 但有 heartbeat/tool/status progress 时不会 terminalize active turn；late stale progress 不能复活已 settled turn。
- Shared terminal regression：覆盖 Codex/Claude 在已收到 delta 后仍以原 assistant item id settle `turn/completed.result.text`，且 completion 只触发一次。
- Shared owner regression：覆盖 malformed Snapshot、Engine mismatch、Provider mismatch 均
  fail closed；valid owner 保留 `modelCatalogEntryId + runtime model`。
- Shared projection regression：覆盖 canonical default-on、legacy dual-read、failed Turn、
  reasoning/tool-only provenance anchor、Picker mutation 不改旧 Badge。
- Shared control-echo regression：覆盖 exact envelope 隐藏、ordinary `MOSSX` 文本保留、
  echo 后 assistant/reasoning/tool 仍显示。

## Review Checklist

- 是否把新的 timeline-heavy derive 又绑回 `renderSourceItems` / `presentationRenderedItems` 热路径？
- 是否给任何 deferred/stable snapshot 保留了 `workspaceId + threadId` scope guard？
- 是否仍然保留了 `liveAssistantItem` / `liveReasoningItem` 的最新 override？
- 是否新增了能证明“即时 live row + 延后父层派生”双轨 contract 的测试？
- 是否把 outline、TOC、diagnostics 等 auxiliary state 做成 stable / cached / idempotent，而不是让它们反向触发 live row 重算？
- 是否把 Claude Code first-token / backend-forwarder / frontend-render 三段 latency 重新混成一个“流式卡顿”判断？
- 是否把 Codex suspected silence 写成 terminal settlement，或把 progress evidence 收窄成只有 assistant text delta？
- 是否引入了任何每 delta 都执行的 process snapshot、runtime ledger write、history detail reload、context ledger persistence？
- 是否证明 externalized live text 在 terminal event 会完整回灌 reducer，而不是把 `seenDelta` 误当成“final 已持久化”？
- 是否把 Shared lifecycle truth 留在 Rust coordinator，frontend 仅消费 Projection？
- 是否验证 `sharedOwner.executionTargetSnapshot`，而不是从当前 Picker/thread metadata 猜？
- 是否证明 early/live ingress 在 replay barrier 前后保持顺序，且 observation 先于 UI fan-out？
- 是否让 canonical default-on 与 legacy dual-read 保留历史，而没有拼接 Native session？
- 是否用 strict protocol classifier 只隐藏 prompt echo，而没有吞后续模型内容？
