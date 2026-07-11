# Proposal: 添加消息锚点直达底部按钮

## Why

消息幕布右侧已有用户消息锚点 rail，适合在较长对话中跳转到某个 user turn。
但用户滚动到上方阅读历史后，如果想快速回到最新输出，只能手动滚动到底部。

新增“直达底部”按钮可以补齐阅读导航闭环：锚点负责跳到历史节点，底部按钮负责回到最新消息。

## What Changes

- 在 `MessagesAnchorRail` 的锚点 dash 下方新增一个 icon-only bottom jump button。
- 点击按钮时滚动到消息幕布底部，并重新允许 live auto-follow 继续跟随最新输出。
- 使用轻量 `ArrowDown` 图标和与 dash rail 对齐的尺寸，避免视觉突兀。
- 调整展开锚点面板与底部按钮的层级/高度，避免锚点较多时面板遮挡按钮。
- 为按钮补充中英文 i18n、`aria-label` / `title` 和 focused test。

## Impact

- Affected spec: `message-reading-navigation-reasoning-ux`
- Affected code:
  - `src/features/messages/components/MessagesAnchorRail.tsx`
  - `src/features/messages/components/Messages.tsx`
  - `src/styles/messages.status-shell.css`
  - `src/i18n/locales/zh.part1.ts`
  - `src/i18n/locales/en.part1.ts`
  - `src/features/messages/components/Messages.test.tsx`

