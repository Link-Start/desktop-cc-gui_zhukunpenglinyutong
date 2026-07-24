## Context

当前 Codex CLI app-server protocol 的 `ThreadStartedNotification` shape 为 `{ thread: Thread }`。`Thread` 已包含：

- `id`: stable child UUID
- `parentThreadId`: authoritative parent relationship，普通 top-level thread 为 `null`
- `agentNickname`: AgentControl-spawned subagent nickname，可能为 `null`
- `preview`: 通常是首条 user message；child 可能继承 parent prompt，不能作为 relationship evidence

`useAppServerEvents` 已把 `params.thread` 原样交给 `useThreadTurnEvents.onThreadStarted`。当前缺口是后者没有消费 relationship/agent identity，且 `ThreadAction.ensureThread` 无对应字段。

真实 multi-agent v2 时序还会在 parent thread 上发送 `ThreadItem.type = subAgentActivity`：notification 的 `threadId` 是 parent，item 的 `agentThreadId` 是 child，`agentPath` 提供稳定的 provisional display name。child 的 `turn/started` 可能紧随其后；若 frontend 忽略该 item，child 会先被 `ensureThread` 建成顶层 `Agent N`，再被首段 assistant text 改成“我/先”，直到 catalog hydration 才收敛。

## Goals / Non-Goals

**Goals:**

- child row 第一次可见时已经挂在当前可见 parent 下。
- nickname 与 parent relationship 在一次 reducer transition 中生效。
- catalog enrichment 继续以相同 child identity 补充后续 metadata。
- ordinary root thread 保持现有即时创建语义。

**Non-Goals:**

- 不按 display title 去重 session。
- 不隐藏所有新 Codex thread 或增加 arbitrary grace timer。
- 不新增 backend lookup / filesystem watcher / full catalog refresh。
- 不改变 collaboration turn settlement 或 child execution lifecycle。

## Decisions

### Decision 1: consume existing protocol fields at the frontend trust boundary

`onThreadStarted` 对 camelCase authoritative fields 与已有 snake_case compatibility aliases 做 trim + non-empty validation。self-parent relationship fail open 为无 parent，避免污染 tree。

`useThreadLinking` 同时消费 parent-side `subAgentActivity`。live camelCase shape 与 persisted snake_case shape 都在 boundary normalize；`kind = started` 时用现有 `ensureThread` 一次写入 child、parent 与 `agentPath` basename，随后 catalog nickname 可继续覆盖 provisional name。普通 `collabToolCall` / `collabAgentToolCall` 路径保持不变。

Rejected: 等待下一次 catalog refresh。该路径正是 root-to-child flash 的来源，并引入不确定 latency。

Rejected: 从 active thread 推断 parent。多 session 并行时 active tab 不是 owner proof，可能错绑 child。

### Decision 2: extend `ensureThread` instead of adding another action

`ensureThread` 增加 optional `name` 与 `parentThreadId` metadata。reducer 对 new/existing/pending-finalized summary 使用同一 action 原子合并，并保留 no-op reference equality。

这样 Sidebar selector 在第一次读取新 child summary 时已经能获得 parent relationship，不需要依赖后续 `setThreadParent` side effect。

### Decision 3: keep explicit naming precedence

用户 custom name 与正在生成的 auto title 继续优先。仅当没有这些 override 时，live child 使用 `agentNickname`；普通 thread 仍使用现有 `previewThreadName(preview)` fallback。

live notification 与 `thread/list` summary 复用同一 identity resolver，按 `agent_nickname -> agent_path basename -> fallback` precedence 投影标题。`setThreads` 在 incoming summary 缺 relationship 时保留已有 parent，但不冻结 name，确保 custom / mapped title 仍能覆盖 agent nickname。

Catalog 后续仍可补强弱标题，不改变 stable child UUID。

### Decision 4: preserve compatibility and fail open

旧 app-server 若不提供 `parentThreadId` / `agentNickname`，行为保持现状并由 catalog fallback 最终收敛。普通 top-level notification 不被延迟。

## Risks / Trade-offs

- [Risk] live protocol field 命名在旧 runtime 使用 snake_case。
  - Mitigation: boundary 同时接受 camelCase / snake_case，进入 reducer 前统一为 trimmed string。
- [Risk] repeated `thread/started` 使 reducer churn。
  - Mitigation: existing-summary merge 比较 `name`、`parentThreadId` 与 provider fields，语义相同时返回原 state reference。
- [Risk] custom title 被 agent nickname 覆盖。
  - Mitigation: `getCustomName` / `isAutoTitlePending` gate 在构造 action 前执行。
- [Risk] parent 不在当前 bounded Sidebar projection。
  - Mitigation: relationship 仍保存在 child summary；现有 membership/page contract 保持不变，parent 可见后 tree 收敛。

## Verification Strategy

- RED/GREEN hook test: full Codex child `thread/started` payload 必须在单个 `ensureThread` action 中携带 parent + nickname，且不得 dispatch inherited preview rename。
- Reducer test: new/existing summary 原子写入 relationship/title，重复相同 metadata 必须 no-op。
- Integration/tree test: parent + child 首次 state snapshot 为 one root + one depth-1 child。
- Regression: ordinary top-level Codex `thread/started` 仍立即使用 preview。
- Run focused Vitest、`npm run typecheck`、`npm run lint`、runtime contracts 与 strict OpenSpec validation。
