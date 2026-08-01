# Design: notify-settings-recovery-after-corruption

## 链路总览

```
AppState::load
  └─ read_settings 失败
       └─ backup_corrupted_settings_file → Option<PathBuf>(新增返回值)
       └─ 记录 SettingsRecoveryNotice { backup_file_name } → AppState.settings_recovery_notice
前端 useAppSettings 加载成功
  └─ invoke("take_settings_recovery_notice") → Option<SettingsRecoveryNotice>(take: 读取即清除)
       └─ Some(notice) → pushErrorToast(本地化文案,含备份文件名)
```

## 后端设计

### `storage.rs`:`backup_corrupted_settings_file` 返回值

签名由 `-> ()` 改为 `-> Option<PathBuf>`:rename 成功返回 `Some(backup_path)`,文件不存在或 rename 失败返回 `None`。quarantine 逻辑(rename 语义、`.corrupted-<UTC timestamp>.bak` 命名、`[storage]` 日志)完全不变。既有单测改为消费返回值并断言备份路径。

### `settings_core.rs`:notice 类型与 take core

```rust
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SettingsRecoveryNotice {
    pub(crate) backup_file_name: Option<String>,
}

pub(crate) async fn take_settings_recovery_notice_core(
    notice: &Mutex<Option<SettingsRecoveryNotice>>,
) -> Option<SettingsRecoveryNotice> {
    notice.lock().await.take()
}
```

放在 `settings_core.rs` 的原因:不依赖 `AppHandle`/`AppState`,可用纯 `Mutex` 单测 take 语义(record → take 一次拿到 → 再 take 为 None;空态 take 为 None),符合该文件"core 逻辑可单测、command 只做薄壳"的既有分层。

### `state.rs`:记录 notice

`AppState` 新增字段 `settings_recovery_notice: Mutex<Option<SettingsRecoveryNotice>>`。`load` 中:

```rust
let mut settings_recovery_notice = None;
let app_settings = read_settings(&settings_path).unwrap_or_else(|error| {
    let backup_path = backup_corrupted_settings_file(&settings_path, &error);
    settings_recovery_notice = Some(SettingsRecoveryNotice {
        backup_file_name: backup_path
            .as_ref()
            .and_then(|path| path.file_name())
            .map(|name| name.to_string_lossy().into_owned()),
    });
    AppSettings::default()
});
```

备份失败时 `backup_file_name` 为 `None`,notice 仍记录(前端走"备份失败"文案分支)。正常加载不产生 notice。

### `settings/mod.rs`:新 command

```rust
#[tauri::command]
pub(crate) async fn take_settings_recovery_notice(
    state: State<'_, AppState>,
) -> Result<Option<SettingsRecoveryNotice>, String> {
    Ok(take_settings_recovery_notice_core(&state.settings_recovery_notice).await)
}
```

注册到 `command_registry.rs` 的 `// Settings` 分组(`get_app_settings` 之后)。

### daemon 侧

`daemon_state.rs` 无 UI、不新增 notice;仅因 `backup_corrupted_settings_file` 返回值变为 `Option<PathBuf>`(must_use)把调用点改为 `let _ = ...;`,行为零变化。

## 前端设计

### `services/tauri/settings.ts`

```ts
export interface SettingsRecoveryNotice {
  backupFileName: string | null;
}

export async function takeSettingsRecoveryNotice(): Promise<SettingsRecoveryNotice | null> {
  return invoke<SettingsRecoveryNotice | null>("take_settings_recovery_notice");
}
```

经 `services/tauri.ts` barrel 导出(与 `getAppSettings` 同一 export 行 + type export 行)。

### `useAppSettings.ts`

成功路径(`getAppSettings` resolve 后)追加一次 notice 拉取:

- 独立 `try/catch` 包裹:notice 拉取失败只 `console.error`,绝不影响设置加载主流程;
- `notice` 非空才 `pushErrorToast`;`backupFileName` 为 null 时走 `settingsRecoveredNoBackupMessage` 文案;
- take 语义保证即使 hook 被多次挂载也只弹一次(第二次 take 返回 null)。

`catch` 分支(invoke 失败)保留 toast,但文案改为只描述"读取失败、临时使用默认设置",删除"后端已备份为 .bak"的错位表述,与 quarantine 场景文案区分。

### i18n key(补进 zh + en;其余语言按 `src/i18n/index.ts` fallback chain 走 en)

| key | zh | en |
|---|---|---|
| `settings.settingsRecoveredTitle` | 设置已恢复 | Settings recovered |
| `settings.settingsRecoveredMessage` | 设置文件已损坏,原文件已备份为 {{backupFileName}},已回退到默认设置。 | The settings file was corrupted. The original file was backed up as {{backupFileName}} and default settings have been restored. |
| `settings.settingsRecoveredNoBackupMessage` | 设置文件已损坏且自动备份失败,已回退到默认设置。 | The settings file was corrupted and could not be backed up. Default settings have been restored. |
| `settings.appSettingsLoadFailedTitle` | 设置加载失败 | Failed to load settings |
| `settings.appSettingsLoadFailedMessage` | 无法从后端读取应用设置,已临时使用默认设置。请检查客户端与后端的连接状态。 | Could not read app settings from the backend; default settings are in use for now. Check the client-backend connection. |

## 测试设计

### Rust(`settings_core.rs` test module)

- `take_settings_recovery_notice_core_returns_once_then_clears`:写入 notice → 第一次 take 得到含文件名的 notice → 第二次 take 为 None。
- `take_settings_recovery_notice_core_empty_when_no_notice`:空态 take 为 None。

### Rust(`storage.rs` 既有测试适配)

- `backup_corrupted_settings_file_preserves_original_before_default_fallback`:消费返回的 `Some(path)`,断言与目录扫描到的 `.bak` 一致。
- `backup_corrupted_settings_file_is_noop_for_missing_file`:断言返回 `None`。

### Vitest(`useAppSettings.test.ts`)

- mock 增加 `takeSettingsRecoveryNotice`,`beforeEach` 默认 `mockResolvedValue(null)`(避免用例间泄漏)。
- 新用例 1:加载成功 + notice 含 `backupFileName` → `pushErrorToast` 恰好一次,message 含备份文件名。
- 新用例 2:加载成功 + notice 为 null → 不弹 toast。
- 新用例 3:notice 的 `backupFileName` 为 null → 弹"备份失败"文案分支(toast 一次、message 非空字符串)。
- 既有 `catch` 用例不受影响(reject 路径不调用 take command)。

## 验证命令

```bash
npm run typecheck
npx vitest run src/features/settings/hooks/useAppSettings.test.ts
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo test --manifest-path src-tauri/Cargo.toml --bin cc_gui_daemon
openspec validate notify-settings-recovery-after-corruption --strict --no-interactive
```
