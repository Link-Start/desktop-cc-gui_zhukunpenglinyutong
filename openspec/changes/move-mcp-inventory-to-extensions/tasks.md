## 1. Contract

- [x] 1.1 [P0, depends: none] 固化 proposal：Mcps tab 范围、双 inventory 分离、配置聚合与 toggle 写回语义、Settings McpSection 下线、i18n 迁移、验收口径。（追溯：2026-07-25 随 `101a19abb` 合入后补记）

## 2. Backend（MCP 配置聚合 + toggle）

- [x] 2.1 [P0, depends: 1.1] `src-tauri/src/codex/mcp_config.rs`：聚合 `~/.claude.json` 与 ccgui config 两个来源（不再首个来源命中即返回）；新增 enable/disable 全局 MCP 服务器 command，写回保留 object-form `disabledMcpServers` 与 array-form `enabled` 字段形状。
- [x] 2.2 [P0, depends: 2.1] `command_registry.rs` 注册 toggle command；Rust MCP config 单测覆盖聚合与双形状写回。

## 3. Frontend（Mcps tab）

- [x] 3.1 [P0, depends: 1.1] 新增 `utils/mcpInventory.ts`（inventory 聚合 / 解析 / 行过滤）与 `hooks/useMcpInventory.ts`。
- [x] 3.2 [P0, depends: 3.1] 新增 `McpsPage.tsx`（Claude Code / Codex inventory、config-defined vs runtime-reported 分组、来源过滤、搜索、刷新、toggle 失败反馈）、`McpsDetailPanel.tsx`（metadata / tools / auth/status / transport / command / URL）、`McpsToggleSwitch.tsx`。
- [x] 3.3 [P0, depends: 3.2] `McpsDashboardSection.tsx` / `TokenTrackerMcpsView.tsx` / `tokentracker-dashboard-modules.d.ts` 接线；`ExtensionsView.tsx` 新增 Mcps tab；`renderAppShell.tsx` 调整。

## 4. Settings 收敛与 i18n

- [x] 4.1 [P0, depends: 3.3] 删除 Settings `McpSection.tsx`（约 782 行）及测试；Settings Skills 区域仅保留 curated skills。
- [x] 4.2 [P1, depends: 3.3] MCP 文案从 `settings` namespace 迁移到 `sidebar`（Extensions）namespace；10 个 locale 同步；`clientDocumentationData.ts` 更新。

## 5. Tests

- [x] 5.1 [P0, depends: 3.3] `McpsPage.test.tsx`（inventory 渲染 / 过滤 / tab 行为 / 刷新 / toggle 失败）、`mcpInventory.test.ts`、`src/services/tauri.test.ts`（Tauri invocation wiring）。
- [x] 5.2 [P0, depends: 4.1] 更新 `ExtensionsView.test.tsx`、`SettingsView.test.tsx`。

## 6. Verification

- [x] 6.1 [P0, depends: 5.x] Rust MCP config 单测 + focused Vitest 通过；lint、typecheck 通过。
- [x] 6.2 [P1, depends: 6.1] OpenSpec strict validation 通过；归档时同步 `mcp-inventory-view` 主 spec 并回填 `extensions-management-surface` / `claude-runtime-mcp-servers-panel` delta。

## Verification Record

- Commit: `101a19abb` feat(extensions): add MCP inventory view（2026-07-25）。commit message 记录：Rust MCP config unit tests 与 Vitest（McpsPage、ExtensionsView、mcpInventory、SettingsView、Tauri wrappers）通过；Confidence: high；Scope-risk: moderate。
- 本提案为追溯补记，行为事实以该 commit 与仓库当前代码为准。
