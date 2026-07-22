# 过滤 Quick Switcher 非文件工具调用

## Goal

修复 OpenSpec change `add-quick-switcher` 的 recent-file trust boundary：非文件 shell/tool payload 不得进入最近文件；文件名显示优先于 parent path。

## Acceptance Criteria

- [x] AI shell command、pseudo-device 与 persisted legacy pollution 不显示。
- [x] user-open path、README、dotfile、带空格文件路径保持可用。
- [x] filename-first layout 生效，parent path 优先 ellipsis。
- [x] focused tests、targeted ESLint、OpenSpec strict validation 通过；全项目 typecheck 已执行并记录无关并行变更阻断，用户 UI 验收通过。
