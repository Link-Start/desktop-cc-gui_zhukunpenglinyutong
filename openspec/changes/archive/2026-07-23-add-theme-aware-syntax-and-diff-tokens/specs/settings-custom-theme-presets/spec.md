## ADDED Requirements

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
