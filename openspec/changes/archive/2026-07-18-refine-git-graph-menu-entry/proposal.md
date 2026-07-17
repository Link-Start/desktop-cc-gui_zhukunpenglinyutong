## Why

Git Diff mode menu 同时暴露旧 `Git` mode 入口与 `Hub` 快捷入口，两者都指向提交历史语义，名称和 icon 也无法清晰区分。需要收敛菜单中的可见入口，让用户通过单一、专业且可预测的 `Git Graph` action 打开现有 Git History panel。

## 目标与边界

- 仅调整 Git Diff mode menu 的 UI 文案、icon 与 selectable option visibility。
- `Hub` 改名为 `Git Graph`，使用 Lucide `GitCommitHorizontal`。
- 隐藏 menu 内旧 `Git` (`log`) option，但保留 `log` mode、render branch、state、callback 与其他入口兼容性。
- `Git Graph` 继续调用原有 `onOpenGitHistoryPanel`，不改变 Git history 数据加载或 panel 生命周期。
- Sidebar settings menu 的同一 Git History 入口复用 `Git Graph` 文案与 `GitCommitHorizontal` icon。
- Git Diff mode menu 中的 `Git Graph` label 与 icon 使用 theme-aware accent color，label 使用 bold weight。

## 非目标

- 不删除或重构 `log` mode。
- 不修改 shortcut、Git History panel、Tauri command 或 backend Git 能力。
- 不全局重命名 `git.logMode`，避免改变仍表达底层 mode 的其他 surface。
- 不调整 menu layout、样式 token、文件列表 `Flat` / `Tree` 行为。

## What Changes

- Git Diff mode menu 不再渲染旧 `Git` mode option。
- 原 `Hub` quick action 的所有 locale 文案统一为专有名称 `Git Graph`。
- quick action icon 从 `History` 改为 `GitCommitHorizontal`。
- Sidebar settings menu 的 Git History action 复用 `git.historyQuickAction` 与 `GitCommitHorizontal`，避免同一能力出现不同名称和 icon。
- `Git Graph` quick action 增加 scoped visual modifier：label bold，label/icon 使用现有 theme accent token。
- 增加 focused UI regression assertions，验证旧入口不可见、quick action 文案/icon 正确且 callback 保持不变。

## 技术方案与取舍

### 方案 A：仅过滤 menu render option（采用）

保留完整 `modeOptions` metadata 与 `log` mode render flow，只在 dropdown map 前排除 `log`。这样外部入口仍可激活并正确显示当前 mode，改动严格停留在 presentation boundary。

### 方案 B：从 `modeOptions` 删除 `log`（不采用）

代码更少，但当其他入口把 panel 切换为 `log` 时，trigger metadata 会 fallback 到 `diff`，造成可见状态与真实 mode 不一致，破坏兼容性。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-panel-diff-view`: 明确 Git Diff mode menu 只暴露一个 Git history navigation entry，并保留 hidden `log` mode 的非菜单调用兼容性。

## Impact

- UI component: `src/features/git/components/GitDiffPanel.tsx`
- Sidebar component: `src/features/app/components/SidebarSettingsMenu.tsx`
- Styles: `src/styles/diff.css`
- Tests: `src/features/git/components/GitDiffPanel.test.tsx`、`src/features/app/components/Sidebar.test.tsx`
- i18n: `src/i18n/locales/*/git.ts`
- API / backend / persistence / dependencies: 无变更

## 验收标准

- 打开 Git Diff mode menu 时，不存在名为 `Git` 的 `menuitemradio`。
- menu 中存在 `Git Graph` action，使用 `GitCommitHorizontal` icon。
- 点击 `Git Graph` 仍且仅调用一次原有 `onOpenGitHistoryPanel`。
- Sidebar settings menu 显示 `GitCommitHorizontal + Git Graph`，且保持原有 `onAppModeChange` 行为。
- Git Diff menu 的 `Git Graph` label 使用 `font-weight: 700`，label 与 icon 使用 theme-aware accent color。
- `mode="log"` 的现有 render、类型与外部调用链未被删除或修改。
- focused Vitest 与 TypeScript typecheck 通过。
