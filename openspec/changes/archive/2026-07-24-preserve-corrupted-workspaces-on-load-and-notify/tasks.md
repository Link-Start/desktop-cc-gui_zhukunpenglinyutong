# Tasks: preserve-corrupted-workspaces-on-load-and-notify

## 1. Backend Corrupted Workspaces Quarantine

- [x] 1.1 [P0, no dependency] `src-tauri/src/storage.rs`：`backup_corrupted_settings_file` 泛化改名为 `backup_corrupted_file`（日志标签与 fallback 文件名从 `path.file_name()` 派生，rename 行为与返回值契约不变）；两个既有单测同步改名；新增 workspaces 变体单测（备份保留原字节、后续 `write_workspaces` 不破坏备份）。验证：`cargo test --lib storage` 通过。
- [x] 1.2 [P0, depends on 1.1] `src-tauri/src/state.rs` 与 `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`：`read_workspaces(...).unwrap_or_default()` 改 `unwrap_or_else`，parse 失败先 `backup_corrupted_file` 再回退 `HashMap::default()`；`src-tauri/src/bin/cc_gui_daemon.rs` 与 settings 两处调用点 import 同步改名。只动调用点及紧邻行。验证：`cargo build` 通过。

## 2. Backend Recovery Notice

- [x] 2.1 [P0, no dependency] `src-tauri/src/shared/settings_core.rs`：新增 `WorkspacesRecoveryNotice`（camelCase serialize，`backup_file_name: Option<String>`）与 `take_workspaces_recovery_notice_core`（take 语义）；新增 record-once / take-clears / empty 单测。验证：`cargo test --lib settings_core` 通过。
- [x] 2.2 [P0, depends on 1.2 and 2.1] `src-tauri/src/state.rs`：`AppState` 新增 `workspaces_recovery_notice` 字段，`load` 的 quarantine 分支记录 notice（含备份文件名，备份失败为 None）；`src-tauri/src/workspaces/commands.rs` 新增 `take_workspaces_recovery_notice` command；`src-tauri/src/command_registry.rs` 注册；`src-tauri/src/git/commands_branch.rs` 与 `src-tauri/src/git/pull_request_content.rs` 测试构造器补新字段；daemon 调用点保持 quarantine-only 不记 notice。验证：`cargo test --lib` 与 `cargo test --bin cc_gui_daemon` 编译通过。

## 3. Frontend Notice Toast And i18n

- [x] 3.1 [P0, no dependency] `src/services/tauri/workspaceConfig.ts` 新增 `WorkspacesRecoveryNotice` 类型与 `takeWorkspacesRecoveryNotice`；`src/services/tauri.ts` barrel 导出。验证：`npm run typecheck` 通过。
- [x] 3.2 [P0, depends on 3.1] `src/features/workspaces/hooks/useWorkspaces.ts` 挂载后调用 take command，有 notice 弹一次 `pushErrorToast`（独立 try/catch + active flag，失败不影响 workspace 加载）。验证：focused Vitest 通过。
- [x] 3.3 [P0, no dependency] i18n key 补进 `src/i18n/locales/zh/workspace.ts` 与 `src/i18n/locales/en/workspace.ts`（`workspacesRecoveredTitle` / `workspacesRecoveredMessage` / `workspacesRecoveredNoBackupMessage`，其余语言走 en fallback）。验证：`npm run typecheck` 通过。
- [x] 3.4 [P0, depends on 3.2] `useWorkspaces.test.tsx`：mock 新增 `takeWorkspacesRecoveryNotice` 与 `pushErrorToast`；新增"有 notice 弹一次 toast（含文件名）"、"null notice 不弹"、"无文件名走备份失败文案"、"notice 拉取失败不影响加载"四个用例。验证：focused Vitest 通过。

## 4. Verification And Archive

- [x] 4.1 [P0, depends on 2.2 and 3.4] 运行 `npm run typecheck`、`npx eslint`（改动前端文件）、focused Vitest（`useWorkspaces` + `useAppSettings`）、`cargo test --lib`、`cargo test --bin cc_gui_daemon`；输出全部通过或修复发现的问题（`runtime::tests` 两个预存沙箱失败仅记录）。
- [x] 4.2 [P0, depends on 4.1] `openspec validate preserve-corrupted-workspaces-on-load-and-notify --strict --no-interactive` 通过；记录 `verification.md`；sync 新主 spec `workspaces-corruption-recovery` 并 archive；按规则补登 archive/README 条目与 Indexed 计数、changes/README Archived 计数、specs/README 注册新 spec、config.yaml 与 project.md 计数（全部以实测为准）；归档后跑 `openspec validate --all --strict --no-interactive`（`add-tokentracker-usage-dashboard` 预存 strict 失败除外，不动它）。
