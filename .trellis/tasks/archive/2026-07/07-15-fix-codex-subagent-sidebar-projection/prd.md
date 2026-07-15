# 修复 Codex 子代理侧栏重复投影

## Goal

修复 Codex TUI 主会话 spawn 的 subagent rollout 被 cc-gui 当作多个同名顶层会话显示的问题，使现有 Sidebar parent-child tree contract 对 Codex local history 同样成立。

关联 OpenSpec change：`fix-codex-subagent-sidebar-projection`。

## Requirements

- 从 Codex `session_meta.payload.source.subagent.thread_spawn` 读取 `parent_thread_id`。
- child session 保持自己的 canonical UUID，不按 title 或 parent UUID 粗暴去重。
- child session 的 display title 优先使用 `agent_nickname`，其次使用 `agent_path` 的末段，避免继承 parent prompt 后出现同名顶层行。
- workspace/global catalog 与 runtime local-thread fallback 都必须传递 `parentSessionId`。
- physical duplicate rollout 必须在 limit/usage consumer 前按 canonical UUID 收敛，不能重复占分页窗口或重复统计 usage/cost。
- local/live merge 必须把 canonical parent UUID 解析为当前 visible rollout alias。
- Sidebar 复用既有 `parentThreadId` tree projection，将 Codex child session 放到 parent row 下。
- 不删除 subagent rollout，也不从 local usage token/cost 统计中排除它们。

## Acceptance Criteria

- [x] 真实结构 fixture 中 parent + 多个 Codex child 只产生一个 root，children 具有独立 UUID。
- [x] parser 能抵抗 child rollout 后续嵌入 parent `session_meta`，不会覆盖 first child identity/relationship。
- [x] child title 不再使用继承的 parent prompt。
- [x] 同一 child UUID 的重复 rollout 仍由 canonical identity 去重。
- [x] duplicate rollout 在 bounded truncation 与 usage aggregation 前去重，catalog child count 不虚高。
- [x] parent/child live row 使用 rollout filename alias 时仍形成一棵树。
- [x] focused Rust/Vitest、typecheck、lint 与 runtime contract checks 通过或记录明确 baseline blocker。

## Technical Notes

- Backend source truth：`src-tauri/src/local_usage.rs` 与 `LocalUsageSessionSummary`。
- Catalog contract 已包含 `WorkspaceSessionCatalogEntry.parentSessionId`，无需新增 Tauri command。
- Frontend tree seam：`ThreadSummary.parentThreadId` + `useThreadRows()`。
- 禁止按 title dedupe；不同 child UUID 是真实独立会话。
