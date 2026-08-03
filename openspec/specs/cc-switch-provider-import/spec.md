# cc-switch-provider-import Specification

## Purpose

TBD - created by archiving change for `cc-switch-provider-import`.

## Requirements

### Requirement: CC Switch 数据源发现 SHALL 跨平台且只读

系统 SHALL 提供只读后端命令，按 `app_type`（`claude` / `codex`）从本机 CC Switch 数据源返回供应商摘要列表。数据目录 SHALL 通过当前用户 home 目录拼接 `.cc-switch` 解析，覆盖 macOS、Linux 与 Windows；命令 MUST NOT 修改、创建或删除 CC Switch 的任何文件。

#### Scenario: 读取 SQLite 数据源
- **WHEN** `~/.cc-switch/cc-switch.db` 存在且包含 `providers` 表
- **THEN** 命令 SHALL 返回指定 `app_type` 的全部供应商条目
- **AND** 每条 SHALL 包含 `id`、`name`、`category`、`baseUrl`、`hasApiKey`、`settingsConfig`

#### Scenario: legacy config.json 兜底
- **WHEN** `cc-switch.db` 不存在但 `~/.cc-switch/config.json` 存在
- **THEN** 命令 SHALL 按 CC Switch v2 JSON 格式解析并返回等价列表

#### Scenario: 数据源缺失不报错
- **WHEN** DB 与 legacy JSON 均不存在
- **THEN** 命令 SHALL 返回 `available=false` 与空列表
- **AND** MUST NOT 返回错误

#### Scenario: baseUrl 按类型提取
- **WHEN** 返回 `claude` 类型条目
- **THEN** `baseUrl` SHALL 取自 `settings_config.env.ANTHROPIC_BASE_URL`，缺失时为 `null`
- **WHEN** 返回 `codex` 类型条目
- **THEN** `baseUrl` SHALL 从 `settings_config.config`（TOML）中解析 `base_url`，缺失时为 `null`

### Requirement: 导入入口 SHALL 出现在三个供应商配置页

Claude Code CLI 与 Codex CLI 页面的「第三方配置」区块头部 SHALL 各渲染一个「导入」按钮，且该按钮 MUST 位于「+ 添加」按钮之后；既有「自定义模型」与「+ 添加」按钮的位置与行为 MUST NOT 改变。Kimi CLI 页 v1 MUST NOT 渲染导入入口（产品决策：先隐藏；Kimi 映射能力在 hook 层保留，后续可一行接线恢复）。

#### Scenario: 按钮位置
- **WHEN** 用户打开任一供应商配置页
- **THEN** 「第三方配置」头部操作区 SHALL 依次为既有按钮、「+ 添加」、「导入」

#### Scenario: 打开对话框
- **WHEN** 用户点击「导入」
- **THEN** 系统 SHALL 打开「从 CC Switch 导入」对话框并加载当前页对应的供应商类型
- **AND** Claude 页 SHALL 展示 Anthropic 分类（`app_type='claude'`）
- **AND** Codex 页 SHALL 展示 OpenAI 分类（`app_type='codex'`）

### Requirement: 导入对话框 SHALL 支持勾选、去重与空态

对话框 SHALL 复刻 CC Switch 的选择式交互：左侧类型分类、右侧配置列表（名称 + Base URL 副标题）、全选、底部已选计数与「导入 N 个供应商」确认按钮。与当前列表 name + baseUrl 均相同的条目 SHALL 显示「已导入」徽标且不可勾选。

#### Scenario: 勾选与计数
- **WHEN** 用户勾选/取消勾选条目或点击全选
- **THEN** 底部计数与确认按钮文案 SHALL 实时反映可导入的已选数量
- **AND** 确认按钮在已选为 0 时 SHALL 禁用

#### Scenario: 已导入去重
- **WHEN** 某 CC Switch 条目的 name 与 baseUrl 和当前页列表中已有供应商一致
- **THEN** 该条目 SHALL 显示「已导入」徽标
- **AND** MUST NOT 被勾选导入

#### Scenario: 空态
- **WHEN** 数据源不可用或对应类型无供应商
- **THEN** 对话框 SHALL 显示空态提示而非错误弹窗

### Requirement: 导入写入 SHALL 复用现有 add 命令并按类型映射

导入确认后，系统 SHALL 对每个选中条目调用现有 `vendor_add_*_provider` 命令写入当前页列表，落盘位置与手工添加一致；导入 MUST NOT 自动切换 active provider，MUST NOT 自动拉取模型列表。

#### Scenario: Claude 页映射
- **WHEN** 向 Claude 页导入
- **THEN** 新供应商的 `settingsConfig.env` SHALL 完整携带 CC Switch 条目的 `settings_config.env`
- **AND** `source` SHALL 为 `'cc-switch'`

#### Scenario: Codex 页映射
- **WHEN** 向 Codex 页导入
- **THEN** `settings_config.config` SHALL 写入 `configToml`
- **AND** `settings_config.auth` 序列化后 SHALL 写入 `authJson`

#### Scenario: Kimi 页映射
- **WHEN** 向 Kimi 页导入 Anthropic 类条目
- **THEN** `ANTHROPIC_BASE_URL` SHALL 映射为 `baseUrl`、`ANTHROPIC_AUTH_TOKEN` 映射为 `apiKey`、`ANTHROPIC_MODEL` 映射为 `model`

#### Scenario: 导入完成反馈
- **WHEN** 全部选中条目写入完成
- **THEN** 对话框 SHALL 显示成功反馈（已导入数量）
- **AND** 当前页三方配置列表 SHALL 刷新并包含新条目
