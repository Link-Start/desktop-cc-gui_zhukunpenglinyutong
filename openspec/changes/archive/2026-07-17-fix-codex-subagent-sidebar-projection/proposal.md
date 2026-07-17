## Why

Codex TUI collaboration 会为 `spawn_agent` child 创建独立 rollout JSONL。该 child 文件的首条 `session_meta` 已包含自己的 UUID、`parent_thread_id`、`agent_nickname` 与 `agent_path`，但当前 `parse_codex_session_summary()` 只读取 scalar `source`，没有保存 structured subagent relationship。后续 workspace catalog 又把 Codex `parent_session_id` 固定为 `None`，因此 Sidebar 把每个 child 当作顶层 session。

child rollout 还可能包含 parent transcript/context。当前 title extraction 会取继承的 parent user prompt，导致多个不同 child UUID 显示为相同标题，视觉上像“同一个 UUID 被扫描多次”。匿名化真实 fixture 中存在多个 distinct child UUID，且其中一个 canonical child UUID 对应两个 physical rollout files，证明不能按 title 或 parent UUID 删除这些 session，也不能在 bounded scan 截断后才去重。

## What Changes

- 解析 Codex `session_meta.payload.source.subagent.thread_spawn` 的 `parent_thread_id`、`agent_nickname` 与 `agent_path`。
- `LocalUsageSessionSummary` 增加 optional `parentSessionId`，保留 child canonical UUID 与 usage/cost evidence。
- Codex child title 优先使用 agent identity，而不是继承的 parent prompt。
- workspace/global session catalog 与 local-thread fallback 传递 `parentSessionId`。
- frontend runtime fallback 将 `parentSessionId` normalize 为 `ThreadSummary.parentThreadId`，复用既有 Sidebar child tree。
- local scanner 在 usage aggregation 与 bounded truncation 前按 canonical UUID 收敛 physical duplicates，并保留 relationship/title/alias evidence。
- runtime local/live merge 将 canonical parent UUID 解析为当前 visible parent row id，兼容 rollout filename alias。
- 增加 parser、catalog/fallback mapping 与 Sidebar tree regression coverage。

## Capabilities

### Modified Capabilities

- `subagent-session-tree-navigation`: Codex rollout subagent MUST preserve deterministic parent-child relationship and render as a child session rather than a duplicate top-level row.

## Impact

- Backend scanner/types：`src-tauri/src/local_usage.rs`、`src-tauri/src/types.rs`
- Catalog/fallback projection：`src-tauri/src/session_management*.rs`、`src-tauri/src/codex/thread_listing.rs`、daemon local thread adapter
- Frontend boundary：`src/types/usage.ts`、`src/features/threads/hooks/useThreadActions.helpers.ts`
- Tests：Rust local usage/catalog tests 与 focused Vitest tree/mapping tests
- No command name、storage schema、dependency、CSS 或 canonical Codex JSONL mutation。
