## 1. OpenSpec Artifacts

- [x] 1.1 Author proposal + spec delta + tasks for native menu localization; output: `openspec/changes/add-linux-native-menu-localization`; validation: `openspec validate add-linux-native-menu-localization --strict --no-interactive`. [P0][I][O: change dir][V: openspec validate]

## 2. Rust menu (menu.rs)

- [x] 2.1 Add `MenuLabels` struct covering all menu item strings, with per-language constructors (zh/en) whose keys mirror `src/i18n/locales/*/menu`. [P0][I][O: menu.rs][V: cargo (F4)]
- [x] 2.2 Build every menu item from `labels.*` (incl. terminal/devtools, previously hardcoded); select the label set from the saved language. [P0][I][O: menu.rs][V: cargo (F4)]

## 3. Gates

- [x] 3.1 `cargo test --manifest-path src-tauri/Cargo.toml` passed on 2026-07-18; compile/test gate is no longer deferred. [P0][V: cargo]
- [ ] 3.2 Launch Linux with a non-default saved language and verify the native menu is localized at startup. This is the original GTK defect boundary and cannot be claimed from the current macOS test environment. [P1][V: Linux smoke]
