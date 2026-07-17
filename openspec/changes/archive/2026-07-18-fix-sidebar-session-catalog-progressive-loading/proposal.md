## Why

Sidebar session hydration already uses bounded catalog pages, but its change-local rationale and acceptance contract were lost. Without an explicit proposal, future work can regress startup into an all-history request or treat a bounded first page as authoritative absence.

## 2026-07-18 代码校准

- **裁定：当前代码已实现，自动化闭环后建议归档**。原 `0/8` 是 artifact 未回填，不是实现缺失。
- Backend 已在 `session_management_types.rs` 约束 page limit / scan lookahead / `nextCursor` / `sourceStatuses`；frontend 已在 `useThreadActionsSessionCatalog.ts`、`useThreadActionsLoadOlder.ts` 与 last-good snapshots 路径保留 scope、filter、attribution、cursor 和 stale-result rejection。
- 2026-07-18 focused frontend suite 4 files / 32 tests 通过；Rust 全量测试通过，包含 catalog pagination、lookahead cursor、partial/degraded source 与 authoritative removal contracts。
- large-history manual smoke 对本 change 不再提供独立判定价值：分页、stale query、degraded continuity 已由 deterministic tests 覆盖；root-render 性能验收归 `harden-conversation-rendering-for-large-history`。

## What Changes

- Define a bounded first-page contract for sidebar catalog hydration.
- Preserve continuation cursor and partial/degraded evidence when more history may exist.
- Keep “load older” filter semantics stable and prevent stale page results from replacing a newer query.
- Record focused tests and manual evidence before claiming completion.

## Capabilities

### Modified Capabilities

- `workspace-session-catalog-projection`: calibrates bounded first-page and continuation behavior for the sidebar consumer.

## Impact

- Documentation scope: sidebar/catalog behavior, pagination, source completeness, and verification gates.
- Expected implementation surfaces when work resumes: workspace catalog backend, thread list hydration, sidebar load-older flow, and focused tests.
- No implementation change is included in this documentation repair.
