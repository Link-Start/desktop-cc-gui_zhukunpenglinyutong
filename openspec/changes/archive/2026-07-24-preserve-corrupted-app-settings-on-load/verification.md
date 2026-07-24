# Verification: preserve-corrupted-app-settings-on-load

- Date: 2026-07-24
- Branch: `feature/v-078`
- Scope: `settings.json` 损坏时的 backend 隔离备份 + frontend 加载失败可见性，以及正常路径归一不回归。

## 1. 实现摘要

- Backend：`src-tauri/src/storage.rs` 新增 `backup_corrupted_settings_file(path, error)`，将损坏文件 rename 为 `settings.json.corrupted-<UTC %Y%m%dT%H%M%SZ>.bak`（timestamp 模式复用 `project_map_relations.rs` backup 先例），并输出 `[storage]` 日志；rename 失败时仅日志告警、仍回退默认。
- 两处调用点改为 `unwrap_or_else`：`src-tauri/src/state.rs`（GUI `AppState::load`）与 `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`（daemon `DaemonState::load`）；`load()` 内其他初始化语句未触碰。
- Frontend：`useAppSettings.ts` 加载 `catch` 分支新增 `console.error` + `pushErrorToast`（复用 `src/services/toasts.ts`；文案 `i18n.t(..., { defaultValue })` 并带 `||` 兜底，未新增 locale key）。

## 2. 自动化证据

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| TypeScript typecheck | `npm run typecheck` | 通过（exit 0）。注：验证期间工作区曾有其他代理未提交改动导致 `SettingsView.tsx` TS6133 报错，与本 change 无关，其修复后全量 typecheck 通过 |
| ESLint（改动文件） | `npx eslint src/features/settings/hooks/useAppSettings.ts src/features/settings/hooks/useAppSettings.test.ts` | 通过，无告警 |
| Frontend focused Vitest | `npx vitest run src/features/settings/hooks/useAppSettings.test.ts` | 30/30 通过，含新增 `surfaces a toast and keeps defaults when loading settings fails` |
| Rust storage 单测 | `cargo test --manifest-path src-tauri/Cargo.toml --lib storage` | 26/26 通过，含新增 `backup_corrupted_settings_file_preserves_original_before_default_fallback`（备份保留原字节、随后 `write_settings` 写新文件不破坏备份）与 `backup_corrupted_settings_file_is_noop_for_missing_file` |
| Rust daemon state 测试 | `cargo test --manifest-path src-tauri/Cargo.toml --bin cc_gui_daemon daemon_state` | 9/9 通过 |
| Bin 编译 | `cargo check --manifest-path src-tauri/Cargo.toml --bins` | 通过；`cc_gui` 与 `cc_gui_daemon` 均编译成功，仅有预存 warning（`codex/installer.rs`、`engine/manager.rs`，与本 change 无关） |
| rustfmt | `cargo fmt -- --check`（storage.rs 范围） | 本 change 改动行已格式化；仓库其他文件存在预存 fmt diff，未触碰 |
| OpenSpec strict | `openspec validate preserve-corrupted-app-settings-on-load --strict --no-interactive` | 通过 |

## 3. 正常路径归一不回归（与 stabilize-client-runtime-and-diagnostics 的语义邻接核对）

- `read_settings` 函数体未改动，成功路径的 `normalize_unified_exec_policy` / `upgrade_runtime_pool_settings_for_startup` / `upgrade_curated_skill_defaults_for_startup` / `sanitize_engine_gates` 调用顺序与原逻辑完全一致；备份 helper 只在 `Err` 分支触发。
- Frontend `normalizeAppSettings` 未改动；focused suite 中 `keeps legacy Gemini enablement disabled`（legacy `geminiEnabled: true` 归一为 disabled）与 `upgrades legacy warm ttl to the current startup default when loading` 等归一用例全部通过（30/30）。
- Rust 侧 `read_settings_sanitizes_runtime_pool_budget_fields`、`read_settings_upgrades_legacy_warm_ttl_to_startup_default`、`read_settings_migrates_caveman_default_once_and_preserves_opt_out` 全部通过（26/26 含于 storage filter）。

## 4. 邻近发现（不在本 change 修复）

- `read_workspaces(&storage_path).unwrap_or_default()`（`state.rs` 与 `daemon_state.rs` 各一处）对 `workspaces.json` 存在同类静默回退 + 覆盖写回风险；建议后续单开 change 处理。
- `npm run test`（全量 batched suite）未在本 change 运行；按仓库惯例仅运行 focused suite。`stabilize-client-runtime-and-diagnostics/verification.md` 记录了全量 suite 存在 4 个预存 failing 文件，与本 change 无关。
