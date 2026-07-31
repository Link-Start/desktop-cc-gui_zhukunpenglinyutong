## Context

`ProviderContinuationContextCard` 当前只接收 `ThreadSummary` 和导航 callback。`useLayoutNodes` 已持有 `threadItemsByThread`，其中包含来源 Session 已加载的 `ConversationItem[]`。因此可在 layout projection 边界完成一次轻量派生，再把稳定、最小的 excerpt props 交给卡片，无需让组件订阅 store 或复制 `Messages` render path。

关键约束：

- 不触发 history reload；未加载来源消息必须优雅降级。
- 不把数组追加或高频 derivation 引入 AppShell 根链。
- 不渲染 Markdown / tool / reasoning tree，只展示 plain-text excerpt。
- 不改变现有 `<details>` 折叠、sticky offset 与 source navigation。

## Goals / Non-Goals

**Goals:**

- 展示来源最后一轮可读 user / assistant 文本。
- 对空白文本、tool/reasoning 尾项、缺失 assistant 和来源未加载提供确定性行为。
- 派生逻辑为 pure helper，可独立测试并保持 O(n) 单次反向扫描。

**Non-Goals:**

- 不生成语义摘要。
- 不嵌入完整来源 Canvas。
- 不增加 backend field、持久化或网络请求。
- 不改变实时消息渲染与 history reconcile。

## Decisions

### Decision 1: 在 feature-local pure helper 中提取最后一轮

新增明确的 `ProviderContinuationSourceExcerpt` value object，并从来源 items 末尾反向扫描：

1. 找到最后一条非空 assistant message。
2. 在其之前找到最后一条非空 user message。
3. 若末尾没有 assistant，则回退到最后一条 user message。
4. 忽略 tool、reasoning、plan 等非 message item。

相比在 JSX 内临时 `filter/reverse`，pure helper 避免多次数组分配，边界可直接单测；相比修改 `ThreadSummary`，不会把 view-only 派生污染 catalog contract。

### Decision 2: 只消费已加载的 `threadItemsByThread`

`useLayoutNodes` 用 `sourceSessionId` 读取当前已有数组并计算 excerpt。没有数组时传 `null`，卡片显示“来源内容尚未加载”。不为预览隐式加载 history，避免展开动作触发 I/O 或根链状态变化。

### Decision 3: plain text + CSS line clamp

卡片显示带角色标签的两个 `<p>`，user 与 assistant 各限制行数；完整内容仍通过来源 icon 打开。相比 Markdown renderer，这能避免 parser、code block、tool tree 和 nested interactive surface。

### Decision 4: excerpt 是显示快照，不参与 continuation contract

摘录仅由当前 source items 派生，不写入 continuation operation，也不作为模型上下文。来源删除时继续依赖 frozen identity，避免把展示便利升级成持久化数据契约。

## Risks / Trade-offs

- [来源 history 尚未加载] → 显示明确 fallback，不主动加载。
- [最后一轮很长] → CSS line clamp 控制卡片高度，完整内容通过来源导航查看。
- [assistant 后存在 tool/reasoning 尾项] → helper 只识别 `kind === "message"` 且 role 为 user/assistant。
- [只有 assistant、没有 user] → 显示可用 assistant 摘录，不伪造 user 文本。
- [来源 items 更新导致派生重算] → 只在现有 `useMemo` continuation projection 中对来源数组引用计算一次；不新增 subscription 或 state。

## Migration Plan

1. 增加 pure helper、props 与 focused tests。
2. 在 `useLayoutNodes` 现有 continuation projection 中接入 source items。
3. 更新 i18n copy、OpenSpec main spec 并验证。
4. 回滚时删除 excerpt props/render/helper，现有 identity、折叠与导航保持不变。

## Open Questions

无。用户已确认采用“最后一轮摘录”，不采用 AI summary 或完整幕布嵌入。
