# Verification

## Automated Gates

- `./node_modules/.bin/vitest run src/features/composer/components/ChatInputBox/hooks/useCompletionDropdown.test.tsx src/features/composer/components/ChatInputBox/providers/agentProvider.test.ts`: PASS，2 files / 9 tests。
- `npm run typecheck`: PASS。
- `npm run lint`: PASS。
- `openspec validate fix-agent-completion-selection-index-alignment --strict --no-interactive`: PASS。
- `git diff --check`: PASS。

## Scope Audit

- Production code 仅修改 `useCompletionDropdown.ts` 的 mapped selection sequence。
- 未修改 agent provider、selection persistence、send payload、Tauri/Rust 或 CSS。
- Mouse、Enter、Tab 均覆盖 header + separator 前置场景。

## Repository-Wide Test Baseline

`npm run test` 在 batch 11/225 被 `src/app-shell.startup.test.tsx` 的 8 个既有失败阻断；单文件重跑同样失败，统一堆栈为 `src/features/quick-switcher/recentFiles.ts:243` 对 undefined `timeline.filter`。该文件及调用链不在本 change diff 中，因此未扩大本次修复范围。
