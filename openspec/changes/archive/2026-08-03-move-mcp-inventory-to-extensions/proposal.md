# Proposal: move-mcp-inventory-to-extensions

> 追溯性提案（retrospective）：实现已随 `101a19abb`（feat(extensions): add MCP inventory view）于 2026-07-25 合入 main。本提案补齐 OpenSpec 跟踪事实，不改变已交付行为。

## Why

MCP 服务器管理原先放在 Settings modal 的 `McpSection`（约 782 行），与 Extensions 的「统一管理面」定位不一致，且用户无法在同一视图中对照「配置文件里定义的服务器」与「运行时实际加载的服务器」。本变更把 MCP 管理迁移到 Extensions 的独立 Mcps tab，并补齐后端配置聚合与启用/禁用能力。

## What Changes

- Extensions 新增 Mcps tab：`McpsPage.tsx`（约 465 行）展示 Claude Code 与 Codex 两套 inventory，区分 config-defined 与 runtime-reported 服务器，支持按来源过滤与搜索；`McpsDetailPanel.tsx` 展示单服务器 metadata、tools、auth/status、transport、command、URL 详情；`McpsToggleSwitch.tsx` 提供启用/禁用开关；`McpsDashboardSection.tsx` / `TokenTrackerMcpsView.tsx` 完成 section 接线。
- 新增 `hooks/useMcpInventory.ts` 与 `utils/mcpInventory.ts`：inventory 聚合、解析、行过滤逻辑。
- Backend `src-tauri/src/codex/mcp_config.rs`：聚合 `~/.claude.json` 与 ccgui config 两个来源（不再读到第一个来源即返回）；新增 enable/disable 全局 MCP 服务器的 Tauri command，写回时保留 object-form `disabledMcpServers` 与 array-form `enabled` 两种既有字段形状；`command_registry.rs` 注册 1 个 command。
- 下线 Settings 的 `McpSection.tsx`（约 782 行）及测试；Settings 的 Skills 区域仅保留 curated skills 管理。
- i18n：MCP 相关文案从 `settings` namespace 迁移到 `sidebar`（Extensions）namespace，10 个 locale 同步。

## Capabilities

### New Capabilities

- `mcp-inventory-view`: Extensions-Mcps 的 MCP inventory 契约——Claude Code / Codex 双 inventory、config-defined 与 runtime-reported 分离、来源过滤与搜索、服务器详情面板、全局启用/禁用切换及其双配置源聚合写回语义。

### Modified Capabilities

- `extensions-management-surface`: 新增 Mcps tab 作为 MCP 管理入口。
- `claude-runtime-mcp-servers-panel`: MCP 管理面从 Settings 迁移到 Extensions；运行时上报服务器以 runtime-reported 分组并入 Mcps inventory（只读语义不变）。

## Impact

- Backend: `src-tauri/src/codex/mcp_config.rs`、`src-tauri/src/codex/mod.rs`、`src-tauri/src/command_registry.rs`。
- Frontend: `src/features/extensions/components/McpsPage.tsx`、`McpsDetailPanel.tsx`、`McpsToggleSwitch.tsx`、`McpsDashboardSection.tsx`、`TokenTrackerMcpsView.tsx`、`ExtensionsView.tsx`、`hooks/useMcpInventory.ts`、`utils/mcpInventory.ts`、`components/tokentracker-dashboard-modules.d.ts`；`src/app-shell-parts/renderAppShell.tsx`。
- Removed: `src/features/settings/components/McpSection.tsx` + 测试。
- i18n: 10 个 locale 的 `settings` / `sidebar` namespace 调整。
- Tests: `McpsPage.test.tsx`、`mcpInventory.test.ts`、`ExtensionsView.test.tsx`、`SettingsView.test.tsx`、`src/services/tauri.test.ts`；Rust MCP config 单测。

## 验收标准

- 拓展-Mcps tab 展示 Claude Code 与 Codex inventory；config-defined 与 runtime-reported 服务器分组清晰；来源过滤与搜索可用。
- 详情面板展示 per-server metadata / tools / auth/status / transport / command / URL。
- 启用/禁用切换经 Tauri command 写回配置：`~/.claude.json` 与 ccgui config 两个来源都被聚合；写回保留 object-form `disabledMcpServers` 与 array-form `enabled` 字段形状；切换失败有可见反馈。
- Settings 中不再出现 MCP 管理入口；文案在 Extensions namespace 下 10 个 locale 完整。
- Rust MCP config 单测与 Vitest（McpsPage / mcpInventory / ExtensionsView / SettingsView / tauri wrappers）通过；lint、typecheck 通过；OpenSpec strict validation 通过。
