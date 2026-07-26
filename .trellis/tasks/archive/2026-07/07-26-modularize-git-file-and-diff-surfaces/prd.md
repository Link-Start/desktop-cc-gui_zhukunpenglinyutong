# Modularize Git/File and diff surfaces

关联 OpenSpec：`modularize-git-file-and-diff-surfaces`

## 目标

- #2：四个目标文件退出 large-file hard gate。
- #7：两个 AI commit 入口共享 generation controller。
- #10：diff/compare surface 共享 presentation model。

## 验收

- 只运行相关 Vitest suites、typecheck、touched ESLint、targeted large-file gate。
- 每个 capability slice 完成后 review；不跑全量测试。
