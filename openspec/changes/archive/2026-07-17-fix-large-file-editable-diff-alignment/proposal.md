## Why

大文件 editable Diff 在行数乘积超过 `ALIGNMENT_CELL_LIMIT` 后退化为按绝对行号比较；文件前部插入少量行会让后续所有相同行错位，并把真实 `+14 / -0` 误报为数千处差异。该共享 fallback 同时影响 Git modal editable review 与 workspace file compare，必须在 alignment source boundary 一次修复。

## 目标与边界

- 大文件在局部插入、删除或多 hunk 变更后 MUST 保持未修改行的序列对齐。
- changed-row markers 与 visual gaps MUST 只覆盖真实变化；previous/next navigation MUST 按连续 diff block 聚合，并以 block 首行定位。
- 小文件现有 replacement pairing、n-way compare 与 editable draft 行为 MUST 保持不变。
- 极端高 edit-distance 输入 MUST 有显式计算上限，避免同步 Diff 阻塞 renderer 主线程。

## 非目标

- 不修改 Git patch 获取、baseline reconstruction、modal request 或 workspace file read/save contract。
- 不改变 `+/-` Git 统计口径，也不改变 line marker / gap 的逐行语义。
- 不重写 CodeMirror editor、marker decoration 或 scroll synchronization。

## What Changes

- 将大文件 alignment 的 index-based fallback 替换为可扩展的 line-sequence Diff，并继续输出现有 `AlignOperation` contract。
- 将已在 lockfile 中出现的 `diff` / jsdiff 声明为显式 runtime dependency，使用 `diffArrays` 的 Myers alignment 处理大文件低 edit-distance 场景。
- 为大文件顶部插入、多 hunk 插入/删除与 editable modal difference count 增加 focused regression tests。
- 将连续 changed rows 聚合为 navigation blocks；counter 按 block 数量展示，previous/next 跳转到各 block 首行。
- editable modal 将 difference navigation portal 到现有单行 header，并排在 Diff view mode controls 之前。
- compare column header 将栏位名称与文件路径合并为单行，长路径使用 ellipsis。
- compare column header 必须使用相同 fixed height，不得因 editable column 的 Save/dirty/error controls 改变 editor 起始 Y 坐标。
- alignment gap 使用低对比度 diagonal hatch 区分真实空行，不改变 gap 高度与逐行 alignment。
- alignment gap 的 pixel height 必须使用 CodeMirror runtime measured `defaultLineHeight`，避免 CSS metric 与 editor geometry 不一致后累积垂直偏差。
- Git file-list modal 的 editable compare 在 baseline 补取期间或失败后 MUST 保持当前 compare surface，不得切回 legacy patch body。
- 保留 bounded fallback：算法达到 edit limit 时稳定退回现有 index alignment，不抛异常、不冻结 UI。

## 方案对比与取舍

1. **采用：小文件保留现有 DP，大文件使用 jsdiff `diffArrays`。** 保持当前细粒度 replacement 语义，同时用成熟 Myers implementation 修复大文件移位，改动集中且可测试。
2. **不采用：仅提高 `ALIGNMENT_CELL_LIMIT`。** 4,000 行文件需要约 1,600 万 cells，继续扩大内存与 CPU，且更大文件仍会回到错误 fallback。
3. **不采用：只裁剪 common prefix/suffix。** 能修单一局部变化，但多个相距较远的 hunk 仍可能跨过 cell limit 并误算。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `editable-workspace-diff-review-surface`: 大文件 editable review 必须保持真实 changed-row count、line alignment 与差异导航。
- `workspace-file-compare-tool`: 大文件局部及多 hunk 变化必须保持未修改行对齐，不得因 index fallback 放大差异。

## 验收标准

- 约 4,000 行文件在前部新增 14 行时，`changedRows.length` MUST 为 `14`，后续相同行不得标记为 changed。
- 大文件存在两个相距较远的 insertion/deletion hunk 时，两个 hunk 之间和之后的相同行 MUST 保持对齐。
- editable modal navigation MUST 将连续 14 个新增行显示为 `1 / 1`，并定位该 block 首行。
- 多个由 unchanged row 分隔的 change regions MUST 分别计为独立 block。
- editable modal header MUST 保持单行，difference navigation MUST 位于 Diff view mode controls 之前。
- compare column header MUST 在同一行展示 role label 与 file path，且长路径不得挤压 actions。
- 左右 column editor 的 top edge MUST pixel-level 对齐，无论任一 header 是否包含 actions。
- alignment gap MUST 具有从左下向右上的 diagonal hatch background；真实空行与 unchanged code region MUST 不受影响。
- 任意 gap block 后的左右 shared unchanged row MUST 保持 pixel-level horizontal alignment。
- Git preview patch 被截断时，editable modal MUST 使用 `getGitFileFullDiff` 尝试恢复 baseline；full diff 仍不可重建时 MUST 保持图 3 compare surface，并显式显示 baseline unavailable。
- Git file-list 入口 MUST 穿过真实 `WorkspaceEditableDiffReviewSurface` 进入 editable compare，测试不得通过 mock 整个 review surface 掩盖 selection regression。
- 现有 `fileCompareDiff` 与 `WorkspaceEditableDiffCompare` focused tests、typecheck、lint 和 strict OpenSpec validation 通过。

## Impact

- Frontend helper：`src/features/files/utils/fileCompareDiff.ts`。
- UI：`WorkspaceEditableDiffCompare.tsx`、`WorkspaceFileComparePanel.tsx` 与 popup header styles。
- Styles：`file-view-panel.css` 中的 shared column header 与 CodeMirror gap widget visual treatment。
- Tests：`fileCompareDiff.test.ts`、`WorkspaceEditableDiffCompare.test.tsx`。
- Dependency：`package.json` / `package-lock.json` 显式声明 `diff`；无新增传递依赖。
- 无 backend、IPC、persistence 或 migration 影响。
