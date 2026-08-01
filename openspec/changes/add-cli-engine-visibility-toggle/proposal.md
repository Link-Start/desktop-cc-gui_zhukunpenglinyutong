## Why

用户反馈：「CLI配置管理」把 20 个 CLI 平铺展示，不想用的 CLI（如 OpenCode）被迫常驻前台，既占用设置页导航视线，也出现在 composer 引擎选择器里。当前没有任何手段让用户按意愿收纳 CLI。

现状事实：

- `buildCliEngineNavItems()` 产出 20 项平铺列表：5 个 supported（claude / codex / kimi / grok / opencode）+ 15 个 unsupported 占位。
- composer `ProviderSelect` 可见性仅由 `providerAvailability`（后端 installed/ready 探测）决定，用户无法隐藏已安装但不想用的引擎。
- `AppSettings` 已有 `geminiEnabled` / `opencodeEnabled` 两个无消费者的死字段（默认值存在但无任何读取方）。

本变更给每个 supported CLI 增加「启用 / 停用」开关，把设置页导航重组为「已启用 / 未启用 / 暂未开放」三组，并让 composer 引擎选择器跟随用户开关隐藏已停用引擎。

## 目标与边界

### 目标

- 设置页 CLI 导航按「已启用 / 未启用 / 暂未开放」分组，组 header 可折叠。
- supported CLI 行 hover 时行尾出现「...」菜单，内含「关闭启用 / 启用」，切换即时持久化到 `AppSettings.disabledCliEngines`。
- composer 引擎选择器隐藏已停用引擎；当前会话正在使用的引擎即使已停用仍正常显示与工作。
- 停用只控制可见性，不删除或改写该 CLI 的任何供应商配置数据。

### 边界

- 只覆盖 5 个 supported CLI 的开关；15 个 unsupported CLI 仅有「暂未开放」分组归属，不提供开关。
- 不影响已有会话的展示与运行（ThreadList 等只读 surface 不做过滤）。
- 不做组内拖拽排序；组内保持注册表固定顺序。
- 组折叠状态不持久化（本地 state）。
- 搜索时退回平铺过滤，不显示组 header。
- 顺手移除无消费者死字段 `geminiEnabled` / `opencodeEnabled`，由 `disabledCliEngines` 统一表达。

## What Changes

- 新增 capability `cli-engine-visibility`：CLI 可见性分组与开关行为契约。
- `AppSettings` 新增 `disabledCliEngines: string[]`（默认 `[]` = 全部启用，黑名单语义保证向后兼容）。
- `VendorSettingsPanel` 导航改造：分组渲染 + 组 header 折叠 + 行 hover「...」启停菜单。
- `ProviderSelect` 可见性过滤接入用户开关（保留当前选中值兜底）。
- i18n 四语言（zh / zh-TW / en / es）补齐组名与空态文案。

## Capabilities

### New Capabilities

- `cli-engine-visibility`: supported CLI 的用户可见性开关、设置页分组展示、composer 选择器联动隐藏。

## 验收标准

- 设置页 CLI 导航 MUST 按「已启用 / 未启用 / 暂未开放」三组渲染，unsupported CLI MUST 全部归入「暂未开放」。
- supported CLI 行 MUST 在 hover / focus 时提供「...」菜单，内含「关闭启用 / 启用」；切换 MUST 持久化到 `disabledCliEngines` 并在重启后保持。
- 「未启用」组为空时 MUST NOT 渲染该组 header；「未启用」「暂未开放」组 MUST 默认折叠；用户新停用某 CLI 时「未启用」组 MUST 自动展开一次给出可见归宿（初次挂载不自动展开）。
- 搜索输入时 MUST 退回跨组平铺过滤。
- 停用某 CLI MUST NOT 删除其供应商配置；重新启用后配置 MUST 原样可用。
- composer 引擎选择器 MUST NOT 列出已停用引擎；当前选中引擎已停用时 MUST 仍显示该当前值。
- 全部停用时 MUST 允许，不得强制挽留至少一个。

## Git commit message engine picker

- GitDiff 与 GitHistory 的 commit message generation menu 改为单面板快捷选择。
- engine 列表不再在 Git feature 内硬编码，统一从 global engine registry 派生，再叠加 product execution policy 与 `disabledCliEngines`。
- language 在面板内切换；点击 engine 立即生成，并继续保存 last configuration。
- “使用上次配置”仅在对应 engine 当前仍可执行且用户可见时启用。
- 本变更不调整 checkpoint dialog、backend command、settings schema 或 engine runtime contract。

### Acceptance

- 默认展示 Claude Code、Codex、Grok、Kimi、OpenCode，且不展示当前 product policy 禁用的 Gemini。
- 用户关闭的 engine 不出现在 Git picker；全部关闭时展示明确空状态。
- GitDiff 与 GitHistory 复用同一 menu hook 和 picker，不复制 engine 清单。
