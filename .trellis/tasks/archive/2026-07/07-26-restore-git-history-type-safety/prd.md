# Restore Git History type safety

## Goal

关联 OpenSpec change：`restore-git-history-type-safety`。恢复 Git History 四个核心文件的完整 TypeScript 检查。

## Requirements

- 建立 typed scope contracts，禁止新增 `any` 逃逸。
- 移除四个 `@ts-nocheck`。
- 保留所有高危 Git 操作与 UI 行为。

## Acceptance Criteria

- [ ] 目标文件零 `@ts-nocheck`
- [ ] TypeScript diagnostics 为 0
- [ ] focused tests、typecheck、touched lint 通过
- [ ] 完成 batch review 并修正 findings

## Technical Notes

基线为 494 diagnostics。优先修 scope root 和 consumer contract，不逐点堆 type assertion。
