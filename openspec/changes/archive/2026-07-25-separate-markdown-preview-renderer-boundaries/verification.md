# Verification

## Automated evidence

- Focused Vitest：
  - renderer boundary contract
  - rich Markdown budget / image fullscreen / Mermaid fullscreen
  - canonical fast/rich/fallback router
  - FileViewPanel parts 7/8/9
  - 8 files / 74 tests passed.
- `pnpm run typecheck` passed.
- touched-file ESLint、`git diff --check` passed.
- `openspec validate separate-markdown-preview-renderer-boundaries --strict --no-interactive` passed.
- Import graph：
  - production `FileViewBody -> FileMarkdownPreviewRouter`
  - canonical router `-> FileMarkdownPreviewRich`
  - compatibility `FileMarkdownPreviewFast -> FileMarkdownPreviewRouter`
  - rich implementation 无反向 import

## Review

- 首轮测试发现 router outline state update 会因默认 `annotations=[]` 引用变化重渲染 rich subtree，
  造成 Mermaid stable body 断裂与 fullscreen 测试超时。
- router 改用 module-level stable empty annotations；rich boundary 使用 `memo`，隔离 router-only state
  churn。失败用例重跑通过。
- 1582 行实现仍作为 feature-complete rich fallback 存在，不伪装成已删除；为避免新增大文件绕过
  large-file baseline，它保留在原 baseline-tracked path 并显式导出 Rich symbol。Fast compatibility
  entry 仅 11 行、无 renderer state/logic。
- 无新增 dependency，profile/fallback/annotation/cache-reset contract 保持。
