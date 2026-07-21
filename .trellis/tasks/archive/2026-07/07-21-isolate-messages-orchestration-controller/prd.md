# Isolate Messages Orchestration Controller

## Objective

执行 roadmap Phase 3：将 `MessagesCore.tsx` 按 runtime、presentation、history、scroll 与 interactions ownership
拆分，同时保持 reconnect、streaming、history window、virtualized jump、scroll convergence、submission 与 timeline
model identity contract。

## Acceptance

- `MessagesCore.tsx` 降到 2200 行以下。
- `useMessagesRuntimeState` 独立拥有 stream phase、latency mitigation、blanking/stall、working/finalizing 与 reconnect lifecycle。
- `useMessagesPresentationState` 独立拥有 stable snapshot、live overrides、grouping、boundaries、summaries、suppression sets 与 timeline models。
- `useMessagesHistoryWindow` 独立拥有 history window/reveal/readable preservation，并按 workspace + thread scope 隔离 deferred state。
- `useMessagesScrollController` 独立拥有 follow、echo suppression、initial settle、convergence、pending jumps 与 cleanup。
- `useMessagesInteractions` 暴露稳定 action callbacks，不复制 approval/user-input submission state。
- live-only update 不重建无关 stable models，streaming body 继续使用 row-local `liveAssistantTextChannel`。
- focused/full tests、typecheck、full lint、build、boundary、large-file evidence 与 independent review 完整。
