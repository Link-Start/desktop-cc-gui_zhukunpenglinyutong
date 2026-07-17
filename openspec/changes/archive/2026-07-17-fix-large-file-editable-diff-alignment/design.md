## Context

`computeFileCompareDiff()` 先以第一个 column 为 base，使用 full-matrix edit distance 生成 `AlignOperation[]`，再构建 changed rows、line markers 与 gap decorations。为限制内存，`baseLines.length * targetLines.length > 800_000` 时 `alignTargetToBase()` 返回 `null`，调用方退化为 `computeIndexAlignedRows()`。

index alignment 不具备 insertion/deletion 语义：在约 4,000 行文件前部插入 14 行后，所有后续相同行都被按错误行号配对，导致 Git modal 显示约 4,000 个 changed rows。modal 的 Git patch、`reconstructPreviousVersion()` 与 `+14 / -0` 统计均正确。

约束：Diff 在 React render path 的 `useMemo` 中同步执行；需要保持 bounded cost。现有 helper 还服务于 2–4 column workspace compare，因此不能改成只理解 Git unified patch 的 modal-only 算法。`changedRows` 同时承担 marker 与 navigation 数据源，需要拆分两种语义而不破坏现有逐行 decoration contract。

## Goals / Non-Goals

**Goals:**

- 大文件低 edit-distance 输入使用序列对齐，而不是 index alignment。
- 继续输出既有 `AlignOperation`、changed rows、markers 与 gaps contract。
- 小文件现有 DP 与 fuzzy replacement pairing 不变。
- 对高 edit-distance 输入设置明确上限，避免不可控的 renderer stall。
- 连续 changed rows 聚合为 navigation blocks，block 首行作为唯一跳转锚点。
- popup editable Diff 的 navigation 与既有 controls 合并到同一 header row。

**Non-Goals:**

- 不改变 `changedRows`、line markers、visual gaps 与 Git `+/-` 的逐行统计语义。
- 不修改 baseline reconstruction、Git service、modal lifecycle、editor state 或 save flow。
- 不在本 change 内异步化整个 compare pipeline。

## Decisions

### Decision 1: 只替换 large-file fallback

当 matrix cell 数未超过 `ALIGNMENT_CELL_LIMIT` 时继续使用现有 DP；超过时调用 `diffArrays(baseLines, targetLines)`。这样小文件的 substitution cost、tie-breaking 与已覆盖行为不会漂移。

Alternative：所有输入统一切换 jsdiff。拒绝，因为它会不必要地扩大已有 n-way compare 的行为变化与回归面。

### Decision 2: jsdiff 结果适配现有 AlignOperation

large-file adapter 将连续 common block 映射成 `pair`；将一个 common block 之间的 added/removed edit group 先输出 `target-only`，再输出 `base-only`。这个顺序保持现有 gap row contract：完全不同的 replacement 仍表现为 inserted row + deleted row；likely replacement 通过现有 `areLikelyReplacementLines()` comparator 被视为一条 paired-but-changed row。

`diff` 必须进入 root runtime dependencies，不能依赖 `shadcn` 的 transitive installation。当前使用与 lockfile 已解析版本一致的 `^8.0.3`；该包无 runtime dependencies。

### Decision 3: bounded edit distance with unique-anchor fallback

large-file `diffArrays` 使用 `maxEditLength: 2048`。常见局部编辑的 edit distance 远低于该值；若返回 `undefined`，进入 bounded unique-anchor fallback，不再退回全文件 index alignment。

Review 发现 index fallback 会在超过 2048 行的前部 insertion 后把整个 unchanged suffix 错位。修正后，超限路径先收集两侧唯一且相同的 line anchors，再对 target index 执行 longest increasing subsequence，得到单调 shared anchors；仅 anchor 之间的无锚区段使用 bounded index pairing。该 fallback 为 O(n log n) time / O(n) memory，不重新进入 full matrix，也不会将远端 shared suffix 扩大为 false-positive differences。完全没有 shared unique anchor 的文本仍使用稳定的 bounded pairing，不抛错、不阻塞 renderer。

Alternative：提高 DP cell limit。拒绝，因为 4,000 × 4,000 已需要约 1,600 万 `Uint32` cells，计算与内存随文件规模平方增长。

### Decision 4: Regression contract at pure helper and UI boundary

pure helper test 使用超过 cell limit 的约 4,000 行 fixture，锁定顶部 14 行插入与相距较远的 multi-hunk changes。component test 使用同类 fixture，断言 14 个连续 changed rows 聚合为 `1 / 1`，证明 shared result 正确进入 modal editor navigation。

### Decision 5: 分离 changed rows 与 navigation blocks

`changedRows` 继续驱动逐行 markers、gaps 与 changed line numbers。新增 `changedBlocks`，仅在相邻 `rowIndex` 连续时归入同一 block，并复用该 block 第一条 `FileCompareLineChange` 作为 navigation anchor。workspace compare 与 editable modal 统一消费 `changedBlocks`，避免在两个 UI 层重复定义 hunk 边界。

### Decision 6: 使用现有 header portal 合并 popup toolbar

`WorkspaceEditableDiffCompare` 接收现有 `headerControlsTarget`；有 target 时将 navigator portal 到 modal header，无 target 时保留 compare surface 内部导航。CSS order 明确让 navigator 位于 view mode controls 前，并移除 popup compare 原本的 34px 独立导航行。

### Decision 7: column header 复用现有 DOM，仅调整 layout

`file-compare-column-name` 与 `file-compare-column-path` 已是独立 semantic spans。将父级从纵向 grid 改为单行 flex：name 固定不收缩，path 占剩余空间并 ellipsis，actions 继续位于独立 auto column。避免增加 duplicate label、wrapper 或 modal-only branch。

### Decision 8: alignment gap 使用 CSS-only diagonal hatch

`cm-file-compare-line-gap` 是 CodeMirror block widget，天然只代表缺失行而非真实空行。保留现有淡色 background 与左侧 marker，直接组合 `135deg repeating-linear-gradient` 绘制从左下向右上的 subtle hatch。该方案不需要 pseudo-element 或 mask，不修改 editor text、不增加 child DOM，也不改变 widget height。

### Decision 9: gap height 使用 CodeMirror runtime measurement

真实 `AuthServiceImpl.java` fixture 中，previous line 124 与 current line 105 的 `verifyPassword` 已被 `computeFileCompareDiff()` 放到相同 aligned row 132，证明 sequence alignment 正确。偏移来自 gap geometry：该 anchor 前左右累计相差 19 个 virtual rows，CSS `--code-line-height` 与 CodeMirror 内部测量的 `view.defaultLineHeight` 只要存在小量差异，就会放大为约两行视觉偏移。

`FileCompareLineGapWidget` 改为在 `toDOM(view)` 与 `updateDOM(dom, view)` 中使用 `lineCount × view.defaultLineHeight` 写入实际 pixel height。CSS 只负责 visual texture，不再推断 geometry。这样 source line 与 virtual gap line 使用同一个 runtime measurement source。

### Decision 10: column header 使用 fixed box height

左右 compare columns 是独立 grid。header 原先只有 `min-height: 36px` 与 vertical padding `6px`：read-only column 没有 action 时保持约 36px，editable column 的 28px Save button 加上 12px padding 与 border 后会把 header 撑到约 41px，导致两个 editor 从第一行开始就偏移。header 改为 fixed `height/min-height: 36px`、`box-sizing: border-box` 与 vertical padding `3px`，保证 actions 存在与否不改变 editor origin，同时无需缩小现有 28px icon button。

### Decision 11: baseline reconstruction 失败后按需补取 full diff

Git file list 的 `diffEntries` 使用 performance-bounded preview patch；大文件 patch 尾部可能包含 `[diff truncated for performance]`，使 `reconstructPreviousVersion()` 返回 `null`。`WorkspaceEditableDiffCompare` 先尝试现有 preview patch，只有失败时才调用 `getGitFileFullDiff(workspaceId, workspaceRelativePath)` 并重试 reconstruction。full diff 成功时继续图 3 editable compare；请求失败或 full patch 仍不可重建时，compare 保持挂载并在 previous column 显示 baseline unavailable，source column 与 save contract 不变。

异步结果使用 effect cleanup 拒绝过期回写，避免快速切换 file、workspace 或关闭 modal 后旧请求覆盖新状态。该恢复逻辑放在 baseline reconstruction boundary，因此所有复用 editable compare 的入口共享同一 contract，同时不会让正常小 patch 增加 IPC 请求。

### Decision 12: line ending 在共享保存边界恢复

CodeMirror 内部 document 统一使用 LF；Windows CRLF 文件一旦编辑，`onChange` 因此返回 LF。如果直接写盘会把单行编辑扩大为整文件 line-ending Diff。`useFileDocumentState` 保存时从既有 `externalDiskSnapshotRef` 磁盘事实快照推导统一 CRLF 或 legacy CR 格式，并且只转换写盘 payload；editor content 与 `savedContentRef` 继续使用当前内部文本，从而同时保证磁盘格式、dirty state 与 discard contract。LF 或 mixed line endings 不做隐式转换。复用磁盘快照也使 external-sync 改变 line-ending 后下一次保存使用最新格式，无需维护第二份 cache metadata。

成功保存后显式推进 document snapshot version，确保极快 Promise 被 React batch 时 `isDirty` 仍能按更新后的 `savedContentRef` 重新派生。external disk snapshot 保存实际写盘文本，避免 CRLF 文件被 external-sync 误判为外部修改。

## Risks / Trade-offs

- [Risk] jsdiff comparator 把 likely replacement lines 当作 common token，可能选择不同 anchor。→ 只在 large-file fallback 使用，并沿用现有 replacement predicate；小文件语义不变。
- [Risk] 完全不同的超大文本超过 2048 edit distance。→ unique-anchor fallback 仅对 shared unique lines 重锚；无 anchor 区段保持 bounded pairing，不抛错、不锁死 renderer。后续若需要更精细的重复行对齐，可独立设计 async worker diff。
- [Risk] mixed line endings 无法在 CodeMirror 编辑后逐行还原。→ 仅对统一 CRLF/CR 输入启用恢复；mixed 与 LF 保持 editor payload，不猜测逐行格式。
- [Risk] 新 dependency 增加 bundle。→ jsdiff 可 tree-shake 到 `diffArrays`，且包本身无 runtime dependencies；不引入第二套 UI 或 state model。
- [Risk] 多列 compare 中不同 columns 的相邻 edits 被合并。→ block 以 shared aligned row 连续性为准，与当前 gap/marker visual region 一致；出现 unchanged aligned row 即切分。
- [Risk] header 宽度不足。→ navigator 使用固定紧凑尺寸与 `white-space: nowrap`，并依赖现有 modal title ellipsis 释放空间。
- [Risk] 长路径挤压 role label 或 save action。→ role label `flex: 0 0 auto`，path `min-width: 0; flex: 1` 并 ellipsis，actions 保持独立 grid column。
- [Risk] gap texture 误导为真实 source line。→ diagonal hatch 只挂在 gap widget 并使用低对比度；真实 CodeMirror lines 不应用该 selector。
- [Risk] theme 或 WebView UI scale 改变 line-height。→ widget DOM 创建/更新时读取 CodeMirror measured `defaultLineHeight`；不依赖 CSS cascade 或 fallback value。
- [Risk] fixed header 压缩 action button。→ 36px border-box 减去 6px vertical padding 与 1px border 后仍可容纳现有 28px button；title/path 保持 single-line overflow contract。
- [Risk] preview patch 无效时增加一次 IPC。→ 只在本地 reconstruction 返回 `null` 后按需加载；正常 patch 保持零额外请求，并通过 cleanup 丢弃 stale result。

## Migration Plan

1. 显式安装 `diff@^8.0.3`。
2. 增加 large-file adapter，并接入原 cell-limit branch。
3. 添加 pure helper 与 component regressions。
4. 运行 focused Vitest、typecheck、lint、large-file gate 与 strict OpenSpec validation。
5. 聚合 navigation blocks，并将 popup navigator portal 到单行 header。
6. 合并 column header 文本行，并为 alignment gap 增加 CSS-only diagonal hatch。
7. 使用 CodeMirror runtime measured line height 计算 alignment gap pixels，消除多行 gap 后的累计偏差。
8. 固定左右 column header box height，消除 actions 导致的 editor 初始像素偏移。
9. preview patch 无法重建 baseline 时按需加载 full diff；无论恢复成功与否，都保持 editable compare surface。
10. 超过 bounded edit distance 时使用 unique anchors 重锚 unchanged regions。
11. 在共享保存边界恢复统一 CRLF/CR，并锁定快速保存后的 dirty-state convergence。

Rollback：移除 direct dependency 与 adapter，恢复原 `null -> index alignment` fallback；无数据迁移。

## Open Questions

无。
