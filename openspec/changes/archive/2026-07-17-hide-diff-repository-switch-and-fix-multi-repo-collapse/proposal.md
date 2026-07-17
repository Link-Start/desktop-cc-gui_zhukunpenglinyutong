## Why

Diff mode menu currently exposes a repository-switch action that should no longer be shown, while multi-repository staged/unstaged headers render collapse affordances without an active toggle callback. The mismatch creates redundant navigation in one surface and a visibly broken interaction in another.

## 目标与边界

- Hide only the `Switch Git repository` action inside the Diff mode menu.
- Keep the existing repository scan, select, clear, and active-root behavior available to current non-menu callers.
- Make each multi-repository staged/unstaged section independently collapsible within the current component instance, scoped by workspace identity, repository identity, and section.
- Keep collapse state presentation-only: it MUST NOT change commit selection, Git index state, refresh behavior, file opening, or repository status data.

## What Changes

- Remove the repository-switch action and its separator from the Diff mode menu.
- Preserve all underlying repository-selection callbacks and selector-panel behavior for compatibility.
- Connect multi-repository section headers to local collapse state keyed by workspace identity, repository identity, and section.
- Add focused regression coverage for menu visibility, independent collapse behavior, and unchanged selection semantics.

## 技术方案与取舍

### 方案 A：在多仓库适配层补齐折叠状态（采用）

Reuse the existing `DiffSection` `isCollapsed` and `onToggleCollapsed` contract. Store only workspace/repository/section collapse keys in `GitMultiRepositoryChanges`.

- 优点：最小 diff，不改变共享组件与单仓库行为；状态隔离清晰。
- 代价：单仓与多仓分别持有 presentation state，但两者生命周期本就不同。

### 方案 B：把折叠状态提升到 `GitDiffPanel`

Create one shared collapse store for both single- and multi-repository modes and pass it through additional props.

- 优点：状态入口形式统一。
- 缺点：扩大 props 与状态影响面；引入跨模式 key contract，对当前缺陷属于过度设计。

选择方案 A，以兼容现有单仓行为并缩小回归半径。

## 非目标

- 不删除或重构 repository scanning、repository selector panel 或 `onSelectGitRoot` contract。
- 不持久化折叠状态，不在 workspace/repository 切换后恢复旧状态。
- 不改变 staged/unstaged 文件排序、tree/flat view、commit scope 或 Git mutation 语义。
- 不修改 Git history、Issues、Pull Requests、Hub 等其他入口。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `git-panel-diff-view`: Diff mode menu no longer exposes repository switching, and multi-repository staged/unstaged headers provide functional, independently scoped collapse behavior.

## 验收标准

- Opening the Diff mode menu does not render `Switch Git repository`.
- Existing repository selector/scanning code remains callable from all non-menu paths without signature changes.
- Clicking a multi-repository staged or unstaged header hides its own file list and updates `aria-expanded`.
- Collapsing one section does not collapse another section in the same or a different repository.
- Collapsing and expanding does not alter selected commit paths or invoke stage/unstage/refresh handlers.
- Focused Git component tests and TypeScript typecheck pass.

## Impact

- Frontend components: `GitDiffPanel`, `GitMultiRepositoryChanges`.
- Focused tests for the Diff menu and multi-repository change groups.
- Behavior spec: `git-panel-diff-view`.
- No backend API, Tauri command, persisted data, dependency, or migration impact.
