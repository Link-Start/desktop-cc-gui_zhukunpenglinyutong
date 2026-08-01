## Why

Shared Session 在 turn 运行期间切换到其他会话再返回时，backend execution 仍持续，但首个 assistant shell 与外部化 live text 可能没有重新汇合，导致 UI 停在 user bubble。该问题破坏运行态与历史态的可见 transcript parity，也会让用户误判任务已停止。

## 目标与边界

- 保证 Shared Session 的 canonical thread 在 inactive 期间仍能建立首个 assistant shell，并在重新激活时立即呈现已到达的 live text。
- 保持 `liveAssistantTextChannel` 的 row-local 高频正文路径，只把 shell identity、activation handoff 与 terminal settlement 作为结构性更新。
- 复用现有 Shared owner binding、thread reducer、live channel 与 processing lifecycle，不引入第二套执行状态或消息缓存。
- 仅修改 frontend conversation projection 与 focused regression tests；不修改 Rust execution protocol、durable snapshot schema 或 native engine lifecycle。

## 非目标

- 不重构 Shared Session send pipeline、owner binding、canonical history loader 或 terminal barrier。
- 不恢复逐 delta root reducer dispatch，不以轮询或全量 history reload 掩盖 projection 缺口。
- 不处理当前进行中的 conversation canvas scroll ownership 重构。
- 不改变 Native Codex、Claude、Gemini 或 OpenCode 会话的创建、恢复与路由语义。

## What Changes

- 将首个 assistant shell 明确为 lifecycle-critical projection：即使 Shared thread 当前不 active，也必须及时建立可订阅的 assistant item identity。
- 在运行中 Shared thread 重新激活时定向提交该 thread 尚未落地的 raw/normalized structural operation，并通过现有 cold subscription 消费 live channel snapshot；不 flush 其它 thread。
- 保持后续正文 delta 继续在 `liveAssistantTextChannel` 内聚合，terminal final 继续写回同一个 assistant item。
- 增加跨会话切换回归测试，覆盖首 token 前切走、切回继续流式、inactive terminal 与无重复 final。

## 方案比较

### 方案 A：结构性事件 urgent + activation reconciliation（采用）

- 优点：修复根因；不依赖 history IO；保持 per-delta render 性能边界；影响面集中在现有 projection owner。
- 代价：需要明确 shell identity 与 channel snapshot 的汇合契约，并为切换竞态增加测试。

### 方案 B：切回 processing thread 时强制 reload history（拒绝）

- 优点：实现表面简单，可借助已有 canonical history loader。
- 代价：durable history 在 turn 未完成时可能落后；会引入 IO、闪烁、重复 reconcile 与 snapshot race，且掩盖 live projection 缺口。

### 方案 C：所有后台 delta 继续写 root reducer（拒绝）

- 优点：assistant row 不易缺失。
- 代价：违反 render performance baseline，重新引入高频 root update 与 streaming jank。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `conversation-realtime-history-parity`: 增加运行中 Shared Session 跨会话切换时，首个 assistant shell、live text 与 terminal final 必须保持同一可见 transcript identity 的行为契约。

## Impact

- Frontend runtime：`src/features/threads/hooks/useThreadItemEvents.ts` 及其现有调度/消息 identity 边界。
- Frontend orchestration：仅在必要时触及 active-thread projection handoff；不改变 Shared backend orchestration。
- Tests：focused Vitest，模拟 Shared A 运行时切换到 B、A 接收 delta、再切回 A。
- Routing tests：覆盖 event 仍携带 hidden native `threadId`、但 authoritative `sharedOwner` 指向 canonical Shared thread 的切换后投影。
- API / persistence / dependencies：无新增 API、无 schema migration、无新增 dependency。

## 验收标准

- 首 token 到达前切走 Shared Session，再切回时必须立即显示一个 assistant row 与已发布正文。
- inactive 期间持续到达的正文不得因切换丢失，terminal final 必须落入同一 assistant item 且不重复。
- 修复不得触发每个正文 delta 的 root reducer dispatch。
- Native Session 行为、Shared owner binding、canonical history 与 scroll ownership 保持不变。
- Shared 专属 routing/projection tests 必须通过；不以修改通用 `activeCanvasStore` 作为修复手段。
