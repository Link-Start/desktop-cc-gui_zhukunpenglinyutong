## ADDED Requirements

### Requirement: All Git changed-file modal entrypoints use the editable review surface
主 Source Control、Git History worktree 与 commit details 的 changed-file modal preview MUST 使用同一个 modal host，并渲染现有 `WorkspaceEditableDiffReviewSurface`；legacy `GitDiffViewer` modal body MUST NOT 作为这些入口的 fallback。

#### Scenario: Worktree file opens unified preview
- **WHEN** 用户从任一 worktree changed-file list 请求 modal preview
- **THEN** 系统 MUST 打开具有统一 header、block navigation、aligned gaps 与 editable current column 的新 preview surface

#### Scenario: Historical commit file opens unified preview
- **WHEN** 用户从 commit details changed-file tree 请求 modal preview
- **THEN** 系统 MUST 通过 commit diff adapter 打开同一种 preview surface，并保持 historical source read-only contract

#### Scenario: Baseline cannot be reconstructed
- **WHEN** full diff recovery 仍无法重建 previous content
- **THEN** 新 preview surface MUST 保持挂载并报告 unavailable state，MUST NOT 回退 legacy modal renderer
