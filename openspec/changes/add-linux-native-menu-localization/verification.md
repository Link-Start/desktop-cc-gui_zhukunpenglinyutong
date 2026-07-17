# Verification: add-linux-native-menu-localization

## Status

**NOT READY FOR ARCHIVE** — 4/5 tasks complete.

## Confirmed Evidence

- `MenuLabels` and saved-language construction are documented by completed implementation tasks.
- Proposal, design, tasks, and delta spec now define separate compile and Linux runtime gates.
- 2026-07-18: `cargo test --manifest-path src-tauri/Cargo.toml` exited 0. Rust unit/bin/integration/doc tests reported no failures.

## Outstanding Gates

- Launch Linux with a non-default saved language and verify the native menu is localized at startup, including terminal/devtools entries.

## Archive Decision

Structural validation alone is insufficient because GTK repaint behavior is the original defect boundary. Archive remains blocked on Linux evidence.
