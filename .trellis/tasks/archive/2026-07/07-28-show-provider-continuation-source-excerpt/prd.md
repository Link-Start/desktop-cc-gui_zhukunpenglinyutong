# Show Provider Continuation Source Excerpt

OpenSpec change: `show-provider-continuation-source-excerpt`

## Goal

在 Provider Continuation 卡片展开区展示来源会话最后一轮可读 user / assistant 摘录，帮助用户无需跳转即可恢复续接上下文。

## Requirements

- 只消费已加载的 `threadItemsByThread[sourceSessionId]`。
- 确定性提取最后一轮 message，忽略 tool / reasoning / plan 尾项。
- 长文本保持紧凑，完整内容继续由来源 icon 打开。
- 未加载、无可读文本、来源不可用时明确降级。
- 不嵌入完整 `Messages`，不生成 AI summary，不触发 history reload。

## Acceptance Criteria

- [ ] 展开区显示来源最后一轮 user / assistant 摘录。
- [ ] 缺失 assistant 时只显示 user，不伪造回复。
- [ ] 未加载或不可用时显示正确 fallback。
- [ ] 现有折叠、topbar offset 与 icon navigation 不回退。
- [ ] focused tests、typecheck、lint、build 与 OpenSpec strict validation 通过。
- [ ] OpenSpec verify、sync、archive 完成。

## Technical Notes

最小 diff 限定为 continuation feature-local helper/component、`useLayoutNodes` projection、focused tests、i18n 与对应 OpenSpec artifacts。避开工作区并行 Composer/provider-picker 变更。
