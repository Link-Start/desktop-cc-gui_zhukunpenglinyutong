## Why

各 CLI 对 active turn 中的新输入支持不同：有的支持 steering，有的只能下一轮，有的 stdin 不可用。当前若只暴露统一“发送成功”，用户消息可能被静默丢弃或在错误时机执行。

## 目标与边界

- 统一 `prompt`、`steer`、`followUp`、`nextTurn` 四类 delivery intent。
- delivery 必须查询 runtime capability，并返回 accepted/rejected/degraded 的结构化结果。
- steering 仅在 active run 投递；follow-up 仅在 `run:settled` 后 drain。
- Kimi 当前明确声明 `input.mid-turn = unsupported`。

## What Changes

- 新增 delivery command/state machine 与 typed result。
- 定义不支持能力时的 reject/fallback policy，禁止静默成功。
- terminal/settled 竞态下确保 follow-up 只执行一次。
- diagnostics 记录 intent、decision、target run 与 fallback reason。

## 方案比较与取舍

- 方案 A：所有输入统一排队到下一轮。安全但损失支持 steering 的 engine 能力，拒绝。
- 方案 B：capability-aware delivery state machine。采用；提供一致 API，同时保留 engine 能力差异。

## Capabilities

### New Capabilities

- `engine-message-delivery-semantics`: 定义 prompt、steer、follow-up、next-turn 的状态、降级与 settlement contract。

### Modified Capabilities

无。

## 验收标准

- unsupported mid-turn input 返回明确 capability error 或经用户可见规则降级。
- response accepted、text delta、turn completed 均不能替代 `run:settled`。
- duplicate settled/terminal 不会重复 drain follow-up。
- delivery tests 覆盖 active、idle、aborted、replaced session。

## 非目标

- 不实现 orchestration pipeline UI。
- 不模拟 CLI 不具备的 stdin/steering 能力。
- 不引入秒级 polling。

## Impact

- Composer send boundary、thread messaging、Rust runtime control commands。
- Capability lookup、event bus settled consumer、diagnostics。
