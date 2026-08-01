## 1. Renderer boundary

- [x] 1.1 将 rich implementation 移到显式文件与 symbol
- [x] 1.2 将现有 router 收敛为 canonical `FileMarkdownPreview`
- [x] 1.3 将旧 Fast 入口降为 compatibility re-export
- [x] 1.4 production consumer 只 import canonical router

## 2. Verification

- [x] 2.1 增加 import-graph contract test
- [x] 2.2 运行 Markdown/FileView 增量 Vitest
- [x] 2.3 运行 typecheck、touched-file ESLint、strict OpenSpec validate
- [x] 2.4 完成 review、archive、commit 与 Trellis session record
