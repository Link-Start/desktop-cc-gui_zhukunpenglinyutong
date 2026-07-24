## 1. Backend Corruption Backup

- [x] 1.1 [P0, no dependency] 在 `src-tauri/src/storage.rs` 新增 `backup_corrupted_settings_file(path, error)` helper：输入损坏的 `settings.json` 路径与错误；输出原文件被 rename 为 `<file>.corrupted-<UTC timestamp>.bak` 并输出 `[storage]` 日志；使用 storage.rs 既有单测模式验证备份成功与文件保留。
- [x] 1.2 [P0, depends on 1.1] 将 `src-tauri/src/state.rs` 与 `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs` 两处 `read_settings(&settings_path).unwrap_or_default()` 改为 `unwrap_or_else`：失败时先调用备份 helper 再回退 `AppSettings::default()`；只动调用点及紧邻 import 行；使用 `cargo test`（storage + daemon 编译）验证。

## 2. Frontend Load Failure Visibility

- [x] 2.1 [P0, no dependency] 在 `useAppSettings.ts` 加载 `catch` 分支补 `console.error` 日志与 `pushErrorToast`（复用 `src/services/toasts.ts`，文案走 `i18n.t(..., { defaultValue })`）；输出加载失败可见；在 `useAppSettings.test.ts` 新增 reject 用例验证 defaults 保持、`isLoading` 收敛、toast 被调用。

## 3. Verification And Contract Sync

- [x] 3.1 [P0, depends on 1.2 and 2.1] 运行 `npm run typecheck`、focused Vitest（`useAppSettings`）、`cargo test --manifest-path src-tauri/Cargo.toml`（storage / daemon 相关 test filter）与 `npx eslint`（改动文件）；输出全部通过或修复发现的问题。
- [x] 3.2 [P0, depends on 3.1] 验证正常（未损坏）路径归一行为不回归：跑 `useAppSettings` 全套 focused tests（含 `keeps legacy Gemini enablement disabled`）与 `storage.rs` 归一单测，确认与 `stabilize-client-runtime-and-diagnostics` 的 Gemini settings 归一语义兼容；记录在 `verification.md`。
- [x] 3.3 [P1, depends on 3.2] 运行 `openspec validate preserve-corrupted-app-settings-on-load --strict --no-interactive` 并核对实现与 `app-settings-corruption-recovery` scenarios；输出 strict validation 通过后 sync 主 specs 并 archive。
