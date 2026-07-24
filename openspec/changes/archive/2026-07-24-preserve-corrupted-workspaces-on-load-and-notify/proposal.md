# Proposal: preserve-corrupted-workspaces-on-load-and-notify

## Why

`workspaces.json` 存在与已修复的 `settings.json` 完全同款的静默回退 + 覆盖写回风险（2026-07-24 核查时位于 `src-tauri/src/state.rs` 与 `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs` 的 `read_workspaces(&storage_path).unwrap_or_default()`）：

- 当 `workspaces.json` 损坏（JSON parse 失败或读取失败）时，GUI `AppState::load` 与 daemon `DaemonState::load` 均静默回退为空 workspace 列表，用户无感知。
- 致命点：回退后，后续任意一次 workspace 保存（`write_workspaces` / `write_workspaces_preserving_existing`）都可能把空列表覆盖写回磁盘，用户工作区配置**不可逆丢失**。
- 上一轮 `preserve-corrupted-app-settings-on-load` 已将同类问题记录为邻近发现，本 change 按同一模式闭环修复。

## What Changes

- Backend：`read_workspaces` 失败时，先把损坏文件重命名备份为 `workspaces.json.corrupted-<UTC timestamp>.bak` 再回退空列表，并输出 `[storage]` 日志；这样后续保存不会覆盖用户原文件。复用并泛化上一轮 `backup_corrupted_settings_file`：改名为 `backup_corrupted_file`，日志标签与回退文件名从 `path.file_name()` 派生，settings 既有调用点同步改名（行为不变）。
- Backend notice：GUI `AppState::load` quarantine 时记录一次性 `WorkspacesRecoveryNotice`（含备份文件名；备份失败为 null），新增 `take_workspaces_recovery_notice` command（take 语义只消费一次）。daemon 无 UI surface，保持 quarantine-only 不记录 notice。
- Frontend：`useWorkspaces` 挂载后调用 `takeWorkspacesRecoveryNotice`，有 notice 时复用 `pushErrorToast` 弹一次本地化 toast（文案含备份文件名；无文件名走备份失败文案）；notice 拉取失败不得影响 workspace 加载。zh / en locale 补 key，其余语言走 en fallback。
- 只动两处 `unwrap_or_default()` 调用点及紧邻行；`load()` 内其他初始化语句一律不碰。

## Capabilities

### New Capabilities

- `workspaces-corruption-recovery`: 定义 `workspaces.json` 损坏时，backend 必须先隔离备份原文件再回退默认值并记录一次性 recovery notice，frontend 必须在启动加载后把恢复事件可见化，且正常（未损坏）路径的 workspace 读取行为不得回归。

### Modified Capabilities

- 无。

## Impact

- Affected code:
  - `src-tauri/src/storage.rs`（`backup_corrupted_settings_file` 泛化改名为 `backup_corrupted_file` + 单测适配/新增）
  - `src-tauri/src/state.rs`（仅 `AppState::load` 中 workspaces 读取行、notice 字段与 import）
  - `src-tauri/src/shared/settings_core.rs`（新增 `WorkspacesRecoveryNotice` 与 `take_workspaces_recovery_notice_core` + 单测）
  - `src-tauri/src/workspaces/commands.rs`（新增 `take_workspaces_recovery_notice` command）
  - `src-tauri/src/command_registry.rs`（注册新 command）
  - `src-tauri/src/bin/cc_gui_daemon.rs`（仅 storage use 行改名）
  - `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`（仅 workspaces 读取行与 import 上下文）
  - `src-tauri/src/git/commands_branch.rs`、`src-tauri/src/git/pull_request_content.rs`（测试构造器补新字段）
  - `src/services/tauri/workspaceConfig.ts`、`src/services/tauri.ts`（`takeWorkspacesRecoveryNotice` 类型与导出）
  - `src/features/workspaces/hooks/useWorkspaces.ts`（挂载后 notice 拉取 + toast）
  - `src/features/workspaces/hooks/useWorkspaces.test.tsx`（新增回归用例）
  - `src/i18n/locales/zh/workspace.ts`、`src/i18n/locales/en/workspace.ts`（3 个 toast key）
- APIs: 新增一个 Tauri command `take_workspaces_recovery_notice`；既有 command 签名不变。
- Dependencies: 不新增依赖。
- Storage: 正常路径 `workspaces.json` schema 不变；仅在 parse/read 失败时新增 `workspaces.json.corrupted-<timestamp>.bak` 备份文件。

## 目标与边界

- 目标：workspaces 文件损坏时，用户原始内容必须保留在 `.bak` 备份中，后续保存不得覆盖。
- 目标：GUI 启动时用户必须通过一次性 toast 感知恢复事件；daemon 保持 quarantine-only。
- 边界：只覆盖 load-time corruption 隔离与可见性，不做 workspaces 自动修复、schema migration 或备份清理策略。

## 非目标

- 不重构 `AppState::load` / `DaemonState::load` 的其他初始化语句。
- 不改变 `read_workspaces` / `write_workspaces` 的签名与正常路径行为（含 default workspace dedupe 逻辑）。
- 不改 `SettingsRecoveryNotice` / `take_settings_recovery_notice` 现有契约。
- 不为其余语言补 locale key（走 en fallback，沿用上一轮先例）。
- 不处理其他 JSON 存储文件的同类问题（记录为邻近发现，不在本 change 修复）。

## 技术方案取舍

### 备份函数

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 新增平行 `backup_corrupted_workspaces_file` | 复制一份改文件名 | 不动 settings 调用点 | 两份近乎相同的实现，后续维护漂移 | 不采用 |
| B. 泛化为 `backup_corrupted_file` | 改名 + 日志/回退名从 `path.file_name()` 派生，settings 两处调用点同步改名 | 单一实现；函数本就接受任意 path，写死的只有日志标签与 fallback 名 | diff 略大于方案 A | 采用 |

### 通知链路

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 泛化 `SettingsRecoveryNotice` / `take_settings_recovery_notice` | 返回结构加 `fileKind` 或改 command | 单一 notice 通道 | 破坏已归档的现有契约与前端消费方；改动面大 | 不采用 |
| B. 新增平行 `WorkspacesRecoveryNotice` + `take_workspaces_recovery_notice` | 完全镜像 settings 链路 | 现有契约零影响；模式已验证；最小改动 | 两套近似类型（可接受，与 settings/daemon 分层一致） | 采用 |

## 验收标准

- 写入损坏 `workspaces.json` 后，GUI 与 daemon 的 `load()` 均回退空列表，且原文件被保留为 `workspaces.json.corrupted-<timestamp>.bak`，内容不变；后续 `write_workspaces` 不破坏备份。
- GUI quarantine 后 `take_workspaces_recovery_notice` 第一次返回含备份文件名的 notice，第二次返回 null；未损坏启动返回 null。
- 前端挂载后有 notice 弹恰好一次 toast（message 含备份文件名；文件名为 null 时走备份失败文案），无 notice 不弹；notice 拉取失败不影响 workspace 列表加载。
- 正常（未损坏）`workspaces.json` 的读取、dedupe 与合并行为完全不变（既有 storage 单测全绿）。
- `npm run typecheck`、focused Vitest（`useWorkspaces` / `useAppSettings`）、`cargo test --lib`、`cargo test --bin cc_gui_daemon` 与 strict OpenSpec validation 通过（`runtime::tests` 两个进程组测试的本机沙箱预存失败除外，仅记录）。
