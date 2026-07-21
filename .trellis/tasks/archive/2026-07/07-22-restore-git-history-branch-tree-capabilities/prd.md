# Restore Git History Branch Tree Capabilities

## Goal

在统一 single/multi repository Git History branch tree 中恢复 legacy navigator 遗漏的 navigation 与 branch status affordances。

## Requirements

- OpenSpec change: `restore-git-history-branch-tree-capabilities`。
- 恢复 active repository scoped `All Branches`。
- local root group 与 current branch group 默认展开。
- local branch 恢复 current emphasis、`HEAD`、special、ahead/behind badges。
- remote branch 恢复 special badge。
- 保持 search、exact repository/branch selection、context menu 与 independent expansion behavior。

## Acceptance Criteria

- [ ] focused component tests 覆盖全部恢复能力。
- [ ] 既有 branch tree tests 全部通过。
- [ ] `npm run typecheck` 通过。
- [ ] `npm run lint` 通过。
- [ ] OpenSpec strict validation 通过。

## Technical Notes

- 复用 `getSpecialBranchBadges`、`GitBranchListItem` 与现有 `.git-history-branch-*` CSS contract。
- 不改 backend/API，不新增 dependency，不恢复双 navigator implementation。
