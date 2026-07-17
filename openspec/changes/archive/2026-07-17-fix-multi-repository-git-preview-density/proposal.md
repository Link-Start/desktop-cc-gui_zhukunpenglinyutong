## Why

多 repository Git commit workspace 已复用单仓 changed-file renderer，但 modal preview callback 在多仓 adapter 中仍是空实现，导致预览按钮可见却无法打开；同时 repository group header 的尺寸明显大于单仓 file-row，降低右侧窄面板的信息密度。该回归需要在既有 repository-scoped Git diff contract 上补齐，不应新增第二套预览或 backend API。

## 目标与边界

- 多仓 changed-file modal preview 使用 `workspaceId + repositoryRoot + filePath` 唯一定位目标文件。
- 快速切换不同 repository 的预览时，stale response 不得覆盖最新选择。
- repository group header 与组间距收敛到单仓 `26px` file-row 视觉基线，文件行继续复用共享 renderer。
- 保持 stage、unstage、commit inclusion、commit composer 与单仓 preview 行为不变。

## 非目标

- 不新增或修改 Rust/Tauri Git command signature。
- 不改变多仓 status polling、commit orchestration 或 Git History repository picker。
- 不重做统一 diff modal、file tree renderer 或主题系统。

## What Changes

- 为多仓 file row 接通 repository-scoped modal preview activation。
- 按 repository scope 复用现有 `getGitDiffs` 与 `getGitFileFullDiff`，并防止异步响应串仓。
- 将多仓 preview 的 diff source、full-context loader 与 workspace-relative edit path 绑定到同一 `repositoryRoot`。
- 将同一 full-context loader 继续透传到 editable compare baseline reconstruction，修复左侧已选 repository preview 卡在 loading 的问题。
- workspace、single/multi mode 或 single-repository `gitRoot` 切换时失效旧 preview request 并清理旧 modal。
- 压缩 repository group header、group gap、padding 与 typography，使其匹配单仓 changed-file 密度。
- 增加 component regression tests 与 CSS visual-contract test。

## 方案比较

1. **推荐：在 `GitDiffPanel` 预览 host 增加 repository-scoped source state。** 继续复用共享 file renderer、modal host 与现有 service wrapper，只在多仓 adapter 补充 identity；改动集中且能处理 same-relative-path 与 stale request。
2. **备选：为每个 repository 预加载完整 diffs 并塞入 status model。** 点击更快，但会在面板加载时并发读取所有 dirty repositories，增加无用 IPC、内存与刷新复杂度，不符合 YAGNI。
3. **不采用：多仓单独实现 modal。** 会复制 unified preview、dirty-close、full-context 与 edit-path contract，后续必然产生 behavior drift。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-panel-diff-view`: 多仓 changed-file preview 必须保持 repository identity，并与单仓 file-row 使用一致的紧凑视觉密度。

## 验收标准

- 点击任一多仓文件行的 modal preview action 会打开统一 preview modal。
- `getGitDiffs` 与 full-context loader 收到被点击文件所属的 `repositoryRoot`。
- 两个 repository 存在相同 `filePath` 时，modal 只展示最新点击 repository 的 diff；较慢旧请求不得覆盖。
- 多仓 repository header 使用单仓 file-row 的 `26px` 高度基线，文件行尺寸不另行放大。
- focused Vitest、typecheck、lint、`git diff --check` 与 strict OpenSpec validation 通过。

## Impact

- Frontend: `GitMultiRepositoryChanges`、`GitDiffPanel` preview state/wiring、`WorkspaceEditableDiffReviewSurface`、`WorkspaceEditableDiffCompare`、`diff.css`。
- Tests: 多仓 preview interaction、repository scope/stale response、CSS density contract。
- API/dependencies: 复用现有 optional `repositoryRoot` payload；无新依赖、无 breaking change。
