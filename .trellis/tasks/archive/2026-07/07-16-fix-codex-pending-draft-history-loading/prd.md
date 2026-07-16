# Fix Codex Pending Draft History Loading

## Goal

实现 OpenSpec change `fix-codex-pending-draft-history-loading`：新建 disk Codex optimistic draft 不再被误判为 history loading。

## Requirements

- 删除 pending identity 到 restoring-history presentation 的额外派生。
- 保留 `historyLoadingByThreadId` 驱动的真实 history restore 行为。
- 更新 focused regression test。

## Acceptance Criteria

- [x] `codex-pending-*` 且无消息时 `Messages.isHistoryLoading` 为 false。
- [x] unloaded history selection 的 loading lifecycle 测试保持通过。
- [ ] focused tests、typecheck、OpenSpec strict validation 通过。
  - focused tests 与 strict validation 已通过；typecheck 被现有未跟踪 Composer test matcher 类型错误阻塞。

## Technical Notes

- OpenSpec: `openspec/changes/fix-codex-pending-draft-history-loading/`
- Frontend-only presentation fix；无 backend/API/dependency 变更。
