# 文件视图 Git Blame 注解

## OpenSpec Change

`add-file-view-git-blame`

## Goal

在当前文件编辑视图提供按需 Git Blame gutter，同时保持默认文件读取、first useful viewport 与 typing local-first 性能不回退。

## Requirements

- Blame 默认关闭，打开文件时零 blame IPC、零 blame gutter DOM。
- 用户显式启用后异步加载压缩 hunks，Desktop/daemon 与 multi-repository scope 等价。
- CodeMirror 仅渲染 viewport 可见注解；typing、cursor、hover、scroll 不重新请求。
- dirty 后标记 stale，save 后最多刷新一次，迟到响应不得串文件。

## Acceptance Criteria

- [ ] 每行短 `date + author`，当前行展示 short SHA、完整时间与 summary。
- [ ] disabled/first viewport/stale/save-once/zero-interaction-IPC tests 通过。
- [ ] focused frontend/Rust tests、typecheck、runtime contracts 与 OpenSpec strict validation 通过。

## Technical Notes

完整 contract、设计、任务和回滚策略以 `openspec/changes/add-file-view-git-blame/**` 为准；不新增依赖。
