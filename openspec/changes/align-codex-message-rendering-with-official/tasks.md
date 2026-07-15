## 1. Regression Contract

- [x] 1.1 更新 Codex assistant Markdown test，断言 keyword paragraph 不再生成 `.markdown-lead-*` 或 synthetic emoji。
- [x] 1.2 增加显式 emoji 保真断言，防止误删模型原文。
- [x] 1.3 运行 focused test 并记录 RED failure。

## 2. Minimal Implementation

- [x] 2.1 删除 `Markdown.tsx` 中的 lead detector integration。
- [x] 2.2 删除 `MessagesRows.tsx` 中仅用于 lead enhancement 的 Codex Markdown class 分支。
- [x] 2.3 删除 `codexLeadMarkers.ts` 与 `.markdown-lead-*` CSS。

## 3. Verification

- [x] 3.1 运行 focused Vitest 并确认 GREEN。
- [x] 3.2 运行 `npm run typecheck`、targeted ESLint 与相关 CSS contract tests。
- [x] 3.3 运行 OpenSpec strict validation。
- [x] 3.4 本地截图对照官方 Codex，写入 visual verdict。
