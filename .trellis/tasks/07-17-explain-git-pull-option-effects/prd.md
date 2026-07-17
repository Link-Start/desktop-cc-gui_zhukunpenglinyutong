# 解释 Git Pull 选项组合效果

## OpenSpec

- Change: `explain-git-pull-option-effects`
- Source of truth: `openspec/changes/explain-git-pull-option-effects/`

## Goal

让低频使用 Git 的用户在 Pull Dialog 中选择 option 时，能立即理解每项作用、组合结果和不会发生的行为。

## Requirements

- 动态替换 `Intent / Will Happen / Will NOT Happen` 说明。
- 解释 default、四种 strategy、两个 additive option 及代表性组合。
- Pull Dialog 每次打开时默认展开修改选项，仍保留原 toggle。
- hero preview 与底部 `Example` 对 command、remote、branch、option 做一致的 token coloring。
- Fetch、Sync、Push 的框选 command、branch route、ahead/behind 与 target branch 使用同一语义色。
- 保持 option selection、command preview、payload、Tauri/Rust execution 完全不变。
- `--no-ff` / `--squash` 只说明 merge-path effect，不覆盖或假定现有 Git rebase configuration。
- 所有用户可见 copy 走 i18n。

## Acceptance Criteria

- [x] selection/chip removal 后说明和 command preview 同步更新。
- [x] no-op/redundant combination 有明确大白话提示。
- [x] option controls 打开 Dialog 即可见，手动收起/展开仍正常。
- [x] 两处 command preview 的完整字符串与 option ordering 不变，并有清晰 token 区分。
- [x] Fetch、Sync、Push 框选 surface 完成着色，完整自然文本与 input value 不变。
- [x] token root 不使用 prohibited accessible name，动态 effect summary 可被 polite status 播报。
- [x] 选中 option 后的 Pull request payload 有精确回归断言。
- [x] backend、service payload、option handlers 无修改。
- [x] focused tests、typecheck、lint、large-file gate 和 OpenSpec strict validation 通过。

## Technical Notes

使用 feature-local typed pure resolver 生成 translation keys；Dialog 只负责 render，不新增 React state/effect。
共享的 `GitOperationTokens` 仅拆分文本 token 并附加 semantic class；separator 仍按原顺序自然渲染完整
字符串，并通过 `translate="no"` 防止技术命令被自动翻译。
