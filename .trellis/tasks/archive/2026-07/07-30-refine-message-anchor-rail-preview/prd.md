# 修复消息幕布锚点单项预览

## Goal

按用户提供的参考，将现有右侧“hover 展开全部目录”锚点改为左侧全高 rail；hover/focus 时只显示当前单个 user turn 的目录项和简易原文描述。

## OpenSpec

- Change: `refine-message-anchor-rail-preview`
- Source of truth: `openspec/changes/refine-message-anchor-rail-preview/`

## Requirements

- rail 位于幕布左侧，anchor 从顶部使用 bounded gap 紧凑排列。
- active dash 只加深，默认长度与普通 dash 一致。
- 只有 hover/focus 的 dash 横向拉长。
- hover/focus 只展示一个 anchor preview card。
- preview 内容仅来自对应 user message 的 bounded title/description。
- click、`Enter`、`Space` 复用现有 anchor jump。
- 长会话最多渲染 32 个代表性 dash，active anchor 必须保留。
- preview 对顶部、底部和宽度做边界保护。
- 视觉比例按最终参考图校准：普通 dash `6px × 2px`、hover/focus `26px`、row pitch `10px`，preview 使用紧凑 offset/padding/radius/shadow。
- hover/focus dash 是局部峰值；前后最多三根 dash 按 `20px/12px/8px` 逐级收敛，形成局部凸起而不是单根针刺。
- 不修改 scroll convergence、virtualization 或 backend contract。

## Acceptance Criteria

- [ ] 不再存在 hover 后展开全部 anchor rows 的行为。
- [ ] 少量 anchor 不再按全文百分比拉散，active 未 hover 时不再横向拉长。
- [ ] DOM 中最多存在一个 preview card。
- [ ] 首部/中部/尾部 preview placement 可区分且不越过 rail 阅读边界。
- [ ] pointer 与 keyboard 交互均可跳转正确 anchor。
- [ ] focused tests、lint、typecheck、large-file check、strict OpenSpec validation 通过。

## Technical Notes

- 复用 `MessagesAnchorRail`、`activeAnchorId` 和 `requestScrollToAnchor`。
- 不新增 dependency。
- `MessagesCore.tsx` 若需修改，仅限 anchor title/description mapping，必须保留当前工作区其他 scroll 改动。
