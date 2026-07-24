## Why

当 `settings.json` 内容损坏（JSON parse 失败或读取失败）时，当前加载链路在所有层级都是静默回退：

- 前端 `src/features/settings/hooks/useAppSettings.ts` 的加载 `catch` 分支为空，无日志、无用户可见提示，用户无法感知设置已回退为默认值。
- 后端 `src-tauri/src/state.rs`（GUI `AppState::load`）与 `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`（daemon `DaemonState::load`）均使用 `read_settings(&settings_path).unwrap_or_default()` 静默吞掉错误。
- 致命点：回退默认后，后续任意一次 `update_app_settings` 保存都会把默认值覆盖写回磁盘，用户原有设置**不可逆丢失**。

## What Changes

- Backend：`read_settings` 失败时，先把损坏文件重命名备份为 `settings.json.corrupted-<UTC timestamp>.bak`（复用 project-map backup 的 timestamp 模式），再回退 `AppSettings::default()`，并输出 `[storage]` 日志；这样后续保存不会覆盖用户原文件。
- Frontend：加载 `catch` 分支补充 `console.error` 日志，并复用既有 `pushErrorToast`（`src/services/toasts.ts`）向用户推送 error toast，不新造 notice 机制。
- 只动两处 `unwrap_or_default()` 调用点及紧邻行；`load()` 内其他初始化语句一律不碰（该区域近 60 天为热点改动区）。

## Capabilities

### New Capabilities

- `app-settings-corruption-recovery`: 定义 `settings.json` 损坏时，backend 必须先隔离备份原文件再回退默认值，frontend 必须让加载失败可见，且正常（未损坏）路径的 settings normalize 行为不得回归。

### Modified Capabilities

- 无。

## Impact

- Affected code:
  - `src-tauri/src/storage.rs`（新增 `backup_corrupted_settings_file` helper + 单测）
  - `src-tauri/src/state.rs`（仅 `AppState::load` 中 settings 读取行及 import）
  - `src-tauri/src/bin/cc_gui_daemon.rs`（仅 storage use 行）
  - `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`（仅 `DaemonState::load` 中 settings 读取行）
  - `src/features/settings/hooks/useAppSettings.ts`（仅加载 `catch` 分支及 import）
  - `src/features/settings/hooks/useAppSettings.test.ts`（新增加载失败回归用例）
- APIs: 无 external API 变化。
- Dependencies: 不新增依赖（`chrono` 已是现有依赖）。
- Storage: 正常路径 `settings.json` schema 不变；仅在 parse/read 失败时新增 `settings.json.corrupted-<timestamp>.bak` 备份文件。

## 目标与边界

- 目标：settings 文件损坏时，用户原始内容必须保留在 `.bak` 备份中，后续保存不得覆盖。
- 目标：frontend 加载失败必须产生日志与用户可见 toast。
- 目标：与进行中 change `stabilize-client-runtime-and-diagnostics` 的 Gemini settings 归一逻辑语义相邻——正常（未损坏）路径的归一行为（含 `geminiEnabled` 归一为 disabled）不得因本 change 回归，需在 verification 记录。
- 边界：只覆盖 load-time corruption 隔离与可见性，不做 settings 自动修复、schema migration 或备份清理策略。

## 非目标

- 不重构 `AppState::load` / `DaemonState::load` 的其他初始化语句。
- 不改变 `read_settings` / `write_settings` 的签名与正常路径行为。
- 不新增 i18n locale key（toast 文案走 `t(..., { defaultValue })` 既有先例，避免九语言 parity 扩散）。
- 不处理 `workspaces.json` 的同类问题（记录为邻近发现，不在本 change 修复）。

## 技术方案取舍

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 仅日志，不备份 | `unwrap_or_default` 改 `unwrap_or_else` 打日志 | diff 最小 | 下一次保存仍覆盖原文件，数据仍丢失 | 不采用 |
| B. 备份后回退 | parse 失败先 rename 为 `.corrupted-<ts>.bak` 再回退默认 | 用户数据可恢复；复用现有 timestamp 备份先例；调用点改动最小 | 极端 rename 失败时仍只能日志告警 | 采用 |
| C. 就地修复 JSON | 尝试 repair parser 修复损坏内容 | 用户体验最好 | 引入新 parser 依赖与误判风险，超出 P0 治理范围 | 暂不采用 |

## 验收标准

- 写入损坏 `settings.json` 后，GUI 与 daemon 的 `load()` 均回退默认值，且原文件被保留为 `settings.json.corrupted-<timestamp>.bak`，内容不变。
- 正常（未损坏）`settings.json` 的读取与归一行为（含 legacy `geminiEnabled: true` 归一为 disabled、`codex_warm_ttl_seconds` upgrade）完全不变。
- frontend 加载 reject 时：settings 保持 defaults、`isLoading` 收敛为 false、`console.error` 有日志、`pushErrorToast` 被调用一次。
- `npm run typecheck`、focused Vitest（`useAppSettings`）、`cargo test`（storage / daemon 相关）与 strict OpenSpec validation 通过。
