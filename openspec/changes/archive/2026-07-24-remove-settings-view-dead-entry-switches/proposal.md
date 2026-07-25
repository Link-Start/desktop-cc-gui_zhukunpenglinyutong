# Proposal: remove-settings-view-dead-entry-switches

## 背景与业务判断

`src/features/settings/components/settings-view/settingsViewConstants.ts` 中存在 5 个恒为 `false` 的 feature flag（`SHOW_COMMIT_ENTRY` / `SHOW_COMPOSER_ENTRY` / `SHOW_DICTATION_ENTRY` / `SHOW_EXPERIMENTAL_ENTRY` / `SHOW_GIT_ENTRY`）。这些开关长期未启用，其控制的 `SettingsView.tsx` sidebar 入口按钮 JSX 分支是 dead code——运行时永远不会渲染，却保留在热文件中，增加阅读与 diff 噪音。

业务上这些 sidebar entry（commit / composer / dictation / git / experimental）已被其他入口取代或长期隐藏，删除死分支不改变任何可见行为。这属于纯 dead code 清理，无产品行为变更。

## 改动范围

1. `src/features/settings/components/settings-view/settingsViewConstants.ts`
   - 删除 `// Feature flags to show/hide settings sidebar entries` 注释及 5 个 `SHOW_*_ENTRY = false` 导出（共 6 行）。
   - 文件保留：`DICTATION_MODELS` 与 `TEMPORARILY_DISABLED_SIDEBAR_SECTIONS` 仍被使用。
2. `src/features/settings/components/SettingsView.tsx`
   - 删除 `:131-135` 的 5 个 `SHOW_*_ENTRY` import。
   - 删除 5 个恒 false 的 JSX 分支（共 59 行）：
     - commit 入口 `:1916-1926`（11 行）
     - composer 入口 `:1938-1948`（11 行）
     - dictation 入口 `:1949-1959`（11 行）
     - git 入口 `:1960-1970`（11 行）
     - experimental 入口 `:1991-2005`（15 行）
   - 删除 5 个仅死分支使用的 icon import（已逐一 grep 确认引用闭包仅限死分支）：
     - `GitCommitHorizontal`（`:64`）、`FileText`（`:11`）、`Mic`（`:7`）、`GitBranch`（`:9`）、`FlaskConical`（`:12`）

预计删除约 75 行。锚点最小化，不触碰文件其他部分。

## 验收口径

- `npm run typecheck` 通过
- `npx eslint` 对两个改动文件通过
- `src/features/settings/components/SettingsView.test.tsx` 相关 vitest 通过
- grep 确认 `SHOW_*_ENTRY` 与 5 个 icon symbol 在改动文件中无残留引用
