## Context

Native menu construction lives in Rust and cannot consume the React i18next runtime. Linux GTK/muda does not reliably repaint labels after `menu_update_labels`, so startup construction language is the authoritative path.

## Goals / Non-Goals

- Goal: build every native menu item from the saved UI language before the menu is attached.
- Goal: keep the Rust label mirror auditable against the existing `menu.*` locale keys.
- Non-goal: introduce a Rust-to-React i18n bridge or promise live GTK relabeling.
- Non-goal: change menu commands, accelerators, visibility, or platform behavior.

## Decisions

### Decision: use one typed Rust label set per locale

`MenuLabels` is the single construction contract. Each supported locale provides one constructor containing the complete label set; menu builders consume fields rather than inline literals.

### Decision: saved language is resolved before menu construction

Startup uses the persisted UI language. Linux may require restart after a language change because runtime relabeling is not an authoritative repaint mechanism.

### Decision: validation has two independent gates

Rust compile/test proves the label contract is structurally complete. A Linux startup smoke test with a non-default saved language proves GTK renders the intended labels. Neither gate substitutes for the other.

## Risks / Trade-offs

- The Rust mirror can drift from frontend locale keys. Review must compare all `menu.*` labels when locales change.
- Build-time localization favors predictable startup behavior over instant Linux language switching.
- Platform smoke evidence is required because macOS success does not prove GTK behavior.

## Verification

1. Run `cargo check` and relevant Rust tests with the app closed.
2. Persist a non-default language, launch on Linux, and verify all native menu groups and terminal/devtools labels.
3. Run `openspec validate add-linux-native-menu-localization --strict --no-interactive`.

