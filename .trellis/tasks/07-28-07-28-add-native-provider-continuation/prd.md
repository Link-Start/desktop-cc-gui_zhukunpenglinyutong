# Change D: Native Provider Continuation

## OpenSpec

- Change: `add-native-provider-continuation`
- Source design:
  `docs/research/mossx-multi-cli-provider-session-foundation-design.md`
- Master checklist:
  `docs/plans/2026-07-27-multi-cli-provider-session-foundation-task-checklist.md`

## Goal

从 Native Session 只读冻结历史，使用另一个 Provider 创建独立 Native Session 继续对话；
来源不变，目标可恢复，Origin/Conversation Family 可追溯，Sidebar 不误投影成 Subagent。

## Scope

- `src-tauri/src/native_history/**`
- `src-tauri/src/shared_context/**`
- continuation persistence/commands and Desktop/daemon registry
- session catalog metadata
- `src/services/tauri/**`
- thread summary/sidebar menus/rows/tests
- Change D OpenSpec、Trellis contract、总任务清单

## Hard Boundaries

- 不复制、修改 vendor history。
- 不把 Native source 写 Shared Canonical Event Log。
- 不写 `parentThreadId`，不进入 Subagent tree。
- unstable cursor、ACK ambiguous、artifact integrity failure 全部 fail closed。
- 不跑全量代码测试，只跑增量 tests/typecheck/lint/strict spec validation。

## Acceptance

以 `openspec/changes/add-native-provider-continuation/tasks.md` 和 specs 为准。人工 Desktop
smoke 保留为发布前 gate，不用无法自动化的 UI 观察冒充已验证。
