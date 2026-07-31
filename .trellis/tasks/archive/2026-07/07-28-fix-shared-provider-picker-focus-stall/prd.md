# Fix Shared Provider Picker Focus Stall

## OpenSpec

- Change: `fix-shared-provider-picker-focus-stall`

## Goal

删除 Shared picker 与 Radix 竞争的 controlled submenu state；连续 Provider accordion
interaction 不失焦、不冻结，Model selection 与 Native path 保持不变。

## Validation

- Shared pointer/focus regression test
- Native and terminal selection regression suites
- Typecheck, lint, runtime contracts, strict OpenSpec validation
