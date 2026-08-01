# Git commit message engine picker

## Goal

将 GitDiff 与 GitHistory 的 commit message generation menu 重构为方案 B：单面板选择 language 与所有当前可用 engines。

## OpenSpec

`openspec/changes/add-cli-engine-visibility-toggle`

## Scope

- engine candidates 来自 global registry。
- 叠加 product execution policy 与 `disabledCliEngines`。
- 点击 engine 立即沿用既有 generation flow。
- 保留 last configuration 与“提交框位置”等 generic menu items。
- popup 根据 commit composer placement 锚定生成按钮，并使用紧凑单屏布局。
- 不改 backend、settings schema、checkpoint dialog 与 engine runtime。

## Validation

- Focused Vitest
- Targeted ESLint
- `npx tsc --noEmit`
- `openspec validate add-cli-engine-visibility-toggle --strict`
