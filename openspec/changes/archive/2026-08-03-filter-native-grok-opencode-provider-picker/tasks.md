## 1. Native Provider Scope

- [x] 1.1 [P0，依赖：无] 输入：现有 Native picker capability 与 catalog owner；
  输出：Grok/OpenCode 进入 Native Provider-scoped picker，五 CLI owner 仅返回当前 group；
  验证：`useProviderTargetCatalogOwners.test.tsx` 与 ChatInputBox focused Vitest。

## 2. 验证

- [x] 2.1 [P0，依赖：1.1] 输入：实现与回归测试；输出：行为与 delta spec 一致；
  验证：focused Vitest、`npm run typecheck`、targeted ESLint、
  `openspec validate filter-native-grok-opencode-provider-picker --strict --no-interactive`
  与 `git diff --check`。
