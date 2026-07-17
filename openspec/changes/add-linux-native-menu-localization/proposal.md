## Why

The native menu bar is built in Rust (`menu.rs`) and cannot reach the React
i18next layer, so its labels were written in a single language. On Linux the
runtime relabel path (`menu_update_labels`) does not reliably repaint the GTK
menubar (a muda/GTK limitation), so a non-default-language user saw a menu that
never localized. The fix is to build the menu in the saved language up front.

## 2026-07-18 代码校准

- **裁定：继续推进（仅剩 Linux platform gate）**。`MenuLabels`、zh/en constructors、saved-language selection 与 terminal/devtools labels 已存在于 `src-tauri/src/menu.rs`。
- 2026-07-18 `cargo test --manifest-path src-tauri/Cargo.toml` 通过，Rust compile/test gate 已关闭。
- 原缺陷边界是 Linux GTK native menubar；当前 macOS 环境无法用 unit test 证明 GTK 首次构建的可见结果。保留一次 Linux non-default-language startup smoke，不再保留模糊的 “freeze window F4” 时间语境。
- 若近期没有 Linux release/testing channel，可按产品支持策略显式 waiver 后归档；不得声称已经完成 Linux runtime verification。

## 目标与边界

- Source native menu labels from a Rust-side mirror of the `menu.*` i18n keys,
  selected by the saved UI language, so the menu is localized at build time.
- Fix Linux specifically: build-in-language instead of depending on a runtime
  GTK relabel that doesn't repaint.
- Keep adding a locale cheap: one label-set constructor, no change to the build
  path.

## 非目标

- Do not move menu construction out of Rust or wire it to i18next at runtime.
- Do not change the frontend i18n keys themselves — the Rust mirror tracks the
  existing `menu.*` keys.
- No behavior change on macOS beyond also sourcing labels from the mirror (its
  runtime relabel already worked).

## What Changes

- `src-tauri/src/menu.rs`: introduce a `MenuLabels` struct (all menu item
  strings) with a per-language constructor; build every `MenuItemBuilder` from
  `labels.*` instead of hardcoded strings; select the label set from the saved
  language. Terminal / devtools items are localized too (previously hardcoded).

## Spec deltas

- `linux-native-menu-localization` (new capability): **ADDED** — the native menu
  MUST be built in the saved UI language, with a Linux build-in-language
  requirement and a one-constructor-per-locale requirement.
