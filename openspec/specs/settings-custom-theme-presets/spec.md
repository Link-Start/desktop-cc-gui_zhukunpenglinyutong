# settings-custom-theme-presets Specification

## Purpose

Defines the settings-custom-theme-presets behavior contract, covering Settings MUST Expose A Dedicated Custom Theme Mode.
## Requirements
### Requirement: Settings MUST Expose A Dedicated Custom Theme Mode

系统 MUST 在现有 `system / light / dark` 之外提供 `custom` 主题模式，用于承载 preset 化主题配色选择。

#### Scenario: custom theme mode is visible in appearance settings

- **WHEN** 用户打开外观设置
- **THEN** 系统 MUST 展示 `自定义` 主题选项
- **AND** 当前激活主题 MUST 保持可识别状态

#### Scenario: preset selector appears only for custom mode

- **WHEN** 用户未选择 `custom` 主题模式
- **THEN** 系统 MUST NOT 展示主题配色下拉
- **WHEN** 用户切换到 `custom`
- **THEN** 系统 MUST 展示主题配色下拉并允许直接选择 preset

### Requirement: Custom Theme Presets MUST Preserve The Existing Light/Dark Runtime Contract

`custom` 主题模式 MUST 在 runtime 层解析为 preset 对应的 `light` 或 `dark` appearance，而不是把 `custom` 直接传播到下游渲染 contract。

#### Scenario: custom preset resolves to dark appearance safely

- **WHEN** 用户选择一个 dark appearance 的 preset
- **THEN** 系统 MUST 继续把运行时 appearance 解析为 `dark`
- **AND** 依赖 `data-theme` 的组件 MUST 不需要理解 `custom` 字面值也能继续工作

#### Scenario: custom preset resolves to light appearance safely

- **WHEN** 用户选择一个 light appearance 的 preset
- **THEN** 系统 MUST 把运行时 appearance 解析为 `light`
- **AND** window appearance、Mermaid、Markdown preview、terminal 等 light/dark 观察方 MUST 继续可用

#### Scenario: invalid persisted preset falls back

- **WHEN** 持久化的 `customThemePresetId` 缺失或无效
- **THEN** 系统 MUST 回退到一个有效默认 preset
- **AND** 启动与设置保存流程 MUST 继续正常工作

### Requirement: Preset Catalog MUST Offer Popular VS Code Style Choices

系统 MUST 提供一组 curated 的 VS Code 风格 preset，覆盖浅色与深色常见选择。Preset catalog MUST remain stable, typed, localized, and selectable from the `custom` theme palette picker.

#### Scenario: preset catalog contains both dark and light popular themes

- **WHEN** 用户展开主题配色下拉
- **THEN** 系统 MUST 提供多套热门 VS Code 风格 preset
- **AND** 其中 MUST 同时包含 light 与 dark appearance 的可选项

#### Scenario: preset catalog includes expanded distinct palette choices

- **WHEN** 用户在 `custom` 模式下展开主题配色下拉
- **THEN** 系统 MUST include the existing preset catalog plus the following additional light appearance presets: Catppuccin Latte, Tokyo Day, Rose Pine Dawn, Everforest Light, and Ayu Light
- **AND** 系统 MUST include the following additional dark appearance presets: Dracula, Nord, Catppuccin Mocha, Tokyo Night, and Rose Pine
- **AND** 每个新增 preset MUST have a stable typed id, localized label key, complete color source map for the existing theme token mapper, and backend settings sanitize support

#### Scenario: selecting a preset updates custom theme identity

- **WHEN** 用户在 `custom` 模式下选择新的 preset
- **THEN** 系统 MUST 持久化新的 preset identity
- **AND** 当前 UI 配色 MUST 随之更新

#### Scenario: expanded presets preserve custom theme slot isolation

- **WHEN** 用户选择任一新增 preset
- **THEN** 系统 MUST update `customThemePresetId`
- **AND** 系统 MUST NOT mutate the saved `lightThemePresetId` or `darkThemePresetId` slots
- **AND** backend settings sanitize MUST preserve the new `customThemePresetId` instead of falling back to the default preset
- **AND** runtime appearance MUST continue to resolve from the selected preset's `light` or `dark` appearance

### Requirement: Appearance Settings MUST Control Whole-Client Window Transparency

系统 MUST 在外观设置中提供客户端整体窗口透明度控制，并保持主题模式与主题 preset 的既有语义不变。

#### Scenario: window transparency controls are visible in appearance settings

- **WHEN** 用户打开 `设置 -> 基础设置 -> 外观`
- **THEN** 系统 MUST 展示窗口透明开关
- **AND** 当前开关状态 MUST 与持久化偏好一致

#### Scenario: enabling window transparency applies immediately

- **WHEN** 用户打开窗口透明开关
- **THEN** 系统 MUST 在当前窗口即时调用 native window opacity 能力
- **AND** 应用重启 MUST NOT be required
- **AND** 系统 MUST NOT 通过 renderer `.app` CSS opacity 或局部 panel/surface alpha 来替代 native 窗口透明

#### Scenario: whole-window opacity is configurable when enabled

- **WHEN** 窗口透明已开启
- **THEN** 系统 MUST 展示整体透明度 slider
- **AND** 用户调整百分比后系统 MUST 持久化透明度并即时更新 native 当前窗口
- **AND** 透明度 MUST 被限制在可读范围内

#### Scenario: invalid window opacity falls back safely

- **WHEN** 持久化的整体透明度缺失、非法或越界
- **THEN** 系统 MUST 使用安全默认透明度
- **AND** 设置页与主界面 MUST 保持可用

### Requirement: Whole-Client Transparency MUST Be Cross-Platform Safe

系统 MUST 在 Windows、macOS、Linux 上安全处理窗口透明能力，native/window effect 不可用时必须降级而不是中断 UI。

#### Scenario: transparent window support is available

- **WHEN** 当前平台与运行环境支持 native window opacity
- **THEN** 系统 SHOULD 透出窗口背后的桌面/应用内容
- **AND** `.app` 根节点 MUST NOT 使用 CSS opacity 模拟窗口透明

#### Scenario: transparent window support is unavailable

- **WHEN** 当前平台、compositor 或运行环境不支持 native window opacity
- **THEN** 系统 MAY 退化为普通不透明窗口
- **AND** 用户操作、设置保存与窗口渲染 MUST 继续正常工作

#### Scenario: native window opacity call fails

- **WHEN** native window opacity 调用失败
- **THEN** 系统 MUST 记录可诊断信息
- **AND** MUST NOT 抛出未处理异常、白屏或阻止设置保存

### Requirement: Window Transparency Changes MUST Respect Large File Governance

窗口透明实现涉及 stylesheet 或窗口配置时，系统 MUST 遵守 large-file governance workflow 的 near-threshold 与 hard gate 约束。

#### Scenario: stylesheet changes are validated by large file sentry

- **WHEN** 窗口透明改动修改 CSS 或相关测试治理文件
- **THEN** 验证流程 MUST include large-file sentry commands aligned with `.github/workflows/large-file-governance.yml`
- **AND** 新增样式 SHOULD remain scoped and minimal instead of expanding already-large files unnecessarily

### Requirement: Theme Presets MUST Drive Syntax Highlighting And Diff Colors

`custom` 主题模式及预设 light/dark appearance MUST 同步携带 syntax token 与 diff 配色,确保 Markdown 代码块、文件预览(file-view)、文件树缩略预览、diff viewer、session activity 命令输出、diff 行级加/减配色的颜色都跟随当前 preset 派生,而非仅跟随 `:root[data-theme="light|dark"]` 兜底。

#### Scenario: preset switch updates markdown codeblock token colors

- **WHEN** 用户在 `custom` 模式下从 `vscode-github-light` 切换到 `vscode-catppuccin-mocha`
- **THEN** Markdown 代码块 `.token.keyword` 颜色 MUST 从 `vscode-github-light` 的 keyword hex 切换为 `vscode-catppuccin-mocha` 的 keyword hex
- **AND** 8 类 token(`keyword` / `string` / `comment` / `number` / `function` / `operator` / `type` / `tag`)在切换后 MUST 全部跟随新 preset

#### Scenario: preset switch updates file-view preview token colors

- **WHEN** 用户切换主题 preset
- **THEN** file-view 单文件预览 `.fvp-line-text .token.*` 8 类颜色 MUST 跟随新 preset
- **AND** `--fvp-token-*` 8 个变量 MUST 等于 preset.syntax 对应字段

#### Scenario: preset switch updates file-tree inline preview token colors

- **WHEN** 用户切换主题 preset
- **THEN** file-tree 缩略预览 `.file-preview-line-text .token.*` 8 类颜色 MUST 跟随新 preset
- **AND** 8 个选择器 MUST 使用 `var(--file-preview-token-*)` 而非硬编码 hex

#### Scenario: preset switch updates diff viewer inline token colors

- **WHEN** 用户切换主题 preset
- **THEN** diff viewer 内联代码 token `.diff-line-content .token.*` 8 类颜色 MUST 跟随新 preset
- **AND** `--diff-token-*` 8 个变量 MUST 等于 preset.syntax 对应字段

#### Scenario: preset switch updates session activity command output token colors

- **WHEN** 用户切换主题 preset
- **THEN** session activity 命令输出 `.session-activity-preview-text.is-command-output .token.*` 8 类颜色 MUST 跟随新 preset
- **AND** `--session-activity-command-output-*` 8 个变量 MUST 等于 preset.syntax 对应字段

#### Scenario: preset switch updates diff line-level add and remove colors

- **WHEN** 用户切换主题 preset
- **THEN** diff 行级加/减配色的 `--diff-inserted-text` / `--diff-removed-text` MUST 等于新 preset 的 `diff.inserted` / `diff.removed` hex
- **AND** `--diff-inserted-bg` / `--diff-inserted-gutter` / `--diff-removed-bg` / `--diff-removed-gutter` MUST 由对应 hex 通过 `withAlpha(isDark ? 0.16 : 0.11)` / `withAlpha(isDark ? 0.44 : 0.34)` 派生

#### Scenario: preset data missing syntax or diff falls back safely

- **WHEN** preset 的 `syntax` 或 `diff` 字段缺失或部分字段缺失
- **THEN** mapper MUST 使用 themes.light.css / themes.dark.css 的 fallback 默认值兜底
- **AND** 启动与设置保存流程 MUST 继续正常工作,不出现空值

### Requirement: All Curated Presets MUST Carry Syntax And Diff Color Data

21 个 curated VSCode 风格 preset MUST 全部携带 `syntax: { keyword, string, comment, number, function, operator, type, tag }` 与 `diff: { inserted, removed }` 字段,hex 来源为各 preset 对应的 VSCode 官方 `.color-theme.json`。

#### Scenario: every curated preset exposes full syntax tokens

- **WHEN** 系统加载任意 21 个 curated preset
- **THEN** preset MUST 暴露 `syntax.keyword` / `syntax.string` / `syntax.comment` / `syntax.number` / `syntax.function` / `syntax.operator` / `syntax.type` / `syntax.tag` 全部 8 个字段
- **AND** 每个字段 MUST 为合法 `#RRGGBB` hex 字符串

#### Scenario: every curated preset exposes diff colors

- **WHEN** 系统加载任意 21 个 curated preset
- **THEN** preset MUST 暴露 `diff.inserted` 与 `diff.removed` 字段
- **AND** 每个字段 MUST 为合法 `#RRGGBB` hex 字符串

### Requirement: File-Tree Inline Preview MUST Use Theme-Aware Token Variables

`src/styles/file-tree.css` 的文件树缩略预览 MUST 移除 `.file-preview-line-text .token.*` 的硬编码 hex,改为消费 `var(--file-preview-token-*)` 主题变量,确保 light / dark mode 与 preset 切换都能正确着色。

#### Scenario: file-tree token colors follow current theme preset

- **WHEN** 文件树缩略预览渲染一行带 Prism token class 的代码
- **THEN** `.token.comment` / `.token.punctuation` / `.token.property` / `.token.tag` / `.token.constant` / `.token.symbol` / `.token.deleted` / `.token.boolean` / `.token.number` / `.token.selector` / `.token.attr-name` / `.token.string` / `.token.char` / `.token.builtin` / `.token.inserted` / `.token.operator` / `.token.entity` / `.token.url` / `.token.variable` / `.token.atrule` / `.token.attr-value` / `.token.keyword` / `.token.function` / `.token.class-name` MUST 跟随当前 preset 的 `--file-preview-token-*` 8 类变量着色
- **AND** MUST NOT 包含任何直接硬编码 hex 值

### Requirement: Appearance Settings MUST Show A Live Code And Diff Preview

外观设置页 MUST 在 `自定义 / light / dark` 主题模式下展示一个"代码 & Diff 配色预览"模块,实时跟随当前 preset 渲染代码块、文件预览、Markdown 代码块、Diff 行级加/减配色的视觉效果。

#### Scenario: preset switch updates preview panels

- **WHEN** 用户在外观设置中切换 preset(例如从 `vscode-catppuccin-mocha` 到 `vscode-github-light`)
- **THEN** 预览面板中的代码 token(`keyword` / `string` / `comment` / `number` / `function` / `operator` / `property` / `constant` / `variable`)与 diff 加/减行颜色 MUST 在不刷新页面的情况下立即切换
- **AND** 预览面板 MUST 消费与实际渲染入口相同的 CSS 变量(messages codeblock / file-view / file-tree / diff-viewer / session-activity)

#### Scenario: preview reflects dark and light appearance

- **WHEN** 用户在系统/跟随主题下切换系统外观(深色 ↔ 浅色)
- **THEN** 预览面板 MUST 跟随外观切换 dark / light fallback

#### Scenario: preview panel survives missing preset data

- **WHEN** preset 的 syntax / diff 字段缺失
- **THEN** 预览面板 MUST 使用 themes.light.css / themes.dark.css 的 fallback 默认值,显示稳定可读的预览,不出错或抛异常

### Requirement: Theme Mapper MUST Provide Stable Root Override Variables

CSS 自定义属性的 cascade 规则 MUST 保证 preset 派生值不会被容器选择器(`.fvp` / `.diff-line-content` / `.file-preview-line-text` / `.session-activity-preview-text` / `.markdown-codeblock`)内的历史 fallback 截断。

#### Scenario: container-level token variables are preset driven

- **WHEN** 用户切换 preset
- **THEN** mapper MUST 在 root target 输出 `--theme-syntax-*` / `--theme-diff-*` 稳定 override
- **AND** 各 consumer MUST 使用 `var(--theme-*, var(--legacy-*))`，让 preset 值优先于 `.fvp { --fvp-token-*: ... }` 等 scoped fallback

#### Scenario: dynamically mounted token container inherits current preset

- **WHEN** 主题切换完成后才挂载 file-view、diff 或 Settings preview
- **THEN** 新节点 MUST 直接继承当前 root override，无需重新切换主题
- **AND** 实现 MUST NOT 依赖一次性的 `querySelectorAll`、`MutationObserver` 或逐节点 inline style

