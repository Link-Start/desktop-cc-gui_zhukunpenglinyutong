# Verification: notify-settings-recovery-after-corruption

日期:2026-07-24。所有命令在仓库根或 `src-tauri/` 下执行。

## 自动化验证结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过,无输出错误 |
| `npx eslint`(8 个改动前端文件) | 通过,无 warning |
| `npx vitest run src/features/settings/hooks/useAppSettings.test.ts` | 34/34 通过(含 4 个新增/扩展用例) |
| `npx vitest run`(app-shell.startup / DetachedSpecHubWindow / DetachedFileExplorerWindow / ClientDocumentationWindow 4 个间接消费方) | 25/25 通过 |
| `cargo test --lib` | 1535 通过 / 2 失败 |
| `cargo test --bin cc_gui_daemon` | 948 通过 / 2 失败 |
| `openspec validate notify-settings-recovery-after-corruption --strict --no-interactive` | 通过 |

## 预存失败说明(非本次引入)

`runtime::tests::replace_workspace_session_with_source_marks_old_session_shutdown_source` 与 `runtime::tests::replacement_waiter_does_not_swap_in_a_third_runtime` 在 lib 与 daemon bin 中均失败。已在 `git stash` 后的干净工作树上复跑同样失败,确认为预存问题,与本次改动无关(改动不涉及 `runtime.rs`)。仅记录,不在本 change 修复。

## 场景核对

- `quarantine records a notice with the backup file name`:`storage.rs` 单测断言 quarantine 返回的备份路径与磁盘 `.bak` 一致;`settings_core.rs` 单测 `take_settings_recovery_notice_core_returns_notice_once_then_clears` 验证 notice 含文件名、take 一次后清除。
- `clean startup leaves no notice`:`take_settings_recovery_notice_core_returns_none_when_no_notice`。
- `successful load with a pending notice surfaces one toast`:Vitest `surfaces exactly one recovery toast when load succeeds with a quarantine notice`,断言 toast 恰好一次且 message 含 `settings.json.corrupted-20260724T000000Z.bak`。
- `successful load without a notice stays silent`:Vitest `stays silent when load succeeds without a recovery notice`。
- `notice fetch failure does not break the load`:Vitest `keeps loaded settings when the recovery notice fetch itself fails`。
- `invoke-failure copy does not claim a backup`:Vitest 在 catch 用例中断言 message 不含 `.bak`,且 reject 路径不调用 take command。
- i18n:5 个 key 已补进 `zh` / `en` settings bundle;其余语言按 `src/i18n/index.ts` fallback chain 走 en。

## 手工 gate

无手工 gate:链路为启动期一次性事件,核心行为(take 语义、toast 一次性、文案归属)均有自动化覆盖。
