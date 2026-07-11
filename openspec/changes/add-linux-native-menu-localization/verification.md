# Verification: add-linux-native-menu-localization

## Status

**NOT READY FOR ARCHIVE** — 3/5 tasks complete.

## Confirmed Evidence

- `MenuLabels` and saved-language construction are documented by completed implementation tasks.
- Proposal, design, tasks, and delta spec now define separate compile and Linux runtime gates.

## Outstanding Gates

- Run `cargo check` and relevant Rust tests with the app closed.
- Launch Linux with a non-default saved language and verify the native menu is localized at startup, including terminal/devtools entries.

## Archive Decision

Structural validation alone is insufficient because GTK repaint behavior is the original defect boundary. Archive remains blocked on Linux evidence.

