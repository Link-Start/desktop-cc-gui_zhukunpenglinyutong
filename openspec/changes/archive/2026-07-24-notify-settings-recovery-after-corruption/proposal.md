# Proposal: notify-settings-recovery-after-corruption

## 背景与问题

上一轮 change `preserve-corrupted-app-settings-on-load`(已归档)完成了 settings.json 损坏时的后端 quarantine:`AppState::load` 先 `backup_corrupted_settings_file` 把损坏文件 rename 为 `settings.json.corrupted-<UTC timestamp>.bak`,再回退 `AppSettings::default()`;前端 `useAppSettings` 的 `catch` 分支加了 `pushErrorToast`。

但 review 发现主路径没有闭环:

1. quarantine 发生在启动期(`AppState::load`),之后 `get_app_settings` command 从内存态直接返回 `Ok(默认值)`。真实损坏场景下前端 `getAppSettings()` **永远 resolve 成功**,`catch` 分支的 toast 一次都不会弹——"用户无法感知设置损坏"的核心痛点依然存在。
2. toast 的 i18n key(`settings.appSettingsLoadFailedTitle/Message`)没进任何 locale 文件,非中文界面会弹出中文 `defaultValue` 文案。
3. `catch` 分支文案写"后端已将其备份为 .bak",但该分支的实际触发场景是 invoke 失败(此时后端并未备份),文案与场景错位。

## 目标

打通"后端 quarantine → 前端用户可见提示"链路,让用户在设置文件被损坏隔离后确切知道发生了什么、原文件备份到哪:

- 后端(app 侧)quarantine 时记录一条 recovery notice(含备份文件名;备份失败时为 null);
- 新增 `take_settings_recovery_notice` tauri command(take 语义:读取一次后清除),前端加载成功后调用一次;
- 前端有 notice 则弹一次本地化 toast;修正 `catch` 分支文案与 i18n key 缺失问题。

## 非目标(Non-goals)

- 不改 `get_app_settings` 的返回契约:它直接返回 `AppSettings`,把 recovery 信号塞进返回类型是 breaking change(前端 `normalizeAppSettings`、daemon `get_app_settings_core`、remote backend 转发都依赖现有形状)。
- 不改 daemon 侧行为:`DaemonState` 无 UI,quarantine 本身已在 daemon 生效,不新增 notice 记录。
- 不改 `backup_corrupted_settings_file` 的 quarantine 逻辑(rename 语义、命名、日志);仅为 notice 记录补充返回值。
- 不做设置文件的自动恢复/合并 UI;notice 只负责告知。

## 关键决策

### 为什么用 take 语义的一次性 command

- quarantine 只在启动期发生一次,notice 是"启动事件"而非持续状态;`take`(读取即清除)保证 toast 只弹一次,避免 React StrictMode 双调用、`useAppSettings` 多实例或窗口刷新造成的重复弹窗。
- 轮询/订阅式(event emit)方案对一次性事件过重,且窗口加载时序上 event 可能早于前端 listener 注册而丢失;command 拉取不存在时序窗口。

### 为什么不动 `get_app_settings` 返回契约

`get_app_settings` 返回 `AppSettings` 本体,被 `useAppSettings`、daemon `DaemonState::get_app_settings`、remote backend 透传等多方消费。加一个 `recovered: bool` / 包装成 `{ settings, notice }` 都要同步改全部消费方,是 breaking change;独立 command 则零侵入。

### 为什么 notice 记录放在 AppState 而非持久化

notice 只需存活"启动 → 前端首次加载"这一段;落盘会引入清理与陈旧数据问题。进程重启时新的 quarantine 会产生新的 notice,旧的已在上一进程生命周期内被 take 或随进程消失。

## 影响面

- 后端:`src-tauri/src/storage.rs`(返回值)、`src-tauri/src/state.rs`(notice 字段)、`src-tauri/src/shared/settings_core.rs`(notice 类型 + take core + 单测)、`src-tauri/src/settings/mod.rs`(新 command)、`src-tauri/src/command_registry.rs`(注册)、`src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`(仅适配返回值签名,行为不变)。
- 前端:`src/services/tauri/settings.ts`、`src/services/tauri.ts`、`src/features/settings/hooks/useAppSettings.ts`、`src/features/settings/hooks/useAppSettings.test.ts`、`src/i18n/locales/zh/settings.ts`、`src/i18n/locales/en/settings.ts`(其余语言走 en fallback,参照 `src/i18n/index.ts` 既有 fallback chain)。
- capability spec:`app-settings-corruption-recovery`(MODIFIED 一条既有 requirement + ADDED 两条新 requirement)。
