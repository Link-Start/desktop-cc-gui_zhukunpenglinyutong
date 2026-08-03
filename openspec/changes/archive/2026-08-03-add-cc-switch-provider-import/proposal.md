# add-cc-switch-provider-import Proposal

## Why

用户普遍使用 CC Switch 管理多套 CLI 供应商配置，当前在 mossx 的 CLI 配置管理页只能手工逐个「+ 添加」供应商（Base URL、API Key、模型逐一重填），重复劳动且易填错。本变更在 Claude / Codex / Kimi 三个供应商配置页提供「从 CC Switch 导入」能力：只读扫描本机 CC Switch 数据，勾选后一键写入对应页的第三方配置列表。

## 目标与边界

- Claude Code CLI 与 Codex CLI 页的「第三方配置」区块各新增一个「导入」按钮，位置在「+ 添加」按钮之后；Kimi CLI 页按产品决策 v1 隐藏导入入口（hook 层映射能力保留）。
- 导入对话框复刻 CC Switch 应用的选择式 UI：左侧供应商类型分类、右侧可勾选配置列表（名称 + Base URL 副标题 +「已导入」徽标 + 全选）、底部计数与「导入 N 个供应商」。
- 数据源为本机 CC Switch v3 SQLite 库（`~/.cc-switch/cc-switch.db`，`providers` 表），只读，绝不写回 CC Switch。
- 导入写入复用现有 `vendor_add_claude/codex/kimi_provider` 命令，落盘位置与手工添加完全一致（`~/.ccgui/config.json`）。
- 跨平台：macOS / Linux / Windows 均通过 home dir 解析 `~/.cc-switch/`，并提供 legacy `config.json`（CC Switch v2 格式）兜底。
- Kimi 映射（Anthropic 类 → Kimi anthropic 兼容端点）在 `useCcSwitchImport` 层实现并有测试覆盖，但 v1 不在 Kimi 页渲染入口按钮。

## 非目标

- 不做「导入后自动获取并激活模型」（CC Switch 截图中的行为）；导入仅写入列表，激活仍由用户手动切换。
- 不修改 CC Switch 的任何数据（纯只读源）。
- 不做双向同步、不做导入后的持续联动（删除/更新 CC Switch 侧不会影响已导入条目）。
- 不改动现有「自定义模型」「+ 添加」按钮的位置与行为。
- 不为 Gemini/OpenCode 等未在本页呈现的 CLI 增加导入入口。

## What Changes

- **Backend（Rust）**：新增 `vendors/cc_switch.rs`，提供 `vendor_list_cc_switch_providers(app_type)` 只读命令，跨平台解析 `~/.cc-switch/`（home dir join + legacy `config.json` 兜底），按 `app_type` 返回供应商摘要（id、name、category、base_url、has_api_key、settings_config）。数据源缺失时返回 `available=false`，不报错。
- **Frontend service**：`services/tauri/vendors.ts` 新增 `listCcSwitchProviders(appType)`。
- **Frontend UI**：新增 `CcSwitchImportDialog` 组件与 `useCcSwitchImport` hook；三个列表组件（`ProviderList` / `CodexProviderList` / `KimiProviderList`）新增 `trailingActions` 插槽渲染在「+ 添加」之后；`VendorSettingsPanel` 每个 tab 挂载导入按钮与对话框。
- **映射规则**：
  - Claude 页 ← `app_type='claude'`：`settings_config.env` 整体映射进 `ProviderConfig.settingsConfig.env`，`source='cc-switch'`。
  - Codex 页 ← `app_type='codex'`：`settings_config.auth`→`authJson`、`settings_config.config`→`configToml`。
  - Kimi 页 ← `app_type='claude'`：`ANTHROPIC_BASE_URL`→`baseUrl`、`ANTHROPIC_AUTH_TOKEN`→`apiKey`、`ANTHROPIC_MODEL`→`model`。
- **去重**：与当前列表按 name + baseUrl 匹配，命中项标「已导入」徽标并禁止重复勾选导入。
- **i18n**：`settings.vendor.ccSwitchImport.*`（zh/en；vendor 命名空间仅存在于 zh/en，其余 locale 走 fallback）。

## 技术方案对比

| 选项 | 说明 | 取舍 |
|------|------|------|
| A. Rust 只读命令 + 复用现有 add 命令写入（采用） | 后端只负责读取与解析 CC Switch DB，前端循环调用已验证的 `vendor_add_*_provider` | 写入路径与手工添加完全同构，零新增写逻辑、零迁移风险；代价是前端逐条调用（N 次 IPC，N 通常 <20，可接受） |
| B. 后端一次性 import 命令直接改 `~/.ccgui/config.json` | 一次 IPC 完成批量写入 | 绕过前端 hook 的错误处理/刷新链路，与手工添加路径分叉，需重复实现校验与排序逻辑，回归面更大 |
| C. 前端直接读 SQLite（sql.js 等） | 不经 Rust | 引入新前端依赖且 WebView 访问 home 目录文件需额外权限配置，违背仓库「文件 IO 在 Rust 侧」的分层约定 |

选择 A：最小回归面，符合现有架构分层。

## 验收标准

1. Claude/Codex 页的「第三方配置」头部出现「导入」按钮，且位于「+ 添加」之后；Kimi 页不渲染该按钮；原有按钮顺序不变。
2. 本机存在 `~/.cc-switch/cc-switch.db` 时，对话框按当前页类型列出对应供应商；Claude 页显示 Anthropic 分类，Codex 页显示 OpenAI 分类。
3. 勾选 N 条并确认后，对应页三方配置列表新增 N 条，字段映射正确（Claude 含 `source='cc-switch'`；Codex 的 `configToml`/`authJson` 完整；Kimi 的 `baseUrl`/`apiKey`/`model` 正确），重新打开设置页后仍在。
4. 已存在于列表中的供应商（name + baseUrl 匹配）显示「已导入」徽标且不可重复导入。
5. CC Switch 数据缺失（无 DB 且无 legacy config.json）时，对话框显示空态而非报错。
6. `cargo test`、`npm run typecheck`、受影响 Vitest 套件通过；`openspec validate --strict` 通过。

## Capabilities

### New Capabilities

- `cc-switch-provider-import`: 从本机 CC Switch 数据源只读发现供应商，并在 Claude/Codex/Kimi 供应商配置页通过选择式对话框导入到现有第三方配置列表的行为（含跨平台路径解析、类型映射、去重与空态）。

### Modified Capabilities

（无 — 导入复用现有 add/switch 行为，不改变其需求语义。）

## Impact

- **Rust**：新增 `src-tauri/src/vendors/cc_switch.rs`；`src-tauri/src/vendors/commands.rs`（注册命令）；`src-tauri/src/vendors/mod.rs`（模块声明）。无新增 crate 依赖（`rusqlite` 已存在；TOML 解析复用现有依赖）。
- **Frontend**：`src/services/tauri/vendors.ts`、`src/features/vendors/components/VendorSettingsPanel.tsx`、`ProviderList.tsx`、`CodexProviderList.tsx`、`KimiProviderList.tsx`；新增 `CcSwitchImportDialog.tsx`、`useCcSwitchImport.ts` 及测试；`src/i18n/locales/{zh,en}/settings.ts`。
- **数据**：只写 `~/.ccgui/config.json`（经现有 add 命令）；只读 `~/.cc-switch/`。
- **权限/安全**：读取范围仅限 `~/.cc-switch/` 下两个已知文件名；API Key 仅在用户确认导入后写入本机既有配置文件，不经网络传输。
