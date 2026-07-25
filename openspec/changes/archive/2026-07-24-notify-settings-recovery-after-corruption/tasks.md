# Tasks: notify-settings-recovery-after-corruption

## 1. Backend Recovery Notice

- [x] 1.1 [P0, no dependency] `src-tauri/src/storage.rs`:`backup_corrupted_settings_file` 返回值改为 `Option<PathBuf>`(rename 成功返回备份路径;文件缺失/失败返回 None);quarantine 逻辑不变;适配两个既有单测并断言返回路径。
- [x] 1.2 [P0, no dependency] `src-tauri/src/shared/settings_core.rs`:新增 `SettingsRecoveryNotice`(camelCase serialize,`backup_file_name: Option<String>`)与 `take_settings_recovery_notice_core`(take 语义);新增 record-once / take-clears / empty 单测。
- [x] 1.3 [P0, depends on 1.1 and 1.2] `src-tauri/src/state.rs`:`AppState` 新增 `settings_recovery_notice` 字段,`load` 的 quarantine 分支记录 notice(含备份文件名,备份失败为 None);`src-tauri/src/settings/mod.rs` 新增 `take_settings_recovery_notice` command;`src-tauri/src/command_registry.rs` 注册;`daemon_state.rs` 调用点改 `let _ =`(行为不变)。

## 2. Frontend Notice Toast And i18n

- [x] 2.1 [P0, no dependency] `src/services/tauri/settings.ts` 新增 `SettingsRecoveryNotice` 类型与 `takeSettingsRecoveryNotice`;`src/services/tauri.ts` barrel 导出。
- [x] 2.2 [P0, depends on 2.1] `useAppSettings.ts` 成功路径调用 take command,有 notice 弹一次 toast(独立 try/catch,失败不影响加载);修正 `catch` 分支文案,删除"后端已备份为 .bak"错位表述。
- [x] 2.3 [P0, no dependency] i18n key 补进 `src/i18n/locales/zh/settings.ts` 与 `src/i18n/locales/en/settings.ts`(其余语言走 en fallback)。
- [x] 2.4 [P0, depends on 2.2] `useAppSettings.test.ts`:mock 新增 `takeSettingsRecoveryNotice`;新增"成功 + notice 弹一次 toast(含文件名)"、"成功 + null notice 不弹"、"notice 无文件名走备份失败文案"三个用例。

## 3. Verification And Archive

- [x] 3.1 [P0, depends on 1.3 and 2.4] 运行 `npm run typecheck`、focused Vitest(`useAppSettings`)、`cargo test --lib`、`cargo test --bin cc_gui_daemon`;输出全部通过或修复发现的问题。
- [x] 3.2 [P0, depends on 3.1] `openspec validate notify-settings-recovery-after-corruption --strict --no-interactive` 通过;记录 `verification.md`;sync `app-settings-corruption-recovery` 主 spec 并 archive,按规则补登 archive/README 条目与 Indexed 计数、移除 changes/README active 行。
