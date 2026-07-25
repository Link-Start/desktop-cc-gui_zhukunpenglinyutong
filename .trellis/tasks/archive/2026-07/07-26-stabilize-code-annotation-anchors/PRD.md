# Stabilize Code Annotation Anchors

关联 OpenSpec change：`stabilize-code-annotation-anchors`

## 目标

- annotation 创建时持久化 exact code snapshot 与 context fingerprint。
- 文件行号漂移后，在 ±120 行内安全重定位。
- 重复/越界候选返回 stale，不做 fuzzy guess。
- 只跑 code-annotation/FileView 增量测试。

## 验收

- OpenSpec tasks 全部完成且 strict validate 通过。
- focused Vitest、typecheck、touched-file ESLint 通过。
- 完成批次 review、archive、commit 与 Trellis session record。
