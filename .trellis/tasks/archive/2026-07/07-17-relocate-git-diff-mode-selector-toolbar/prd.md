# 迁移 Git Diff selector 到右侧顶部栏

## Goal

实现 OpenSpec change `relocate-git-diff-mode-selector-to-right-panel-toolbar`：desktop 右侧 Git tab 激活后，将现有 mode selector 移到 `right-panel-toolbar` 左侧，同时完整保留既有行为。

## Requirements

- 使用 explicit mount target + React Portal，禁止复制 Git mode menu state/callback。
- target 不可用时保留 inline fallback。
- non-Git tab 不显示或残留 selector。
- selector 外置后释放无用 content top reservation。
- worktree apply action 保持原位置与 callback。
- normal、swapped、narrow desktop layout 中 menu 不 clipping。
- 不新增 dependency，不改变 backend/API/storage。

## Acceptance Criteria

- [ ] Git active 时 selector 位于 toolbar leading slot，PanelTabs 保持同栏右侧。
- [ ] Diff / Git / Issues / PRs、flat/tree、Hub、outside click、Escape、shortcut 行为不变。
- [ ] non-Git tab 无 selector 残留，inline fallback 无重复控件。
- [ ] worktree apply action 独立且可达。
- [ ] focused tests、lint、typecheck、large-file、diff check、strict OpenSpec validation 通过。

## Technical Notes

- OpenSpec source of truth：
  `openspec/changes/relocate-git-diff-mode-selector-to-right-panel-toolbar/`
- 复用项目现有 `headerControlsTarget` / `createPortal` pattern。
- 相关 frontend specs：
  `.trellis/spec/frontend/directory-structure.md`
  `.trellis/spec/frontend/component-guidelines.md`
  `.trellis/spec/frontend/quality-guidelines.md`
