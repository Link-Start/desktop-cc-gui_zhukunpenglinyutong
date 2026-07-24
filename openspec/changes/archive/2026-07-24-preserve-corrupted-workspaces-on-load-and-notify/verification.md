# Verification: preserve-corrupted-workspaces-on-load-and-notify

日期:2026-07-24。所有命令在仓库根或 `src-tauri/` 下执行。

## 自动化验证结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过,无输出错误 |
| `npx eslint`(6 个改动前端文件) | 通过,无 warning |
| `npx vitest run src/features/workspaces/hooks/useWorkspaces.test.tsx` | 15/15 通过(含 4 个新增用例) |
| `npx vitest run src/features/settings/hooks/useAppSettings.test.ts` | 34/34 通过(回归,无变化) |
| `cargo test --lib` | 1538 通过 / 2 失败 |
| `cargo test --bin cc_gui_daemon` | 951 通过 / 2 失败 |
| `cargo check --all-targets` | 通过(仅预存 dead_code 警告,见下) |
| `openspec validate preserve-corrupted-workspaces-on-load-and-notify --strict --no-interactive` | 通过 |

## 预存失败说明(非本次引入)

`runtime::tests::replace_workspace_session_with_source_marks_old_session_shutdown_source` 与 `runtime::tests::replacement_waiter_does_not_swap_in_a_third_runtime` 在 lib 与 daemon bin 中均失败,与上一轮 `notify-settings-recovery-after-corruption` verification 记录完全一致(进程组测试在本机沙箱确定性失败)。本次改动不涉及 `runtime.rs`,仅记录,不在本 change 修复。

`cargo check --all-targets` 报告的 dead_code 警告(`remove_kimi_session`、`active_process_ids`)位于 engine/runtime 模块,与本次改动文件无关,属预存警告。

## 场景核对

- `corrupted workspaces file is quarantined before default fallback`:`storage.rs` 单测 `backup_corrupted_file_preserves_corrupted_workspaces_before_default_fallback` 断言原字节保留、备份路径与磁盘 `.bak` 一致、后续 `write_workspaces` 不破坏备份。
- `missing workspaces file keeps first-run behavior`:`backup_corrupted_file_is_noop_for_missing_file`(改名后沿用)。
- `quarantine records a notice with the backup file name`:`settings_core.rs` 单测 `take_workspaces_recovery_notice_core_returns_notice_once_then_clears`。
- `clean startup leaves no notice`:`take_workspaces_recovery_notice_core_returns_none_when_no_notice`。
- `startup with a pending notice surfaces one toast`:Vitest `surfaces exactly one recovery toast when startup holds a quarantine notice`,断言 toast 恰好一次且 message 含 `workspaces.json.corrupted-20260724T000000Z.bak`。
- `startup without a notice stays silent`:Vitest `stays silent when startup holds no recovery notice`。
- `notice fetch failure does not break workspace loading`:Vitest `keeps loading workspaces when the recovery notice fetch itself fails`。
- `valid workspaces file still reads unchanged`:既有 storage 单测(dedupe / merge / writeback-failure)全部保持绿色,未修改其断言。
- i18n:3 个 key 已补进 `zh` / `en` workspace bundle;其余语言按 `src/i18n/index.ts` fallback chain 走 en。

## 既有契约回归

- settings 链路:`backup_corrupted_settings_file` → `backup_corrupted_file` 改名后,settings 两处既有单测(原名改名)与 `useAppSettings.test.ts` 34/34 全绿;`take_settings_recovery_notice` 契约未动。
- daemon:`DaemonState::load` workspaces 分支仅 quarantine 不记 notice(无 UI surface),与 settings 行为对齐。

## 手工 gate

无手工 gate:链路为启动期一次性事件,核心行为(quarantine 保留原字节、take 语义、toast 一次性、文案归属)均有自动化覆盖。
