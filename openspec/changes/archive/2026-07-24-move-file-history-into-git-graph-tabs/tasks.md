## 1. Navigation State（P0）

- [x] 1.1 [依赖: 无] 将 `useGitPanelController` 的单 File History center target 改为受控 multi-tab model；输入为 `FileHistoryTarget`，输出为去重后的 tabs/active id/open-close handlers；以 focused hook tests 验证去重、邻接 fallback 与 Git Graph 兜底。
- [x] 1.2 [依赖: 1.1] 通过 AppShell composition 把 tabs 与 handlers 传给 `GitHistoryPanel`，并清理 `centerMode="fileHistory"` editor-layer 路由；以 `rg` 和 layout tests 验证旧 mount/特判不再存在。

## 2. Git Graph Tab Surface（P0）

- [x] 2.1 [依赖: 1.1] 扩展 `GitHistoryPanel` typed props，在 integrated title layer 渲染 pinned Git Graph tab 和多个 File History tabs；以 component tests 验证 identity、active state、close callback 与 `tablist/tab/tabpanel` semantics。
- [x] 2.2 [依赖: 2.1] 在 active file tab 中复用 `FileHistoryView` body，移除 standalone duplicated header；以既有 File History tests 验证 text/image/binary/rename/retry/stale-response behavior 不回退。
- [x] 2.3 [依赖: 2.1] 增加 feature-scoped styles 与 i18n，使 tabs 在 light/dark、窄宽度和 overflow 下可用；以 DOM/style contract tests 验证 close action 与 horizontal overflow。
- [x] 2.4 [依赖: 2.1, 2.3] 根据 UI 验收反馈移除独立 tab row，将 tabs 合入既有 `.git-history-toolbar`，并收敛 active/focus 样式；以 component/style contract tests 验证单行结构。
- [x] 2.5 [依赖: 2.4] 将 pinned Git Graph tab 收敛为 icon-only，将 File History tabs 改为 file icon + content-fit label + compact close action；以 component/style contract tests 验证 accessible name 与 density。
- [x] 2.6 [依赖: 2.5] 根据 UI 验收反馈复用 shared `FileIcon/getFileName`，可见 tab label 仅显示 basename，并清除 close button 继承 padding/line-height 以保证 X 居中；以 component/style contract tests 验证。
- [x] 2.7 [依赖: 1.1, 2.6] 为 File History tabs 增加 shared `RendererContextMenu`，提供关闭、关闭其他、全部关闭；批量操作由 controller 原子更新，并以 hook/component tests 验证 target 与 fallback semantics。

## 3. Verification（P1）

- [x] 3.1 [依赖: 1.*, 2.*] 运行 focused Vitest suites、`npm run typecheck` 与 `npm run lint`，输出通过结果或记录 pre-existing failures。
- [x] 3.2 [依赖: 3.1] 运行 `openspec validate move-file-history-into-git-graph-tabs --strict --no-interactive` 并核对 git diff，确认未覆盖工作区既有未提交改动。
- [x] 3.3 [依赖: 3.1] 手动验证 File Tree/Git Diff 打开多个历史 tab、重复打开聚焦、关闭 fallback、Git Graph 操作保持可达。
