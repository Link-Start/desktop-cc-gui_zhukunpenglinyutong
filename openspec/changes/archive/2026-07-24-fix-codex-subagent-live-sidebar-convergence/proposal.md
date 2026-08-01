## Why

Codex app-server 的 live `thread/started` notification 已在 `params.thread` 中提供 `parentThreadId` 与 `agentNickname`，但 frontend `onThreadStarted` 只投影 thread identity、engine 与 provider metadata。子代理因此先以 inherited `preview` 命名并作为 top-level session 出现在 Sidebar，直到后续 catalog hydration 补齐 relationship/title 后才收敛为 child row。

该中间态会让多个 distinct child UUID 看起来像重复的普通会话。底层 session identity 与 JSONL metadata 没有丢失，缺口位于 live payload 到 reducer state 的 projection boundary。

## What Changes

- 在 live `thread/started` boundary normalize authoritative `parentThreadId` 与 `agentNickname`。
- 复用同一 resolver 构建 live `thread/list` summary，避免 refresh 把 nickname 覆盖回 inherited `preview`。
- 扩展现有 `ensureThread` action，使 relationship 与 agent display name 在同一次 reducer update 中写入新建或已存在的 `ThreadSummary`。
- identified subagent 的 live title 优先使用 `agentNickname`，不再先用 inherited parent `preview`。
- 保持普通 top-level Codex session 的即时可见行为，不引入全局延迟、timer 或额外 catalog scan。
- 增加 event-order regression，覆盖 child live notification 早于 catalog hydration 的首次可见状态。

## Capabilities

### Modified Capabilities

- `subagent-session-tree-navigation`: Codex live child MUST use authoritative relationship metadata before its first visible Sidebar projection.

## Impact

- Frontend event/list/reducer contract: `src/features/threads/hooks/useThreadTurnEvents.ts`、`useThreadActions.ts`、`threadReducerTypes.ts`、`useThreadsReducer.ts`
- Shared normalization: `src/features/threads/utils/codexSubagentIdentity.ts`
- Tests: focused hook/reducer/integration coverage
- Behavior spec: `subagent-session-tree-navigation`
- No backend command、storage schema、dependency、CSS 或 Codex JSONL mutation
