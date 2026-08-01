# 打开文件定位到文件树

## OpenSpec

- Change: `add-open-file-reveal-in-tree`
- Source of truth: `openspec/changes/add-open-file-reveal-in-tree/**`

## Goal

在 file content context menu 增加“定位到文件”，并在 main 与 detached file explorer 中展开 ancestor directories、选中目标文件、滚动到可见位置。

## Requirements

- 入口仅位于 file content context menu。
- main surface 必须切换到 Files panel。
- detached surface 必须展开 collapsed sidebar，且定位状态保持 session-local。
- 重复定位同一路径必须再次执行。
- 不改变 open tabs、active editor、buffer 或 filesystem。

## Acceptance Criteria

- [ ] 深层文件全部 ancestors 展开。
- [ ] 目标文件成为 primary single selection。
- [ ] 目标 row 执行 nearest `scrollIntoView`。
- [ ] 同路径 repeated reveal 可重放。
- [ ] 所有 locale key 齐全。
- [ ] Focused tests、lint、typecheck、OpenSpec strict validation 通过。

## Technical Notes

采用 owner-scoped monotonic reveal request；`FileTreePanel` 继续作为 expansion/selection 唯一 owner，不引入全局 store 或 backend API。
