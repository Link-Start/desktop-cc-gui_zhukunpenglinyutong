## Why

`MessagesCore.tsx` 当前同时拥有 stream runtime、reconnect timer、presentation snapshot、history window、
scroll convergence、anchor navigation、interaction callback 与完整 JSX composition，共 2746 行。不同更新频率的
state/effect 被绑定在同一组件中，live delta 容易重建 stable model，deferred snapshot 容易跨 workspace/thread
泄漏，scroll timer 与 listener 也缺少单一 lifecycle owner。

## What Changes

- 将 stream activity、latency mitigation、blanking/stall、working/finalizing 与 reconnect lifecycle 移入
  `useMessagesRuntimeState`。
- 将 stable snapshot、live overrides、grouping、final boundaries、file summaries、suppression sets 与七类 timeline
  model 移入 `useMessagesPresentationState`。
- 将 collapsed/full/expanded window、manual/jump reveal、preserved readable window 与 history-head reset 移入
  `useMessagesHistoryWindow`，所有 deferred snapshot 显式携带 workspace + thread scope。
- 将 bottom follow、programmatic echo suppression、initial settle、convergence、pending jump 与 timer/listener cleanup
  移入 `useMessagesScrollController`。
- 将 copy、toggle、context menu、recovery、fork/rewind、note capture 与 file-open callback 移入
  `useMessagesInteractions`，approval/user-input submission 继续由既有 submission owner 负责。
- 将 `MessagesCore.tsx` 收敛为独立 owner composition，目标少于 2200 行。

## 验收标准

- 五个 hook 各自只拥有一个 state/effect lifecycle domain，不形成 mega-controller。
- live-only update 不重建 snapshot、navigation、interaction、presentation 或 slot stable model。
- history/presentation deferred state 按 workspace + thread scope 隔离。
- scroll timer、RAF 与 event listener 在 scope change/unmount 时完整清理，consumer 不接收 raw setter。
- streaming body 继续走 row-local `liveAssistantTextChannel`，不得恢复 root-level per-delta reducer update。
- `MessagesCore.tsx < 2200`，focused/full tests、typecheck、lint、build、boundary 与 large-file evidence 完整。
