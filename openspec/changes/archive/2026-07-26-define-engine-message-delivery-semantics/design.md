## Context

Composer submit、active turn steering 与 queued follow-up 目前缺少统一 intent。delivery 需要依赖 capability、runtime state 和 `run.settled`。

## Goals / Non-Goals

**Goals:** typed intent、capability-aware decision、exactly-once queue drain、可诊断结果。

**Non-Goals:** 不实现 pipeline scheduler，不模拟 unsupported CLI。

## Decisions

1. API 接受显式 intent，不依据“当前是否 processing”偷偷改写语义。
2. `steer` 要求 active run + `input.mid-turn=supported`；否则 reject，除非 caller 明确允许 fallback。
3. `followUp` 持久关联 logical session 和 predecessor run，在 `run.settled` 后按 FIFO drain。
4. accepted 只表示 runtime 接收；完成只认 settled。
5. abort/replacement 使未投递 steering 失败，follow-up 按 policy 保留或取消并返回结果。

## Risks / Trade-offs

- [行为比旧路径更严格] → UI 显示明确降级/重试，而非静默成功。
- [settled 重复触发] → queue item idempotency key。
- [并发发送竞态] → session registry serial control lane。

## Migration Plan

先包装现有 submit 为 `prompt`，再接 settled-aware follow-up；steer 仅对已证明 capability 的 engine 开启。保留旧 send API facade 到调用方迁完。

## Open Questions

默认 Composer 在 active run 下应提示选择 steer/follow-up，还是固定 follow-up，由后续 UX change 决定。
