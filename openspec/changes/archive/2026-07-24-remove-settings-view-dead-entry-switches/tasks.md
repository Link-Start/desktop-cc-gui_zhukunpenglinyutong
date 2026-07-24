# Tasks: remove-settings-view-dead-entry-switches

- [x] 1. grep 确认 5 个 `SHOW_*_ENTRY` flag 与 5 个 icon symbol（`GitCommitHorizontal`/`FileText`/`Mic`/`GitBranch`/`FlaskConical`）的引用闭包仅限目标锚点
- [x] 2. `settingsViewConstants.ts` 删除 5 个恒 false flag 导出及其注释（保留 `DICTATION_MODELS`、`TEMPORARILY_DISABLED_SIDEBAR_SECTIONS`）
- [x] 3. `SettingsView.tsx` 删除 5 个 `SHOW_*_ENTRY` import、5 个 icon import、5 段死 JSX 分支（约 59 行）
- [x] 4. 验证：`npm run typecheck` + `npx eslint`（改动文件）+ `SettingsView.test.tsx` 相关 vitest
