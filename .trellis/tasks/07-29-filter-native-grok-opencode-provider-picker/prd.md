# Filter Native Grok/OpenCode Provider Picker

OpenSpec change: `filter-native-grok-opencode-provider-picker`

## Goal

Grok 与 OpenCode 独立会话的 model selector 只展示当前 CLI 的 Provider Profiles 与
Provider-scoped Models，行为与 Kimi Native Session 一致。

## Scope

- 补齐 `ChatInputBox` Native Provider picker capability。
- 补齐 Native catalog owner 的 supported engine scope。
- 添加 Grok/OpenCode focused regression tests。
- 保持 Shared Session 与 Home create-session 五 CLI picker 不变。

## Validation

- Focused Vitest
- TypeScript typecheck
- Targeted ESLint
- OpenSpec strict validation
- `git diff --check`
