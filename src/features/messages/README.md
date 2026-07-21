# Messages 模块说明

`src/features/messages` 是对话幕布的核心 feature slice。它把 `ConversationItem[]`
渲染成用户可见的消息时间线，并承载 live streaming、Markdown/工具卡片、用户输入请求、
approval、runtime reconnect、消息 fork/rewind、note capture、文件链接和长历史性能保护。

这份文档面向后续开发者。修改本模块时，请先读当前代码，再用本文确认边界；如果实现发生变化，
同步更新本文对应章节。

## 产品职责

Messages 模块负责这些用户可见能力：

- 渲染 conversation timeline：user/assistant message、reasoning、tool、diff、review、explore、generated image。
- 支持 AI 输出实时增长：assistant text、reasoning、working indicator、heartbeat/tool progress 都能作为活跃 turn 的可见反馈。
- 展示 rich content：Markdown、code block、Mermaid、KaTeX math、local/file image、XML tool-call block。
- 汇总工具执行：read/edit/bash/search tool group、file changes summary、ExitPlanMode handoff、request-user-input submitted history。
- 处理交互：copy、open file link、preview diff、fork/rewind from message、capture note、show earlier history、jump to agent task。
- 处理运行时恢复：history recovery failure、runtime reconnect hint、recover and resend、thread recovery fork。
- 保护长对话性能：streaming live tail window、stable parent snapshot、timeline virtualization、heavy-row hydration、lightweight conversation mode。

非职责：

- 不直接调用 Tauri command。跨层 bridge 应在 `src/services/**` 或上游 feature service 中完成。
- 不管理 thread/session 持久化。Messages 只消费 `ConversationItem[]`、`ConversationState` 和回调。
- 不定义 engine runtime contract。engine 差异通过 `activeEngine`、`PresentationProfile`、stream diagnostics 和上游 thread state 进入本模块。

## 数据模型

入口数据主要来自全局 conversation 类型：

- `ConversationItem`：定义在 [`src/types/conversation.ts`](../../types/conversation.ts)，当前 kind 包括 `message`、`reasoning`、`tool`、`diff`、`review`、`explore`、`generatedImage`。
- `MessagesProps`：定义在 [`types/messagesTypes.ts`](types/messagesTypes.ts)，是 `Messages` 对上游暴露的 props surface。
- `PresentationProfile`：定义在 [`presentation/presentationProfile.ts`](presentation/presentationProfile.ts)，表达 engine-specific presentation baseline，例如 Codex/Claude staged Markdown throttle、reasoning live dot、heartbeat hint。

`Messages` 同时支持两个 item 来源：

- `items`：legacy props path。
- `conversationState.items`：conversation curtain path；存在时由 [`utils/messagesRenderUtils.ts`](utils/messagesRenderUtils.ts) 的 `resolveRenderableItems` 优先使用。

## 架构分层

当前目标结构来自 `refactor-messages-presentation-architecture`，核心原则是保留 public entry，
把高频 live lane 和稳定 timeline snapshot 分开。

```text
src/features/messages/
  components/
    Messages.tsx              # public orchestration entry
    MessagesTimeline.tsx      # timeline controller + row dispatch
    MessagesRows.tsx          # row renderers: MessageRow / ReasoningRow / WorkingIndicator / etc.
    Markdown.tsx              # message Markdown facade
    context/                  # user/context summary cards
    conversation/             # rail, prompt, scroll, fork, error boundary
    media/                    # image grid, lightbox, local image
    recovery/                 # runtime reconnect card
    toolBlocks/               # tool card dispatch and specialized tool blocks
  orchestration/
    components/               # orchestration-owned UI fragments
    hooks/                    # shallow-stable model and navigation controllers
    models/                   # typed timeline view models
    presentation/             # live window and view model pure helpers
    scrolling/                # bottom/top convergence helper
  presentation/               # engine/user/reasoning/outline/lightweight presentation policy
  rendering/markdown/         # lazy/full/lightweight Markdown runtime helpers
  rows/
    components/               # row-level extracted components
    presentation/             # row-level streaming complexity helpers
  timeline/
    components/               # virtual/static timeline viewport pieces
    projection/               # grouped entries -> render rows
    virtualization/           # virtualizer, hydration, render-loop guards
  utils/                      # feature-local pure helpers
  constants/                  # flags and rendering constants
  types/                      # module-local props/view types
```

依赖方向：

```text
components/Messages
  -> orchestration/hooks + orchestration/models + orchestration/presentation
components/MessagesTimeline
  -> timeline/projection + timeline/virtualization + components/MessagesRows
components/MessagesRows
  -> rendering/markdown + components/toolBlocks + rows/presentation + presentation/utils
pure helpers
  -> types/utils only; avoid importing React components
```

不要让 `rows` 反向 import `timeline` 或 `orchestration`。不要用 barrel 文件制造双向依赖。

## Render Pipeline

高层数据流：

```text
upstream thread/conversation state
  -> Messages
     -> resolve render source items
     -> derive visible/recovery/user-input/presentation state
     -> build stable snapshot model + live model
     -> MessagesTimeline
        -> groupToolItems
        -> buildTimelineProjectionRows
        -> virtualize / hydrate heavy rows
        -> MessagesRows row renderers
           -> Markdown / ToolBlockRenderer / media / context cards
```

关键文件：

- [`components/Messages.tsx`](components/Messages.tsx)：入口组件。负责 source selection、state orchestration、scroll intent、stable/live model 组装、inline approval/user-input slot。
- [`components/MessagesTimeline.tsx`](components/MessagesTimeline.tsx)：timeline controller。负责 projection rows、virtualizer、hydration、outline floater、row dispatch。
- [`components/MessagesRows.tsx`](components/MessagesRows.tsx)：row rendering。负责 message/reasoning/tool/diff/review/explore/generated image/working indicator 的具体 UI。
- [`orchestration/models/messagesTimelineModels.ts`](orchestration/models/messagesTimelineModels.ts)：七类 timeline view model：`snapshot`、`live`、`runtime`、`navigation`、`interactions`、`presentation`、`slots`。
- [`orchestration/hooks/useMessagesTimelineModels.ts`](orchestration/hooks/useMessagesTimelineModels.ts)：按 model 做 shallow-stable identity，避免 live 高频变化重建稳定对象。
- [`orchestration/presentation/messagesLiveWindow.ts`](orchestration/presentation/messagesLiveWindow.ts)：streaming/static、collapsed/expanded presentation mode 和 stable snapshot helper。
- [`orchestration/presentation/messagesViewModel.ts`](orchestration/presentation/messagesViewModel.ts)：active request、visible items、copy target、collapsed timeline、scroll key 等 view model helper。

## Streaming 性能契约

本模块最重要的技术约束是 live row 与 parent timeline derivation 分轨。详细规范见
[`messages-streaming-render-contract.md`](../../../.trellis/spec/frontend/messages-streaming-render-contract.md)。

必须保持的 invariant：

- `liveAssistantItem` / `liveReasoningItem` 可以直接来自最新 source，保证正文和 reasoning 持续增长。
- `groupToolItems`、anchors、sticky candidates、final boundary set、file-change summaries 等 timeline-heavy derivations 必须基于稳定的 deferred/presentation snapshot。
- streaming 时可以把新插入的 live item 追加到 stable snapshot，但不能因为同一 message 的 text 增长就每个 delta 全量重算 parent timeline。
- stable snapshot 必须带 `workspaceId + threadId` scope guard，tab/thread 切换时旧 snapshot 立即失效。
- streaming 完成后，stable snapshot 必须自然收敛到 canonical latest items。

常见禁止项：

- 把 `groupToolItems(...)` 或 final boundary 计算重新绑到最热的 text delta。
- 删除 `liveAssistantItem` / `liveReasoningItem` override，让最终可见文本依赖 history replay。
- 在 JSX/render path 中创建不稳定 callback/object，导致 Markdown outline 或 virtualizer 每帧重跑。
- 只用“有没有 text delta”判断 turn 是否卡死；heartbeat、tool progress、request-user-input、reasoning delta 都可能是合法 progress evidence。

## Timeline Projection 与虚拟化

Timeline 不直接渲染 `ConversationItem[]`，而是先构造 projection rows：

- [`utils/groupToolItems.ts`](utils/groupToolItems.ts)：连续 read/edit/bash/search 工具合并为 group；`TodoWrite` 不渲染；Codex `search_query` MCP 搜索保持逐条展示。
- [`timeline/projection/messagesTimelineProjection.ts`](timeline/projection/messagesTimelineProjection.ts)：把 grouped entries、approval、tail user input、working indicator、empty/recovery states 转成 `TimelineProjectionRow[]`。
- [`timeline/virtualization/messagesTimelineVirtualization.ts`](timeline/virtualization/messagesTimelineVirtualization.ts)：按 row count 与 render weight 决定是否启用 `@tanstack/react-virtual`。
- [`timeline/virtualization/messagesTimelineHydration.ts`](timeline/virtualization/messagesTimelineHydration.ts)：heavy row 在虚拟化时可进入 `summary`，只有 visible/active/anchor/detail-requested 时 hydrate。
- [`timeline/virtualization/messagesRenderLoopGuards.ts`](timeline/virtualization/messagesRenderLoopGuards.ts)：防止等价 overlay state 或 repeated remeasure 造成 render loop。

当前重要阈值在 `messagesTimelineVirtualization.ts`：

- stable timeline rows >= 48 时虚拟化。
- streaming timeline rows >= 16 时虚拟化。
- render weight >= 96 且密度高时虚拟化。
- heavy row weight >= 16 时进入 hydration 策略。

这些数字来自性能治理，不要只凭观感调参。改阈值前要跑 focused tests，并重新记录性能证据。

## Markdown 与 Rich Content

Markdown 入口是 [`components/Markdown.tsx`](components/Markdown.tsx)。它负责：

- lazy load full Markdown runtime、Mermaid renderer、KaTeX assets。
- 支持 live lightweight render mode 与 progressive reveal。
- 标准化 local image/file link/math/list/blockquote/code fence 等输入。
- 解析 XML tool-call block，渲染 [`rendering/markdown/ToolCallBlock.tsx`](rendering/markdown/ToolCallBlock.tsx)。
- 通过 `onRenderedValueChange` 上报真实进入 render surface 的 value，用于 visible text diagnostics。
- 通过 `onOutlineReady` 上报 Markdown outline，供 timeline outline state 使用。

Streaming Markdown complexity 在
[`rows/presentation/messagesStreamingComplexity.ts`](rows/presentation/messagesStreamingComplexity.ts)：

- Codex 和 Claude 默认走 staged streaming Markdown throttle。
- medium/large/structured/huge 文本会逐级提高 throttle，避免每个 delta 都 full parse。
- delta analyzer 必须保持 append-only 快路径，避免流式全文反复扫描形成 O(n^2)。

图片能力分两类：

- message `images`：由 [`components/media/MessageMediaBlocks.tsx`](components/media/MessageMediaBlocks.tsx) 渲染 grid/lightbox。
- Claude deferred images：由 `MessagesRows.tsx` 调 `hydrateClaudeDeferredImage`，并用 renderer-owned object URL 管理生命周期。

## Engine 差异

当前支持的 `MessagesEngine`：

```ts
"claude" | "codex" | "gemini" | "kimi" | "opencode"
```

引擎差异主要通过这些入口表达：

- [`presentation/presentationProfile.ts`](presentation/presentationProfile.ts)：baseline presentation policy。
- `activeEngine` prop：影响 reasoning 展示、tool command card、heartbeat hint、Markdown staged throttle。
- `streamMitigationProfile`：来自 `threads/utils/streamLatencyDiagnostics`，只应作为 evidence-triggered override。
- `conversationState`：上游 conversation curtain 提供的 canonical state。

新增 engine 时，不要在 row 内散落大量 string branch。优先扩展 `PresentationProfile`、上游 contract 和 focused tests。

## 用户与上下文消息处理

用户消息通常包含运行时注入的 context payload，不能直接把 raw prompt 全部展示为普通用户输入。

关键 helper：

- [`presentation/messagesUserPresentation.ts`](presentation/messagesUserPresentation.ts)：抽取真实用户输入、collaboration badge 信息和 conversation summary 文本。
- [`utils/context/messagesMemoryContext.ts`](utils/context/messagesMemoryContext.ts)：解析 memory context summary，并生成需要 suppress 的 user message id set。
- [`utils/context/messagesNoteCardContext.ts`](utils/context/messagesNoteCardContext.ts)：解析 note card context summary。
- [`components/context/CollapsibleUserTextBlock.tsx`](components/context/CollapsibleUserTextBlock.tsx)：用户文本折叠、code annotation、browser context 相关展示。
- [`components/context/IntentCanvasContextSummaryCard.tsx`](components/context/IntentCanvasContextSummaryCard.tsx) 与
  [`components/context/NoteCardContextSummaryCard.tsx`](components/context/NoteCardContextSummaryCard.tsx)：上下文摘要卡片。

改用户消息展示时，必须覆盖：

- memory-only payload 不应进入 sticky candidate。
- image-only user payload 仍应可用于 conversation summary。
- 注入 prompt/context block 应被剥离，真实用户文本要保留。

## 工具卡片

Tool rendering 由 [`components/toolBlocks/ToolBlockRenderer.tsx`](components/toolBlocks/ToolBlockRenderer.tsx) 分发：

- command/bash：`BashToolBlock`
- read：`ReadToolBlock`
- edit/file changes：`EditToolBlock` / `GenericToolBlock`
- search：`SearchToolBlock`
- MCP：`McpToolBlock`
- request user input submitted：`RequestUserInputSubmittedBlock`
- ExitPlanMode：保持 dedicated `GenericToolBlock` handoff 行为

工具分组由 `groupToolItems` 完成。修改 tool 分类时，同步检查：

- `components/toolBlocks/toolConstants.ts`
- `utils/groupToolItems.ts`
- `components/toolBlocks/*.test.tsx`
- `utils/groupToolItems.test.ts`

## Scroll、Anchor 与 History

Scroll 相关逻辑分三层：

- `Messages.tsx`：维护 scroll intent、programmatic scroll echo、bottom follow、history expansion state。
- [`orchestration/scrolling/messagesScrollConvergence.ts`](orchestration/scrolling/messagesScrollConvergence.ts)：多 checkpoint convergence，处理 virtualizer/DOM late correction。
- [`orchestration/hooks/useMessagesAnchorNavigation.ts`](orchestration/hooks/useMessagesAnchorNavigation.ts)：message/agent task anchor refs 与 pending jump。

History 展示模式由 `MessagesPresentationMode` 表达：

- realtime/static
- collapsed/full/expanded history
- manual expansion vs jump expansion

不要用 `scrollHeight delta restore` 去伪装 manual reveal 的稳定性；manual reveal 应进入 expanded-history presentation mode。

## Runtime Reconnect 与 Recovery

Runtime reconnect 逻辑在 [`utils/recovery/runtimeReconnect.ts`](utils/recovery/runtimeReconnect.ts)。

它负责从 assistant text 中识别高置信 runtime disconnect/error hint，并把恢复动作交给上游回调：

- `onRecoverThreadRuntime`
- `onRecoverThreadRuntimeAndResend`
- `onThreadRecoveryFork`

识别规则必须保守：不要把普通长文里提到 pipe/thread-not-found 的说明误判为 runtime error。

## Note Capture 与 Selection

Messages 支持把 conversation 语义内容捕获到 note：

- [`hooks/useConversationNoteCaptureMenu.ts`](hooks/useConversationNoteCaptureMenu.ts)：打开 shared note capture menu。
- [`utils/conversationSelection.ts`](utils/conversationSelection.ts)：冻结当前 DOM selection，避免菜单打开后 selection 丢失。
- `Messages.note-capture.test.tsx`：锁定 whole-conversation body、selection copy/note capture、link/interactives context menu ownership。

改 copy/note/context menu 时，要确认不会抢占 link、button、tool card 等交互元素的右键菜单。

## 测试索引

推荐按改动范围跑 focused tests：

```bash
# live window / stable snapshot / final boundary
npx vitest run src/features/messages/orchestration/presentation/messagesLiveWindow.test.ts

# timeline projection / virtualization / hydration
npx vitest run \
  src/features/messages/timeline/projection/messagesTimelineProjection.test.ts \
  src/features/messages/timeline/virtualization/messagesTimelineVirtualization.test.ts \
  src/features/messages/timeline/virtualization/messagesTimelineHydration.test.ts \
  src/features/messages/timeline/virtualization/messagesRenderLoopGuards.test.ts

# streaming Markdown throttle / lightweight Markdown
npx vitest run \
  src/features/messages/rows/presentation/messagesStreamingComplexity.test.ts \
  src/features/messages/rendering/markdown/LiveMarkdown.test.tsx

# Markdown full surface
npx vitest run src/features/messages/components/Markdown.*.test.tsx src/features/messages/rendering/markdown/*.test.tsx

# Messages integration surface
npx vitest run src/features/messages/components/Messages.*.test.tsx

# whole feature
npx vitest run src/features/messages
```

标准 gate：

```bash
npm run lint
npm run typecheck
npm run test
```

涉及大文件、测试治理或性能 contract 时，额外跑：

```bash
npm run check:large-files
npm run check:heavy-test-noise
```

Documentation-only change 可以说明跳过 runtime gate，但仍应做链接/拼写/路径检查。

## 开发 Checklist

修改前：

- 读 [`../../../.trellis/spec/frontend/messages-streaming-render-contract.md`](../../../.trellis/spec/frontend/messages-streaming-render-contract.md)。
- 如果改对话/流式/后台任务链路，读 [`../../../docs/perf/render-jank-knife-experiments-2026-07-08.md`](../../../docs/perf/render-jank-knife-experiments-2026-07-08.md)，并以重新测量为准。
- 搜索已有 helper，优先复用 feature-local pure helper。
- 明确改动属于 `components`、`orchestration`、`presentation`、`rows`、`timeline`、`rendering` 还是 `utils`。

修改中：

- 高频 live 数据只进入 live lane；稳定派生放 snapshot lane。
- model object 用 `useMessagesTimelineModels` 或等价方式保持 shallow-stable identity。
- pure helper 保持无 React component import。
- 新增用户可见文案走 i18n。
- side effect 必须 cleanup，尤其是 listener、timer、object URL、portal。
- 不新增依赖，除非有明确产品/技术决策。

修改后：

- 按测试索引跑 focused tests。
- 若触及 streaming、virtualization、scroll、runtime reconnect，补或更新 regression tests。
- 更新本文：目录职责、关键文件、阈值、验证命令或新增产品能力发生变化时必须同步。
- 若改动属于行为变更或跨层 contract，按项目规则更新 OpenSpec / `.trellis/spec/**`。

## 文档维护规则

这份 README 是 messages 模块的开发入口文档，不替代当前代码和 `.trellis/spec/**` contract。

后续开发新功能时，请按以下口径更新：

- 新增子目录：更新“架构分层”。
- 新增用户可见能力：更新“产品职责”和相关专题章节。
- 新增/重命名关键 helper：更新“Render Pipeline”或对应专题。
- 调整 streaming/virtualization 阈值：更新“Streaming 性能契约”或“Timeline Projection 与虚拟化”，并写明验证证据位置。
- 新增重要测试：更新“测试索引”。
- OpenSpec / Trellis contract 变化：链接到新的 canonical artifact，避免 README 变成双份事实源。
