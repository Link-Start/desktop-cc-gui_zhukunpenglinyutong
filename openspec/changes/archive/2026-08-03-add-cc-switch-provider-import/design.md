# add-cc-switch-provider-import Design

## Context

mossx 的 CLI 配置管理页（`VendorSettingsPanel.tsx`）按 claude/codex/kimi 三个 tab 渲染各自的第三方配置列表组件（`ProviderList` / `CodexProviderList` / `KimiProviderList`），三者均已支持 `headerActions` 插槽（渲染在「+ 添加」之前）。供应商写入统一经由 `vendor_add_claude/codex/kimi_provider` Tauri 命令落盘到 `~/.ccgui/config.json`。

CC Switch v3 将供应商存于 SQLite：`~/.cc-switch/cc-switch.db` 的 `providers` 表（PK `(id, app_type)`，`app_type ∈ {claude, codex, gemini, ...}`，`settings_config` 为 JSON 文本）。v2 使用 `~/.cc-switch/config.json`。`rusqlite`(bundled) 与 `toml` 已是 src-tauri 依赖，无新增 crate。

约束：
- 文件 IO 必须在 Rust 侧（仓库分层约定）。
- 读取外部应用数据必须只读（SQLite 以 read-only 模式打开）。
- 不得泄露 API Key 到日志；`settings_config` 仅在用户确认导入后写入本机既有配置。

## Goals / Non-Goals

**Goals:**
- 一个只读命令覆盖三平台路径解析与两种数据格式（v3 SQLite / v2 JSON）。
- 三个页面复用同一个导入对话框组件与 hook，仅 `appType` 与映射器不同。
- 写入路径与手工添加完全同构。

**Non-Goals:**
- 激活模型、拉取模型列表、双向同步（见 proposal 非目标）。

## Decisions

### D1: SQLite 只读打开 + JSON 兜底，单命令两格式

`vendor_list_cc_switch_providers(app_type: String) -> CcSwitchProviderList { available, providers }`。

- 路径：`home_dir()/.cc-switch/`，依次探测 `cc-switch.db` → `config.json`。home_dir 在三平台均解析到用户主目录（Windows 为 `%USERPROFILE%`），与 CC Switch 官方存放位置一致；不依赖环境变量。
- SQLite 使用 `OpenFlags::SQLITE_OPEN_READ_ONLY`，查询 `SELECT id, name, category, website_url, settings_config FROM providers WHERE app_type = ?1 ORDER BY sort_index, created_at`。
- v2 JSON 格式为 `{ "<app>": { "providers": [ {id, name, category, settingsConfig, ...} ] } }`，解析为同一返回结构。
- **替代方案**：两个命令分别处理 DB/JSON —— 被否，调用方不应关心格式版本。
- **替代方案**：Windows 额外扫描 `%APPDATA%` —— 被否，CC Switch 不使用该位置；保持与官方一致，未来若有变再加。

### D2: baseUrl 在 Rust 侧提取

返回结构的 `baseUrl` 由后端按类型提取：claude 取 `env.ANTHROPIC_BASE_URL`；codex 用 `toml` crate 解析 `settings_config.config` 字符串，取 `model_providers.*.base_url` 的第一个命中（codex config TOML 的供应商段为表数组/子表，解析失败则 `null`）。前端不做 TOML 解析，保持 WebView 轻量。`hasApiKey` 同样在后端判定（claude: `env.ANTHROPIC_AUTH_TOKEN` 非空；codex: `auth.OPENAI_API_KEY` 非空），供 UI 展示「无 API 配置」徽标。

### D3: 写入复用现有 add 命令，前端循环调用

前端 `useCcSwitchImport` 对选中项逐个调用既有 `addClaudeProvider` / `addCodexProvider` / `addKimiProvider` service，全部 settle 后刷新列表。单条失败不中断其余导入，失败条目在成功横幅中汇总提示。

- **替代方案**：后端批量 import 命令 —— 被否（见 proposal 方案对比，避免与手工添加路径分叉）。

### D4: 三个列表组件增加 `trailingActions` 插槽

现有 `headerActions` 渲染在「+ 添加」之前；新增 `trailingActions?: ReactNode` 渲染在「+ 添加」之后，三组件改动对称（各 ~3 行）。导入按钮由 `VendorSettingsPanel` 按 tab 注入，对话框在 panel 层挂载。

- **替代方案**：调整 `headerActions` 位置 —— 被否，会移动既有「自定义模型」按钮，破坏现有 UI。

### D5: 去重在前端计算

`useCcSwitchImport(existingProviders, ccSwitchItems)` 以 `name` + `baseUrl` 归一化（trim、尾部 `/` 去除、大小写不敏感）后比对，命中项 `imported=true` 禁选。归一化函数为纯函数，随 hook 单测覆盖。

### D6: Kimi 映射器

Kimi 页复用 `app_type='claude'` 数据源，映射：`baseUrl = env.ANTHROPIC_BASE_URL`、`apiKey = env.ANTHROPIC_AUTH_TOKEN`、`model = env.ANTHROPIC_MODEL ?? ''`、`providerType = 'kimi'` 缺省留空由用户编辑时选择。`baseUrl` 或 `apiKey` 缺失的条目仍允许导入（与手工添加的校验一致，由 add 命令侧校验兜底）。

## Risks / Trade-offs

- [CC Switch 升级改变 DB schema] → 查询失败时按「数据源不可用」空态处理，不 crash；`settings_config` 解析容错（serde `Value` 兜底为 `{}`）。
- [用户多设备路径差异 / 便携安装] → 仅支持官方 home 目录位置；空态文案提示未检测到 CC Switch。
- [N 次 IPC 循环慢] → N 通常 <20 且为一次性操作；如后续有批量诉求再评估后端批量命令。
- [并发写入 `~/.ccgui/config.json`] → 复用现有 add 命令的内部读写锁语义，与手工添加一致，不新增并发面。
- [API Key 误泄] → 后端不日志化 `settings_config`；前端对话框不展示 key 内容（仅 `hasApiKey` 布尔）。

## Migration Plan

纯新增能力，无数据迁移。回滚 = revert 本变更全部文件（新增文件 + 3 处插槽 + panel 接线 + i18n key），不影响已导入的供应商数据（它们已是普通列表条目）。

## Open Questions

无。（Kimi 数据源映射、legacy JSON 兜底已在提案阶段与用户确认。）
