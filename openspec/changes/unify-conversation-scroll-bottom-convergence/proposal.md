## Why

对话幕布的历史打开、live streaming、turn settle、virtualized timeline remeasure 与浮动回底按钮分别维护滚动写入，导致某个触发点虽执行过“滚到底”，最终位置仍可能被后续测高或另一位 scroll writer 推离 true bottom。当前主规范已经要求 true-bottom convergence，但实现只验证单次写入，无法稳定覆盖 Codex 与 Claude Code 的长历史和结束回刷场景。

## 目标与边界

- 保留现有历史打开、live auto-follow、turn settle、timeline scope reset 和浮动 top/bottom control 的触发语义与 UI。
- 将所有 bottom intent 收敛到一个 feature-local scroll primitive，由它动态追踪真实 scroll target，并在连续稳定帧后才完成。
- 用户主动向上滚动仍须立即释放自动跟随；显式点击回底或重新启用 auto-follow 时允许重新武装。
- 变更限定在 frontend message viewport，不修改 engine runtime、history payload、storage 或 Tauri API。

## What Changes

- 提取统一的 conversation scroll convergence primitive，支持 instant auto-follow 与 smooth user navigation 两种 motion policy。
- `Messages` 的 initial history pin、stream growth、turn settle、auto-follow re-enable 继续保留原触发点，但统一请求该 primitive。
- `MessagesTimeline` 的 scope reset/remeasure 继续保留触发点，但通过 callback 请求统一 bottom convergence，不再直接写 `scrollTop`。
- `ScrollControl` 保持现有 icon、top/bottom direction 与 wheel visibility，改为复用统一 primitive。
- 增加 post-write virtualizer correction、late height growth、manual scroll-away 与 Codex/Claude shared surface 的 focused regression coverage。

## 方案取舍

- 方案 A：直接模拟点击右下角 icon。拒绝；按钮可能未挂载或当前方向为 top，且业务滚动不应依赖可见 UI state。
- 方案 B：保留各触发点，只抽取按钮背后的动态 target + stable-frame convergence，并由单一 coordinator 管理取消和优先级。采用；既不丢触发能力，也能统一 true-bottom contract。
- 方案 C：只延长现有 800ms/2000ms deadline。拒绝；时间预算不能证明 virtualizer、Markdown 或 content-visibility 已经稳定。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `conversation-render-surface-stability`: bottom intent 必须通过统一 convergence contract，在迟到测高或 scroll correction 后仍稳定到达 true bottom，同时保留用户 scroll-away 控制权。

## Impact

- Frontend: `src/features/messages/components/Messages.tsx`、`MessagesTimeline.tsx`、`ScrollControl.tsx` 及 feature-local scroll helper。
- Tests: Messages live/history behavior、ScrollControl、timeline integration focused suites。
- Codex 与 Claude Code 共用 message surface，因此同时受益；无 engine-specific API 变更。
- 无 dependency、backend、storage schema 或 public API 变化。

## 非目标

- 不改变右下角 icon 的视觉、出现规则、top/bottom direction 或 accessibility label。
- 不删除 anchor jump、history expansion restoration、virtualizer remeasure 等现有滚动触发点。
- 不调整 Markdown streaming cadence、virtualization threshold 或 message layout。
- 不在本次重构整个 `Messages` 组件。

## 验收标准

- 打开已加载的长历史会话后，即使最后一次虚拟行测高在首次写底之后发生，viewport 仍收敛到 true bottom。
- turn 从 streaming 进入 settled、完整 timeline 回刷并迟到测高后，viewport 在用户未离开底部时收敛到 true bottom。
- 用户主动向上滚动后，后续 resize/remeasure 不得强制拉回底部；显式回底后恢复 auto-follow。
- 浮动 top/bottom control 的 UI 与触发点保持，bottom action 与自动路径共享 target/convergence 实现。
- focused Vitest、typecheck、OpenSpec strict validation 通过，并提供本地手动测试入口；不执行 Git commit。
