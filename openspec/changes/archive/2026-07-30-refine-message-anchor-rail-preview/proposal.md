## Why

当前消息幕布锚点被实现为右侧短尺，hover 任意位置都会展开包含全部 user turn 的目录面板。长对话中该面板遮挡正文、无法表达当前锚点与预览卡片的局部关系，也与用户提供的左侧全高 rail 参考不一致。

## 目标与边界

- 将消息锚点恢复为幕布左侧、覆盖可用阅读高度的纵向 rail。
- active anchor 只使用更深的 dash，默认长度与普通 anchor 一致。
- hover 或 keyboard focus 单个 dash 时，该 dash 作为局部峰值横向拉长，前后最多三根 dash 按距离逐级伸长，并展示对应 user turn 的标题与简易原文描述。
- 点击或按 `Enter` / `Space` 继续复用现有 smooth jump contract。
- 极长会话对视觉 dash 做有界采样，并保证 active anchor 仍可见。

## 非目标

- 不生成或推断 assistant summary、evidence、turn semantic title。
- 不修改 canonical transcript、active anchor 计算、virtualization hydration 或 scroll convergence。
- 不新增持久化配置、backend contract 或第三方依赖。
- 不保留 hover 后展开全部目录的旧交互。

## 技术方案与取舍

1. **Component-local 单锚点预览（采用）**：在 `MessagesAnchorRail` 内维护 hovered/focused anchor，以 button dash 驱动单卡片；复用现有 anchor title 与 jump callback。改动集中、无需触碰滚动根链。
2. **CSS-only 左移**：仅调整 `right/left`，仍会展开全部目录，无法满足单锚点预览要求，因此拒绝。
3. **Rich turn summary projection**：从 assistant/tool rows 派生 summary/evidence，视觉信息更丰富，但会扩大 timeline projection 与 streaming render 影响面，当前需求不需要，因此拒绝。

## What Changes

- 将 anchor rail 从右侧短尺改为左侧紧凑纵向排列，使用 bounded gap 避免少量 anchor 被拉散。
- 将不可交互的 dash 改为具备 accessible name 的 button。
- 用单个 anchor preview card 替代完整 outline panel。
- 为 hover、focus、mouse leave、click jump、keyboard jump、long-history sampling 和 viewport 边界补充回归覆盖。
- 更新 message reading navigation behavior spec，明确 rail 仅展示当前锚点预览。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `message-reading-navigation-reasoning-ux`: 修改 message anchor rail 的布局、单锚点预览、bounded rendering 与 keyboard navigation contract。

## 验收标准

- rail 位于幕布左侧，anchor 从顶部按 bounded gap 紧凑排列；active dash 仅加深，长度不变。
- hover/focus 的 dash 形成最长峰值，前后邻近 dash 形成对称、逐级收敛的局部凸起。
- rail 的视觉比例 MUST 贴近确认参考：普通 dash、hover dash、row pitch 与 preview offset 使用紧凑尺寸，避免组件整体放大。
- hover/focus 某一 dash 时 DOM 中最多存在一个 preview card，且内容只来自对应 user message。
- preview card 不越过 rail 可用 top/bottom 边界，不遮住整段目录。
- click、`Enter`、`Space` 均跳转到正确 message anchor。
- 超过视觉上限的长会话不会渲染无界 dash，active anchor 始终保留。
- focused tests、lint、typecheck 与 strict OpenSpec validation 通过。

## Impact

- Frontend component: `src/features/messages/components/conversation/MessagesAnchorRail.tsx`
- Styling: `src/styles/messages.status-shell.css`
- Tests: `src/features/messages/components/Messages.test.tsx`、`MessagesAnchorRail.styles.test.ts`
- Behavior spec: `message-reading-navigation-reasoning-ux`
- 无 API、storage、backend、dependency 变更。
