# Implementation Evidence

## Delivery inventory 与 contract

- Composer submit 过去由 `isProcessing + steerEnabled` 隐式决定 prompt、queue
  或 same-run continuation；queue drain 又由 `isProcessing=false` 触发。
- `engineMessageDelivery.ts` 现在统一定义 `prompt`、`steer`、`followUp`、
  `nextTurn` intent，以及 accepted、rejected、degraded result。
- Codex / Claude 的 `compat-input` 明确返回 degraded steering；Kimi、
  Gemini、OpenCode 的 unsupported mid-turn input 被拒绝，只有 caller
  显式允许时才降级为 follow-up queue。

## Settlement、UI 与 diagnostics

- Active run follow-up 记录 predecessor `terminalPulse`，只在
  `run.settled` 投影推进 pulse 后进入 FIFO dispatch。processing flag、
  response acceptance 和 delta 均不能提前 drain。
- Queue item 在 dispatch 前移出并进入既有 in-flight guard；重复 settlement
  不会重复投递同一 item。
- `handleSend` 与 queue fusion 共用 typed decision。Kimi 不再因全局
  `steerEnabled` 被误报为 same-run send；safe cutover 仍要求显式
  `interruptTurn`。
- 每次 decision 保存 bounded、secret-safe evidence：intent、engine、
  session/run、capability、route、reason；不保存 text、images 或 credential。

## Verification

- focused Vitest: delivery contract、queued send / fusion / settlement、
  executable projection。
- `pnpm tsc --noEmit --pretty false`。
- strict OpenSpec validation。
