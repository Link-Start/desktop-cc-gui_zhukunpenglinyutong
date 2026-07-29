## 1. Shared 创建入口

- [x] 1.1 [P0，依赖：无] 输入：现有 Sidebar new-session flyout；输出：`Shared CLI` submenu-only 二级菜单与五个 workspace-scoped CLI availability 项；验证：`SidebarWorkspaceMenuOverlay`、`useSidebarMenus`、`Sidebar` focused Vitest。
- [x] 1.2 [P0，依赖：1.1] 输入：所选 Shared CLI；输出：显式 `workspace + engine` callback 与 local runtime catalog initial-target resolver，不读取 active Composer Target；验证：resolver 与 AppShell focused Vitest、TypeScript typecheck。

## 2. Catalog 与 Runtime identity

- [x] 2.1 [P0，依赖：1.2] 输入：OpenCode `opencode models` discovery；输出：runtime/cached/generated precedence 的 last-known-good validation snapshot；验证：`engine::status` 与 Shared local target focused Rust tests。
- [x] 2.2 [P0，依赖：无] 输入：Kimi/Grok local Provider launch profile；输出：与 Shared durable Attempt 相同的 canonical Runtime key；验证：两份 provider profile focused Rust tests 与 Shared provider key matrix。

## 3. 增量门禁与交付

- [x] 3.1 [P0，依赖：1.*,2.*] 运行受影响 frontend Vitest、targeted typecheck/contract check 与 backend focused Rust tests；不运行全量测试。
- [x] 3.2 [P0，依赖：3.1] 运行 OpenSpec strict validation、能力 symbol 哨兵与 `git diff --check`，更新任务状态并按 frontend/backend 批次提交。
- [x] 3.3 [P0，依赖：3.2] 每次 commit 后执行 Trellis session record，记录用户授权的全量测试豁免与剩余手测项。
