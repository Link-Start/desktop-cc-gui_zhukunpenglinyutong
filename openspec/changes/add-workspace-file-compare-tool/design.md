## Context

现有 Files 面板已经有 `selectedNodePaths`、`orderedSelectedNodePaths`、多选拖拽和 renderer context menu。文件查看与编辑由 `FileViewPanel`、`FileCodeMirrorEditor`、`useFileDocumentState` 和 `readWorkspaceFile` / `writeWorkspaceFile` 负责，已经具备 dirty state、save shortcut、session cache、external change handling 的基础能力。

本功能需要新增一个中间区域 surface，而不是复用 Git diff review。原因是用户入口来自文件树的任意 workspace 文件或右上角工具菜单的临时文本，不一定对应 Git working tree diff，也不一定有旧/新版本语义。

## Goals / Non-Goals

**Goals:**

- 文件树多选 2-4 个文件后可从右键菜单进入 compare surface。
- workspace 文件对比列可编辑、可保存，并复用现有 workspace file editor save contract。
- 顶部工具菜单可打开左右 scratch compare，用于粘贴任意文本进行对比。
- compare surface 进入/退出不破坏现有 editor tabs、composer placement、right panel 和 file tree selection。
- 初版以行级 diff 高亮和同步滚动为核心，不追求完整 IDE merge resolver。

**Non-Goals:**

- 不实现 Git history / PR / commit compare 替代。
- 不实现三方 merge conflict resolver、accept left/right hunks 或自动合并写回。
- 不支持非文本文件的可编辑 compare。
- 不新增 backend command；读写继续走现有 `src/services/tauri.ts` workspace file service。

## Decisions

### Decision 1: 新增 compare center surface，而不是塞进 editor mode

`centerMode` 当前覆盖 `chat | diff | editor | memory | projectMap | intentCanvas`。文件 compare 有独立生命周期：可以由文件树多选或工具菜单打开，不等同于单文件 editor，也不等同于 Git diff。因此实现阶段应新增 `fileCompare` center mode 或等价 discriminated state，例如：

```ts
type FileCompareSession =
  | { kind: "workspace"; workspaceId: string; paths: string[] }
  | { kind: "scratch"; leftText: string; rightText: string };
```

取舍：新增 mode 会触及 `DesktopLayout`、`useLayoutNodes`、controller state，但语义清晰；把它伪装成 editor tab 会让单文件 active tab 与多列 compare 互相污染。

### Decision 2: 第一阶段复用现有 CodeMirror editor + feature-local diff helper

不先引入 `@codemirror/merge`。每个 compare column 复用现有文件读写能力或抽出 `FileCompareEditableColumn`，内部使用现有 CodeMirror 基座、language extension、save shortcut 和 dirty state。diff 计算使用 feature-local helper，输入为多列文本，输出 changed line ranges / line alignment metadata。

取舍：这避免新增依赖和 CodeMirror lazy boundary 风险，也让保存链路更可控。缺点是初版不会有完整 merge gutter、accept hunk 操作和高级 inline diff。

### Decision 3: 文件树入口只对“文件选择集合”生效

右键菜单中 compare action 使用 `orderedSelectedNodePaths` 过滤 `visibleTreePathTypeMap.get(path) === "file"` 后得到文件列表。只有文件数 >= 2 才显示或启用。文件夹、root、lazy placeholder 不进入 compare input。

取舍：避免把文件夹递归展开成海量文件，控制性能和交互歧义。后续如果需要“目录对比”，应另开 change。

### Decision 4: scratch compare 与 workspace compare 共用 diff viewer，不共用保存 state

scratch compare 是两栏纯文本输入，不关联 workspace，不显示保存按钮，也不写入 clientStorage。workspace compare 才创建 file-backed columns 并显示保存状态。

取舍：共用 diff helper 和列布局可以减少重复；保存/dirty state 严格分开，避免用户误以为粘贴文本会落盘。

### Decision 5: 文件数上限先定为 4

workspace compare 支持 2-4 个文件。超过 4 个文件时不直接打开，应显示可读提示，要求用户缩小选择。图1是 3 列，4 列是宽屏可接受上限；更多列会挤压编辑器、影响性能和可读性。

### Decision 6: `fileCompare` center mode 必须全链路显式接入

新增 `fileCompare` 不能只改 `DesktopLayout`。所有声明或消费 `centerMode` union 的 callsite 都必须同步更新，包括 `AppLayout`、`DesktopLayout`、`layoutNodesTypes`、`layoutNodeSections`、`useLayoutNodes`、`useSoloMode`、`useWorkspaceCycling`、`useSyncSelectedDiffPath` 及对应 tests。未关心 compare 的旧逻辑应把它当作独立 center surface，而不是落回 `chat`、`editor` 或 `diff`。

取舍：这会多触及几个类型定义，但可以避免 workspace cycling、solo mode、compact navigation 在运行时遇到未知 mode 后进入错误 fallback。

### Decision 7: 同一文件的普通 editor draft 与 compare draft 不得互相静默覆盖

如果同一 workspace 文件同时存在普通 editor tab 和 compare column，compare 保存必须继续走现有 workspace file save contract，并保留 save failure / dirty draft 语义。实现不得为了同步两个 surface 而直接清空另一侧 draft；如果现有 file document contract 无法自动合并，首版以“保存失败可见、local draft 不丢失、重新读取走既有 external change handling”为边界。

## Risks / Trade-offs

- [Risk] 多列 CodeMirror 同时挂载导致性能下降。  
  Mitigation: 限制最多 4 列；只对当前 compare session 挂载列；避免给每列引入重型 Markdown/document preview。

- [Risk] 复用 `FileCodeMirrorEditor` 时 annotation / code navigation props 过重。  
  Mitigation: 实现阶段优先抽一个轻量 `WorkspaceTextEditor` adapter，或者让 compare column 传空 annotation/no-op navigation callbacks，保持 contract 显式。

- [Risk] 文件树右键菜单对多选集合与当前右键目标的关系处理不一致。  
  Mitigation: 沿用现有 `onContextMenu` 逻辑：右键未选中节点时先改为单选；右键已选中集合内节点时保留集合并将该节点设为 primary。

- [Risk] scratch compare 与 workspace compare 混用 center state 后退出行为不清晰。  
  Mitigation: controller 提供 `openWorkspaceFileCompare(paths)`, `openScratchFileCompare()`, `closeFileCompare()` 三个动作；退出后回到 chat，且不清理 editor tabs。

- [Risk] 行级 diff 与用户对“IDE 级 merge”预期有差距。  
  Mitigation: UI copy 避免承诺 merge resolver；OpenSpec 明确第一阶段只要求行级 diff 高亮、同步滚动和可编辑保存。

## Migration Plan

1. 增加 OpenSpec + tests skeleton，锁定入口和 surface contract。
2. 增加 file compare state/actions，先让 scratch compare 能打开并渲染左右编辑区。
3. 接入文件树 compare action，传入 ordered selected file paths。
4. 实现 workspace compare columns 的读取、编辑、保存和只读限制。
5. 实现 feature-local diff helper 和 changed-line decoration。
6. 补齐 i18n、focused tests、typecheck、lint、large-file check。

Rollback strategy：该功能是新增 center surface 和新增菜单动作；回滚时移除 compare action、center mode 分支和新增组件即可，不影响已有 file editor / Git diff surface。

## Open Questions

- workspace compare 中是否需要“打开为普通文件 tab”按钮？非首版必要能力。
- 是否需要在 compare surface 内保留“上一处/下一处差异”导航？建议首版加入，因为成本低且能显著提升可用性。
