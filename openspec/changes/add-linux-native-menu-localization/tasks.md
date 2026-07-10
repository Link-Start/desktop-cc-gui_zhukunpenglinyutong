## 1. OpenSpec Artifacts

- [x] 1.1 Author proposal + spec delta + tasks for native menu localization; output: `openspec/changes/add-linux-native-menu-localization`; validation: `openspec validate add-linux-native-menu-localization --strict --no-interactive`. [P0][I][O: change dir][V: openspec validate]

## 2. Rust menu (menu.rs)

- [x] 2.1 Add `MenuLabels` struct covering all menu item strings, with per-language constructors (zh/en) whose keys mirror `src/i18n/locales/*/menu`. [P0][I][O: menu.rs][V: cargo (F4)]
- [x] 2.2 Build every menu item from `labels.*` (incl. terminal/devtools, previously hardcoded); select the label set from the saved language. [P0][I][O: menu.rs][V: cargo (F4)]

## 3. Gates

- [ ] 3.1 `cargo test` / `cargo check` (app closed) — DEFERRED to freeze window F4 (no local rebuilds during freeze). Conflict resolution vs v0.6.7 verified textually (struct fields + both constructors present). [P0][V: cargo]
- [ ] 3.2 Manual: launch with a non-default saved language on Linux; menu bar is localized at startup — DEFERRED to F4. [P1][V: manual]
