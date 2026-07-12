## Context

`WorkspaceEditableDiffReviewSurface` 当前组合 `GitDiffViewer` 与 `FileViewPanel`，通过 `mode: "diff" | "edit"` 在两者之间切换。这保住了既有保存契约，但用户编辑时会失去左侧 diff 上下文。仓库同时已有 `WorkspaceFileComparePanel`，包含两栏 CodeMirror、line gap 对齐、difference navigation 与 scroll sync，可作为本次实现基础。

约束包括：CodeMirror state-coupled extensions 不得跨错误的 lazy boundary；文件保存必须继续由 `useFileDocumentState` 管理；historical/non-workspace review 不得获得写权限；弹窗现有 close、maximize、annotation 与 diff refresh contract 不能回退。

## Goals / Non-Goals

**Goals:**

- live workspace text diff 打开即显示左侧只读 baseline 与右侧可编辑 source。
- 左栏标识“上个版本”，右栏标识“源代码”。
- 复用现有 document/save state 与 compare visual primitives。
- 保存后刷新 patch、统计和 Git status；dirty close/switch 保持保护。
- Git、Checkpoint、Session Activity 三个入口共享同一行为。

**Non-Goals:**

- 不实现 3-way merge、hunk apply/reject 或左右双向编辑。
- 不改变历史 diff、图片、PDF、deleted file 的只读 renderer。
- 不新增 Rust command、文件协议或 npm dependency。

## Decisions

### Decision 1: 保留 GitDiffViewer 控制壳，仅组合受控 compare editor

`GitDiffViewer` 继续常驻并负责 Header Toolbar、split/unified、all/focused、close 与原 patch renderer。默认 `split + all` 时通过 `toolbarOnly` 快路径仅保留控制层，内容区组合 feature-local `WorkspaceEditableDiffCompare`；其他模式直接显示原 renderer。compare 复用 `FileCodeMirrorEditor`、`computeFileCompareDiff` 和 `useFileDocumentState`。

备选方案是在 `GitDiffViewer` 内嵌 editor。该方案会把 file IO、dirty、save 与 CodeMirror lifecycle 混入 patch renderer，导致 shared viewer 影响历史 diff，因此不采用。

### Decision 2: baseline 从当前 patch 与 working source 反推

统一 diff 的语义是将 baseline 转换为 working source。右栏加载 workspace 当前内容后，使用 change-local pure patch reconstruction helper 反向恢复 baseline；若 patch 无法可靠还原，则降级到原 `GitDiffViewer`，不得展示错误基线。

备选方案新增 Tauri command 读取 Git index/HEAD。当前入口同时包含 staged、unstaged 与 snapshot patch，单一 Git ref 不能准确表达每个 patch 的左侧语义，且会扩大跨层改动，因此不采用。

### Decision 3: 左栏只读、右栏复用 useFileDocumentState

左栏使用受控 CodeMirror 并显式设置 `editable: false`；右栏直接绑定 `useFileDocumentState.content/setContent/handleSave`。保存按钮、`Ctrl/Cmd+S`、dirty indicator 与错误提示沿用 file editor contract。右栏保存成功后触发 review diff 与 Git status refresh。输入内容保持 urgent state，只有 `computeFileCompareDiff` 消费 deferred snapshot，避免大文件 alignment 阻塞按键反馈。

### Decision 4: eligibility 决定双栏或只读 fallback

只有 workspace-relative、非 deleted、render profile 可编辑、非 image 的文本文件进入 IDEA-style surface。其余目标继续渲染 `GitDiffViewer`，避免伪装成可编辑。

### Decision 5: 保持旧弹窗控制层完整

maximize、close、split/unified、all/focused 等外层控制不进入 document state，也不得因可编辑 compare 被删除。默认 `split + all` 提供左右编辑；用户主动选择 `unified` 或 `focused` 时回到原 renderer。

### Decision 6: 双栏数量由 compare 容器显式声明

可编辑 compare MUST 与原 `WorkspaceFileComparePanel` 一样设置 `--file-compare-column-count: 2`，不得只依赖入口特定的 lazy stylesheet 覆盖。这样 Git、Checkpoint 与 Session Activity 任一入口独立打开时都保持 horizontal side-by-side。

### Decision 7: 未保存保护复用应用内 AlertDialog

Git、Checkpoint、Session Activity 的 modal close guard 与 compare 内部 mode/file switch guard 统一渲染 `UnsavedChangesDialog`。父弹窗只负责关闭确认，compare surface 只负责内部切换确认，避免 parent/child double prompt。Dialog 使用高于 diff modal 的 portal layer，并以“保存并关闭 / 继续编辑 / 放弃修改”表达明确动作；外部 save-in-flight 时三个动作统一禁用，不再调用 `window.confirm`。

## Risks / Trade-offs

- [Risk] patch 反向恢复在 rename、binary 或 malformed patch 上失败 → Mitigation：pure helper 返回 `null` 并自动回退 `GitDiffViewer`。
- [Risk] 双栏 CodeMirror 增加 modal 初次渲染成本 → Mitigation：继续通过既有 `FileCodeMirrorEditor` lazy boundary 加载，不引入新 bundle。
- [Risk] 保存时父层 refresh 导致编辑器提前重置 → Mitigation：只有 `handleSave` 成功后清 dirty 并刷新，右栏 document state 继续作为编辑事实源。
- [Risk] close/switch 丢失草稿 → Mitigation：dirty 状态进入统一 guard，取消关闭时不改变 selected path 或 modal state。
- [Trade-off] 第一版不提供 hunk apply/reject；保持范围专注于直接编辑与可靠保存。

## Migration Plan

1. 增加 patch baseline reconstruction pure helper 与 focused tests。
2. 提炼可复用 compare editor column primitives，构建 review 双栏组件。
3. 用 eligibility 替换 `mode` toggle，接入三个现有 call sites 的共享 surface。
4. 更新 CSS、i18n 与 component tests，执行 strict OpenSpec validation、focused Vitest、typecheck、lint。
5. 启动 Vite 做桌面与窄窗口人工验证。

回滚时可仅恢复 `WorkspaceEditableDiffReviewSurface` 的 `GitDiffViewer/FileViewPanel` mode switch；底层 file save 与 Git service 不受影响。

## Open Questions

- 无。用户已确认左栏为上个版本、右栏标识为源代码，并要求按共享入口统一推进。
