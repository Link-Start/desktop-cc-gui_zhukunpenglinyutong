# Fix Shared Provider Picker Accordion Focus

## OpenSpec

- Change: `fix-shared-provider-picker-accordion-focus`

## Goal

Shared Session 的 CLI submenu 内点击 Provider Profile accordion 时保持 root/submenu 打开，
同时维持 Provider model list 互斥折叠和 terminal model selection 行为。

## Scope

- `ModelSelect.tsx`
- `ModelSelect.test.tsx`
- `composer-control-surface` behavior spec

## Validation

- Focused Vitest
- TypeScript typecheck
- ESLint
- Runtime contracts
- OpenSpec strict validation
