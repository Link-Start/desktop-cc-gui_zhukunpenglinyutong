## Why

Claude managed provider 已能通过 `providerProfileId` 注入 per-turn env，但 `ClaudeSessionManager` 仍以 `workspaceId` 作为唯一 runtime key，且 secondary spawn（AskUserQuestion / approval resume）未稳定继承 provider launch context。设置页仍展示旧的全局“启用”语义，CLI header 在 action 较多或可用宽度不足时会发生覆盖，导致行为契约与 UI 认知同时漂移。

## 目标与边界

- Claude managed provider 以 `workspaceId + providerProfileId` 作为 runtime ownership，允许同一 workspace 下多 provider 并行对话。
- 每个 managed turn 及其 resume / compact / retry child process 只获得自身 provider env。
- local profile 保持使用现有 Claude home/settings；managed runtime 不写 `~/.claude/settings.json`。
- Claude managed provider 列表只表达“新会话可选”，不再提供全局切换入口。
- CLI lifecycle header 在 proxy/version/update/refresh 等 action 并存时稳定换行，不发生覆盖。

## 非目标

- 不为 managed provider 物化独立 `CLAUDE_CONFIG_DIR`，避免切断现有 history/resume/MCP 配置。
- 不改变 provider CRUD 数据结构，不删除 backend legacy global switch command。
- 不支持单个既有会话热切换 provider。
- 不修改当前 CC Switch 导入 change 的实现。

## What Changes

- 将 Claude session registry 从 workspace-only key 调整为 provider-aware runtime key；保留 local/default 的 legacy compatibility。
- 把 provider launch context 纳入 Claude secondary spawn 与 cleanup/control path，防止 resume 回退 local。
- 增加同 workspace 多 provider 并行隔离、local config 不被写入、provider 删除 fail-closed 的回归测试。
- Claude managed provider 状态统一为“新会话可选”，移除设置页 `onSwitch` 交互。
- 调整 vendor brand header/action CSS，使版本、升级与刷新 action 在有限宽度下可换行且不覆盖内容。

## 方案对比

- **方案 A：provider-aware runtime key + per-process env（采用）**
  复用 Codex 的 runtime ownership 思路，同时保留 Claude 共享 history home。隔离 provider 的内存状态和 child process env，不引入配置目录迁移。
- **方案 B：为每个 provider 物化独立 `CLAUDE_CONFIG_DIR`**
  隔离最强，但会改变 history、resume、MCP 与本地 skill/settings 可见性，兼容风险过高。
- **方案 C：继续 workspace-only manager，仅补 secondary spawn env**
  diff 最小，但 workspace-shared mutable state 仍可能让并行 provider turn 串线，不满足本次并行隔离目标。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `engine-per-session-provider-binding`: Claude runtime ownership、secondary spawn、并行控制与 cleanup 必须遵循 provider-scoped binding。
- `claude-provider-management`: managed provider 设置页改为“新会话可选”，不再把列表操作建模为 active runtime switch。
- `cli-one-click-installer`: vendor CLI lifecycle header 在有限宽度和多 action 场景下必须无覆盖并可访问。

## 验收标准

- 同一 workspace 的 provider A、provider B、local Claude 会话可并行发送，env 与 runtime state 不串线。
- AskUserQuestion、approval resume、auto-compact、legacy retry 均继承原 turn provider。
- managed send 不修改 `~/.claude/settings.json`；local 会话不注入 managed env。
- missing/deleted managed provider 返回包含 provider id 的错误，不 fallback local。
- Claude managed provider 行仅显示“新会话可选”，无“启用”按钮。
- 320px 级 action 宽度与常规桌面宽度下，版本/升级/刷新 action 均不重叠。

## Impact

- Backend：`src-tauri/src/engine/claude/**`、`src-tauri/src/engine/commands.rs`、daemon 对称路径及相关 manager/control callers。
- Frontend：`src/features/vendors/components/ProviderList.tsx`、`VendorSettingsPanel.tsx`、`CliLifecycleHeaderActions.tsx`、i18n 与 vendor panel CSS。
- Contract：不新增 Tauri command 或 dependency；现有 `providerProfileId` payload 保持 backward compatible。
