## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal/design/spec delta for removing the manual `/compact` 120s wall-clock cap; output: change artifacts under `openspec/changes/fix-claude-manual-compact-wall-clock-cap`; validation: `openspec validate fix-claude-manual-compact-wall-clock-cap --strict --no-interactive`. [P0][I][O: change dir][V: openspec validate]

## 2. Runtime Fix

- [x] 2.1 Remove the `timeout()` wrapper, the `CLAUDE_MANUAL_COMPACT_TIMEOUT_SECS` const, and the false-timeout error mapping in `src-tauri/src/codex/mod.rs::compact_claude_thread`, awaiting `session.send_message` directly; output: no wall-clock cap on the Tauri manual-compact path; validation: `cargo test`. [P0][depends: 1.1][I][O: codex/mod.rs][V: cargo test]
- [x] 2.2 Apply the identical removal in `src-tauri/src/bin/cc_gui_daemon/runtime_helpers.rs` and drop the now-unused `timeout` import; output: no wall-clock cap on the daemon manual-compact path and no orphaned import; validation: `cargo test`. [P0][depends: 1.1][I][O: runtime_helpers.rs][V: cargo test]

## 3. Verification

- [x] 3.1 Run repository gates; output: no Rust or TypeScript regressions and no dead-import warnings; validation: `cargo test`, `npm run lint`, `npm run typecheck`. [P0][depends: 2.1, 2.2][V: cargo test && npm run lint && npm run typecheck]
