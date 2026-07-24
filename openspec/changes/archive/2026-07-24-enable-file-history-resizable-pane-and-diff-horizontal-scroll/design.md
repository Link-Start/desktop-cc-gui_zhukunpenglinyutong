## Context

File History 下面面板的视觉锚点是 `.file-history-workbench` 的两列 grid。当用户选了一个含超长行或多个 repository 的文件 commit history 时：
- commit rail 不可调，路径列表不够用，只能等滚动；
- previous/source 两栏固定 1:1，diff 一边需要更宽时无抓手；
- compare columns 强制 `overflow: hidden` + `minmax(0, 1fr)`，长行被截掉。

Fix 路径：把 2 列扩展为 3 列 + 2 splitter，并解除 columns 容器的横向截断，让 cm-scroller 自然 overflow-x。

## Goals / Non-Goals

- Goal: commit rail / previous column / source column 三区域均可拖拽。
- Goal: 双击任一手柄可复位到默认宽度。
- Goal: diff 区域超宽行可滚动查看，不撑宽 File History workspace。
- Non-goal: 不引入跨 tab / 跨重启 width persistence。
- Non-goal: 不修改 `WorkspaceReadOnlyDiffCompare` 内部 compare logic、marker、lineNumberLabels 解析。
- Non-goal: 不修改 GitHistoryPanel 的 splitter 行为。

## Decisions

### Decision: 宽度存放在 owner ref 与 CSS custom property

`commitRailWidth` (number, px)、`previousColumnRatio` (number, 0–1) 分别保存在各自 owner
的 ref；视觉值写入 CSS custom property。target/file 切换时 reset 到 default，避免 stale
state，也避免拖拽 CodeMirror 时触发 React render。

### Decision: 两 splitter 都内联在 FileHistoryView

commit rail splitter 保留在 `FileHistoryView`；previous/source splitter 下沉到
`WorkspaceReadOnlyDiffCompare`，由 File History 与中间区域预览共同复用。两者都使用
drag-start snapshot，而不是把相对起点的 `deltaX` 重复累加到最新 state。

高频 pointer position 放在 local variable/ref，`requestAnimationFrame` 内批量更新 CSS
variable；mouseup flush 最终值，避免拖拽期间反复重渲染两个 CodeMirror。

### Decision: compare columns 容器 `overflow-x: auto`

把 `.file-history-diff .editable-diff-compare-columns { overflow: hidden }` 改成 `overflow-x: auto`。两个 compare column 自身 `minmax(0, 1fr)` + `min-width: 0` 保留，因此正常情况下不滚动；只有超宽行时 `.cm-scroller` 的横向滚动条才会出现。

### Decision: 不持久化宽度到 storage / storageKey

本任务范围仅 UI 拖拽手感；持久化会增加 stale key / 跨重启复杂度。

### Decision: 中间区域保留 toolbar，只替换 split text body

中间区域继续使用 `GitDiffViewer` 输出双栏/单栏与全文/区域 controls。仅当当前 entry
是 text diff 且 `diffStyle === "split"` 时，`GitDiffViewer` 保留自身 toolbar，并将 body
改为 `WorkspaceReadOnlyDiffCompare`。`unified`、image、binary、PR 与 editable modal
路径保持既有 renderer，避免“统一视觉”扩大成行为删除。

## Risks / Trade-offs

- host container 进入 720px stack 后两个 splitter 由 container query 隐藏，grid 恢复固定双栏；离开 breakpoint 后继续使用 owner 中的当前值。
- 双 splitter 数量 > 0 时 CodeMirror `.cm-scroller` 的 scroll-sync listener 需要继续工作；本次不动 `WorkspaceReadOnlyDiffCompare` 内部 scroll 同步逻辑，但需要在 css 上保留 `min-width: 0` + 横向 overflow。
- toolbar 与 aligned body 分离后，content mode/full-diff 必须继续由同一受控状态驱动；focused/all 切换不得出现 toolbar 与 body 内容不一致。

## Verification

1. `npm run typecheck`
2. `npm run lint`
3. `npx vitest run src/features/git-history/components/FileHistoryView.test.tsx src/styles/file-history-layout.test.ts`
4. `npx vitest run src/features/git/components/WorkspaceReadOnlyDiffCompare.test.ts src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx`
5. `openspec validate enable-file-history-resizable-pane-and-diff-horizontal-scroll --strict --no-interactive`
