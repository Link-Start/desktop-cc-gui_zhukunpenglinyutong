## Verification Summary

本 change 已完成 frontend ↔ Rust shortcut persistence contract、常用模块 metadata projection 与 AppShell action wiring，并通过 focused verification。

## Automated Evidence

- Frontend focused Vitest：
  - `useModuleViewShortcuts.test.tsx`
  - `useAppShellLayoutNodesSection.test.ts`
  - `ShortcutsSection.test.tsx`
  - `SettingsView.test.tsx -t "SettingsView Shortcuts"`
- Rust：`cargo test app_settings_round_trips_all_frontend_shortcut_fields --manifest-path src-tauri/Cargo.toml` 通过。
- scoped ESLint：通过。
- `pnpm typecheck`：通过。
- `pnpm run check:runtime-contracts`：通过。
- `openspec validate fix-shortcut-persistence-and-add-common-modules --strict --no-interactive`：通过。
- `git diff --check`：通过。

## Baseline Note

完整 `SettingsView.test.tsx` 当前存在一个与本 change 无关的既有失败：`persists client UI visibility panel and control toggles`。当前 HEAD 的 `BasicAppearanceSection` 已通过 `{false && (...)}` 隐藏该面板，本 change 未修改该组件；快捷键相关 `SettingsView Shortcuts` 用例单独验证。

## Scope

未运行全量 tests。未新增 dependency，旧 settings JSON 通过 serde defaults 保持 backward compatibility。
