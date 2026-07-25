# Separate Markdown Preview Renderer Boundaries

关联 OpenSpec change：`separate-markdown-preview-renderer-boundaries`

## 目标

- `FileMarkdownPreviewRouter.tsx` 成为 production canonical router。
- rich ReactMarkdown implementation 显式独立。
- Fast 旧入口只保留兼容 re-export。
- fast/rich/fallback 行为零回退。

## 验收

- import graph contract、Markdown/FileView focused tests、typecheck、touched ESLint 通过。
- strict OpenSpec validate、review、archive、commit、session record 完成。
