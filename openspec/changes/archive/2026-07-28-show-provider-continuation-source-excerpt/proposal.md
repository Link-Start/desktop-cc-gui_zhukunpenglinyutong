## Why

Provider Continuation 卡片目前只显示来源 Session 名称，用户无法在当前 Canvas 内快速确认续接前最后讨论了什么，必须跳回来源会话才能恢复上下文。展开区需要提供轻量、确定性的来源内容摘录，同时保持现有 Canvas 性能与导航边界。

## 目标与边界

- 展开卡片时展示来源会话最后一轮可读的 user / assistant 文本。
- 只复用当前前端已持有的 `threadItemsByThread[sourceSessionId]`，不触发 history reload、AI generation 或新持久化。
- 摘录保持紧凑、可截断；完整内容继续通过来源 icon 导航查看。
- 来源未加载、无可读消息或已不可用时使用明确 fallback。

## 非目标

- 不在 continuation 卡片内嵌完整 `Messages` Canvas。
- 不生成或持久化 AI summary。
- 不修改普通消息 grouping、streaming、scroll anchor 或 history loader。
- 不修改 Provider Continuation 创建、幂等性与 backend contract。

## What Changes

- 从已加载的来源 `ConversationItem[]` 中确定性提取最后一条 user message，以及其后的最后一条 assistant message。
- expanded metadata 区展示“来源最后一轮”紧凑摘录，并限制可见行数。
- 为来源未加载、仅有 user message、tool/reasoning 尾项与空白文本补充 fallback 和测试。
- 保留现有 icon-only source navigation、折叠行为和 topbar safe offset。

## 方案对比

1. **确定性最后一轮摘录（采用）**：复用现有消息数据，零生成成本、零新状态、不会过期；信息量受最后一轮限制。
2. **AI summary**：表达更凝练，但需要生成、缓存、失效和错误处理，会扩大 continuation 创建链路。
3. **嵌入完整来源幕布**：内容最完整，但重复 `Messages` render tree，引入 nested interaction、scroll 与性能风险。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: expanded continuation metadata 增加来源会话最后一轮摘录与 degraded fallback 行为。

## Impact

- Frontend：`ProviderContinuationContextCard` props/rendering，以及 `useLayoutNodes` 的来源消息投影。
- Tests：component focused tests 与必要的 layout data-flow assertion。
- API / backend / dependencies：无变化，无新增依赖。

## 验收标准

- 展开卡片可看到来源最后一条 user message 和其后的最后一条 assistant message。
- tool / reasoning 等非 message 尾项不会污染摘录选择。
- assistant 缺失时仍显示 user 摘录；来源未加载或无可读文本时显示明确 fallback。
- 文本按紧凑行数截断，完整来源仍由 icon navigation 打开。
- 折叠往返、topbar offset、accessible source action 保持通过。
- focused Vitest、`npm run typecheck`、OpenSpec strict validation 通过。
