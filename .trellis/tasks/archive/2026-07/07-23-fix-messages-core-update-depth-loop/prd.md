# Fix AppShell recent-files update depth loop

OpenSpec: `fix-messages-core-update-depth-loop`

## Goal

修复 0.7.7 production bundle 在 Codex streaming 期间由 Quick Switcher recent-files effect 触发的 AppShell React #185 更新闭环。

## Scope

- 用 production diagnostics、source map 与 startup OOM regression 区分失败表面和 feedback owner。
- 在共享反馈源实施 referential equality / idempotence 修复。
- 保留 Quick Switcher 真实 recent-file 与 workspace projection 更新。
- 修复 `src/app-shell.startup.test.tsx` 的 `workspaceActivity.timeline` fixture contract。

## Acceptance

- Regression 覆盖等价 `workspaces` reference churn，且不出现 `Maximum update depth exceeded` 或 heap exhaustion。
- 等价更新不产生新 reference；真实 observable transition 仍发布。
- Focused tests、AppShell startup、typecheck、lint、production build 通过。
- `openspec validate fix-messages-core-update-depth-loop --strict --no-interactive` 通过。

## Rollback

回退本任务涉及的 frontend/test/OpenSpec 文件。无 storage、backend 或 API migration。
