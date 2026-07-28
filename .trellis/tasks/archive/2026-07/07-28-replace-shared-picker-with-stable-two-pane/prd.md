# Replace Shared Picker With Stable Two Pane

## OpenSpec

- Change: `replace-shared-picker-with-stable-two-pane`

## Goal

删除 Shared target picker 的 nested Radix submenu。CLI 与 Provider/Model 使用同一
root menu 双栏展示，从结构上消除失焦与卡顿。

## Validation

- Shared single-root/two-pane focused tests
- Native and legacy model group regression
- Typecheck, lint, runtime contracts, strict OpenSpec
- `src-tauri/target/debug/cc-gui` 实机点验
