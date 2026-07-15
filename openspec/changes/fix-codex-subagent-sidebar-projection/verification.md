# Verification

## Status

Implementation verified. Focused regression tests and required compile/contract gates pass.

## Reproduction Evidence

- An anonymized real fixture has one canonical parent rollout.
- Local data contains nine child rollout files referencing that parent, representing eight distinct child UUIDs; one child UUID occurs in two physical files.
- Existing scanner treats each child as a top-level session and derives title from inherited parent prompt because structured subagent metadata is not projected.

## Implementation Evidence

- `LocalUsageSessionSummary.parentSessionId` preserves the first valid Codex child relationship.
- Parser supports snake_case and camelCase `subagent.thread_spawn` metadata.
- Child title precedence is `agent_nickname` → portable `agent_path` basename → existing user-summary fallback.
- workspace/global catalog、native local fallback 与 daemon adapter 均输出 `parentSessionId`。
- frontend raw-thread boundary maps `parentSessionId` to `ThreadSummary.parentThreadId`，existing Sidebar tree renders parent + child as one root subtree。
- Canonical identity merge keeps distinct child UUIDs and converges duplicate physical rollouts for one child UUID。
- Canonical dedupe now occurs in `scan_codex_session_summaries()` before usage aggregation and workspace/global truncation；duplicate files no longer consume multiple page slots or double-count usage/cost。
- workspace catalog computes `childrenCount` after identity dedupe。
- local/live fallback overwrites `canonicalSessionId` from local source truth and resolves canonical `parentSessionId` to the visible rollout alias when that parent row is present。

## Post-fix Analysis

- Root cause category：Cross-Layer Contract + Implicit Assumption。scanner 假设 `source` 是 scalar string，忽略了 Codex object-form subagent source fact；后续 catalog/fallback 又显式写入 `None`，使 relationship 在每层都丢失。
- Surface fixes that would fail：按 title 去重会误删 distinct child UUID；按 parent UUID 合并会破坏 child transcript/usage identity；只修 catalog 会遗漏 live-unavailable native/daemon fallback。
- Prevention：shared optional DTO field、snake/camel parser fixtures、canonical dedupe test、catalog/native/daemon mapping assertions、frontend boundary + Sidebar tree test，以及 Trellis executable contract 已全部落盘。
- Systematic expansion：其他 engine 若新增 structured source metadata，也必须在 source boundary 解析为 typed fact，再贯通 authoritative 与 degraded fallback；不能依赖 display title 推断 identity。

## Validation Results

- PASS: focused Rust `subagent` parser tests，包含 later copied parent metadata sticky behavior 与 camelCase/path fallback。
- PASS: focused Rust `parent_session_id` mapping tests for native、global catalog 与 daemon。
- PASS: focused Rust canonical child dedupe test。
- PASS: focused Rust source-boundary duplicate rollout test，覆盖 relationship/title/alias merge 与 non-additive usage evidence。
- PASS: focused Rust visible parent alias normalization test。
- PASS: focused Rust catalog child count after dedupe test。
- PASS: focused Vitest：`useThreadActions.helpers.test.ts` + `useThreadRows.test.ts`（21 tests）。
- PASS: `npm run typecheck`。
- PASS: `npm run lint`。
- PASS: `npm run check:runtime-contracts`。
- PASS: `cargo test --manifest-path src-tauri/Cargo.toml --no-run`；仅有 origin/main 已存在的 Rust warnings。
- PASS: `npx --yes @fission-ai/openspec@1.3.1 validate fix-codex-subagent-sidebar-projection --strict --no-interactive`。
- BASELINE BLOCKER: `npm run test` 在 batch 19/196 的 `Sidebar.test.tsx` 停止，3 tests failed / 44 passed。对同一 `origin/main` commit `740d56be` 的 clean temporary worktree 单独运行该文件得到完全相同的 3 个失败（runtime notice count 与 Codex provider menu role/name assertions），证明与本 change 无关。
- BASELINE/FLAKE EVIDENCE: full `cargo test --manifest-path src-tauri/Cargo.toml` reported 1380 passed / 3 failed。两个 workspace file cache invalidation tests 随后隔离复跑均通过；`engine::task_output::tests::rejects_existing_file_outside_allowed_roots` 在同一 `origin/main` commit `740d56be` clean temporary worktree 中同样失败，证明不由本 change 引入。
