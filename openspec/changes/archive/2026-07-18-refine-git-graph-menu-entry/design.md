## Context

`GitDiffPanel` 使用同一份 `modeOptions` 同时驱动当前 mode trigger metadata 与 dropdown selectable items。当前 `log` option 显示为 `Git`，而 menu 末尾还有调用 `onOpenGitHistoryPanel` 的 `Hub` action，形成两个相近入口。`log` mode 仍被其他 UI surface 和现有 render branches 使用，因此不能从类型或 metadata 中删除。

## Goals / Non-Goals

**Goals:**

- dropdown 中只保留一个明确的 Git history navigation action。
- 将该 action 命名为 `Git Graph` 并使用 `GitCommitHorizontal`。
- Sidebar settings menu 的同一 action 复用相同 i18n key 与 icon。
- 通过 scoped modifier 强调 Git Diff menu 中的 `Git Graph`，不影响相邻 menu items。
- 保留现有 callback、mode contract 与其他入口的兼容性。

**Non-Goals:**

- 不合并 `log` mode 与 Git History panel。
- 不改变任何 Git request、state persistence、routing 或 backend behavior。
- 不全局重命名 `git.logMode`，只统一明确指向 Git History panel 的入口。

## Decisions

### 1. 在 render boundary 过滤 `log` option

保留 `modeOptions` 中的 `log` metadata，dropdown 渲染时排除该 value。相比直接删除 metadata，这能确保外部入口激活 `mode="log"` 时 trigger 仍显示真实 mode，不会错误 fallback 为 `diff`。

### 2. 复用现有 quick action callback

`Git Graph` 只替换 label 与 icon，继续调用 `onOpenGitHistoryPanel`。不新增 handler、state 或 navigation abstraction。

### 3. `Git Graph` 作为跨 locale 专有产品术语

所有 locale 的 `historyQuickAction` 使用相同英文专有名称，避免机器翻译把 Git graph 误解为一般“中心”或“历史”。

### 4. 用 focused component test 固化 UI boundary

测试同时断言旧 `Git` menu option 不可见、`Git Graph` 使用 `.lucide-git-commit-horizontal`，且点击仍触发原 callback。测试不 mock 或重写功能层。

### 5. Sidebar 复用现有 Git Graph presentation contract

`SidebarSettingsMenu` 将 `GitBranch + git.logMode` 替换为 `GitCommitHorizontal + git.historyQuickAction`。不修改 `onAppModeChange`、active state 或 menu close behavior，也不触碰未被当前 UI 调用的备用 component。

### 6. 通过 scoped modifier 提供视觉强调

只给 Git Diff menu 的 quick action 增加 `git-panel-select-option--git-graph` modifier。CSS 将 label 设为 `font-weight: 700`，并让 label/icon 使用 `var(--accent-primary, #2563eb)`；不改变 row background、spacing、hover/focus contract。

## Risks / Trade-offs

- [Risk] 未来维护者可能把 render filter 误认为 dead mode。
  → Mitigation: 测试明确描述“hidden from selector while compatibility remains”，并保留 `log` render branches。
- [Risk] `Git Graph` 位于 file list section 后方，视觉上仍可能被理解为 layout option。
  → Mitigation: 保留既有 divider，当前任务不扩大 layout scope；后续如需重组菜单应单独提案。
- [Trade-off] 所有 locale 保留英文 `Git Graph`，本地化程度降低，但 technical term 一致性和可识别性更高。
- [Risk] accent color 在 hover/active 状态被通用 icon rule 覆盖。
  → Mitigation: modifier 显式覆盖 normal/hover/focus/active icon state，并继续使用 theme token。

## Migration Plan

1. 更新 delta spec 与 focused test。
2. 修改 menu render、icon import 和 locale values。
3. 运行 focused Vitest、typecheck 与 strict OpenSpec validation。
4. 如需回滚，恢复 render list、`History` icon 与 locale values；无数据迁移。

## Open Questions

无。本次边界已由用户确认：只改 UI，不触及功能逻辑。
