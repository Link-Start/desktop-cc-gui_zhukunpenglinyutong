## Why

当前 Codex assistant message 会经过客户端自定义的 `Codex lead enhancement`：系统根据“测试、检查、下一步、计划”等关键词，自动插入 emoji、左侧 rail 和额外 font weight。该行为会改写上游模型的视觉表达，导致同一条 Codex 记录在本客户端与官方 Codex 客户端中明显不一致，也让普通进度更新显得过重。

用户明确偏好官方客户端的精简展示，因此本次调整以“忠实呈现原文”为优先级，而不是继续微调启发式装饰。

## What Changes

- Codex assistant Markdown MUST 不再根据正文关键词自动插入 emoji、rail、背景或额外粗体。
- 模型原文中的真实 emoji、Markdown emphasis、inline code、list、table、blockquote 与 GitHub-style alert 继续按原始语义渲染。
- `codexCanvasMarkdown` presentation profile 继续控制既有 Codex streaming/render strategy，但不再承担正文语义增强。
- 删除仅服务于 `Codex lead enhancement` 的 detector、DOM class 与 CSS。

## Impact

- 主要影响 `src/features/messages/components/Markdown.tsx`、`Messages` rendering regression tests 与 `src/styles/messages.part2.css`。
- 不修改 Codex protocol、history/realtime mapping、message text persistence 或其他 engine 的 Markdown 行为。
- 风险集中在依赖 `.markdown-lead-*` 的旧视觉测试；通过 focused Vitest、typecheck、lint 与手动 screenshot 对比收口。
