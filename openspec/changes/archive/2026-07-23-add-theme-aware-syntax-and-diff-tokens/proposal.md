## Why

外观设置中"自定义主题"可以让用户切换到 GitHub Light / Catppuccin Mocha / One Dark Pro / Solarized 等 21 套 VSCode 风格 preset,UI surface 颜色会跟随 preset 变化。但代码块(Markdown inline code、file-view 单文件预览、file-tree 缩略预览、diff viewer、session activity 命令输出)和 diff 行级加/减配色的当前实现存在两类缺口:

1. 5 套代码 token 命名空间(`--message-code-token-*` / `--fvp-token-*` / `--diff-token-*` / `--session-activity-command-output-*` 和 file-tree 内嵌硬编码)和 `--diff-added/deleted-bg/gutter/text` 都没有接入 preset 派生层。代码色仅由 `:root[data-theme="light|dark"]` + `prefers-color-scheme` 兜底,因此同一个 preset(如 Catppuccin Mocha)下,Markdown 代码块仍显示 Catppuccin 之外的默认 dark 色。
2. `file-tree.css` 文件树缩略预览的 8 个 Prism token class 完全硬编码 dark hex 值(`#ff7b72` / `#f2cc60` / `#7ee787` 等),light mode 下也用 dark 色,造成可读性退化。

用户期望: 切到 Catppuccin Mocha 就整套 Catppuccin Mocha 的代码配色;切到 GitHub Light 就整套 GitHub Light 的代码配色。本次改动让所有代码 / diff 颜色入口都跟随当前 preset 派生,保持现有 fallback 兜底。

## What Changes

- 给 `VsCodeThemePresetDefinition` 增加 `syntax: { keyword, string, comment, number, function, operator, type, tag }` 与 `diff: { inserted, removed }` 两个字段。21 个 curated preset 全部补齐,使用各 preset 实际对应的 VSCode theme token hex 值。
- `mapVsCodeColorsToTokens` 增加代码 token 与 diff token 派生输出:
  - `--message-code-token-{comment,punctuation,constant,number,string,operator,keyword,function}`
  - `--fvp-token-{comment,punctuation,property,number,string,operator,keyword,function}`
  - `--diff-token-{comment,punctuation,property,number,string,variable,keyword,function}`
  - `--session-activity-command-output-{comment,punctuation,constant,number,string,operator,keyword,function}`
  - `--file-preview-token-{comment,punctuation,property,number,string,operator,keyword,function}`
  - `--diff-inserted-text` / `--diff-inserted-gutter` / `--diff-inserted-bg`
  - `--diff-removed-text` / `--diff-removed-gutter` / `--diff-removed-bg`
- 把 `src/styles/file-tree.css` 的 8 个 `.token.*` 硬编码 hex 替换为 `var(--file-preview-token-*)`。
- `themes.light.css` / `themes.dark.css` 给新增变量在 `:root` / `:root[data-theme="light"]` 写 fallback,保证 preset 数据缺失或迁移期不出现空值。
- 新增独立的 `--theme-syntax-*` / `--theme-diff-*` override namespace；实际 consumer 优先读取 override，再回退各自历史 token，保证动态挂载节点也能继承 preset。
- 外观设置新增 `SyntaxAndDiffPreview`，通过 7 个 zh/en i18n key 展示实时代码与 diff 预览。
- 新增 `mapVsCodeColorsToTokens.test.ts` 测试用例:校验 21 个 preset 的 `syntax` / `diff` 字段非空,以及 dark/light 至少一个 preset 切换后代码 token 颜色发生变化。

## Capabilities

### New Capabilities

无。本次只增强现有 `settings-custom-theme-presets` capability。

### Modified Capabilities

- `settings-custom-theme-presets`: preset 数据从 21 套 UI surface 颜色升级为同时携带 syntax token 与 diff color。代码块、文件预览、文件树缩略预览、diff viewer、session activity 命令输出、diff 行级配色 MUST 跟随当前 preset 派生;`prefers-color-scheme` / `:root[data-theme]` 作为 fallback 兜底。

## Impact

- Affected code:
  - `src/features/theme/constants/vscodeThemePresets.ts` — 加 syntax / diff 字段,21 个 preset 全部
  - `src/features/theme/utils/mapVsCodeColorsToTokens.ts` — 派生新变量
  - `src/styles/{messages.part2,file-view-panel,file-tree,diff-viewer,session-activity,composer.rewind-modal,tool-blocks}.css` — consumer 优先读取 preset override
  - `src/styles/themes.light.css` / `src/styles/themes.dark.css` — 新变量 fallback
  - `src/features/settings/components/settings-view/sections/{BasicAppearanceSection,SyntaxAndDiffPreview}.tsx` — 外观设置实时预览
  - `src/styles/settings.part3.css`、`src/i18n/locales/{zh,en}/settings.ts` — 预览样式与文案
  - `src/features/theme/utils/mapVsCodeColorsToTokens.test.ts` — 测试覆盖
- APIs: 无新增公开 API;`VsCodeThemePresetDefinition` 类型扩展向后兼容(新增 optional 字段)。
- Dependencies: 无新增。
- Compatibility: 现有 21 个 preset 数据 schema 不变(`syntax` / `diff` 字段新增但 optional),后端 sanitize 路径不动;dark/light fallback 保留,任何 preset 数据缺失时退回到当前观感。

## 目标与边界

- 目标: 切换到任意 preset 时,Markdown 代码块、文件预览、文件树缩略、diff viewer、session activity 命令输出、diff 行级加/减配色都按 preset 派生;`prefers-color-scheme` + `:root[data-theme]` 仍提供 fallback。
- 边界:
  - 8 类 token 粒度(`keyword / string / comment / number / function / operator / type / tag`),与现有 Prism `token.*` 命名映射一致,不对齐 VSCode `tokenColors.scope` 文法(避免引入全量 scope 解析)。
  - 仅扩展 mapper 派生层和 preset 数据;不动 Prism 解析、不动 Markdown 渲染结构、不动 file-view 组件结构。
  - 终端 ANSI 16 色不在本 change 内(独立 change)。

## 非目标

- 不重写 VSCode `tokenColors.scope` 文法解析;直接用语义化 8 类 hex。
- 不引入 Shiki / Monaco;继续使用 `src/utils/syntax.ts` 的 Prism。
- 不改 diff 算法;只改 diff 的颜色绑定。
- 不改既有 preset label；只新增实时预览需要的 zh/en 文案。
- 不改 backend / IPC / settings sanitize 路径。

## 方案取舍

1. **选择: 直接给 preset 加 8 类 syntax + 2 类 diff 字段**,由 mapper 直接读取派生 CSS 变量。
   - 优点: 数据 schema 简单,与现有 21 套 preset 的 VSCode 官方 theme token 一一对应,可读性高。
   - 替代: 引入 VSCode 完整 `tokenColors.scope` 文法(scope 前缀 / 后缀匹配)。拒绝原因: scope 文法解析代码量大、本次只关心 8 类视觉语义、剩余 scope 通过 8 类 fallback 兜底已足够。

2. **选择: 保留现有 5 套代码 token 命名空间，并增加稳定的 preset override namespace**,不统一重命名为 `--code-token-*`。
   - 优点: 历史 fallback 不变；`--theme-syntax-*` / `--theme-diff-*` 从 root 继承，动态挂载节点无需 DOM 扫描。
   - 替代: 统一为单一 `--code-token-*` 命名空间。拒绝原因: 5 个入口(file-tree 缩略预览 / file-view 文件预览 / diff viewer / session activity / markdown)分别有独立的 CSS 上下文(`.file-preview-line-text` / `.fvp-line-text` / `.diff-line-content` / `.session-activity-preview-text` / `.markdown-codeblock`),合并会扩大 css 改动面且无法体现各自独立的 fallback 历史观感。

3. **选择: preset 字段声明为可选**,缺失时由 themes.light.css / themes.dark.css 兜底。
   - 优点: 兼容迁移期;未来新增 preset 可以只填部分字段。
   - 替代: 强制要求所有 preset 填齐 syntax + diff 8 + 2 字段。拒绝原因: 现有 21 个 preset 是 curated,迁移期容错更稳。

## 验收标准

- 切到 `vscode-catppuccin-mocha`,Markdown 代码块、文件预览、文件树缩略预览、diff viewer 的代码 token MUST 与 preset 数据对齐(`#cba6f7` keyword / `#a6e3a1` string / `#6c7086` comment / `#fab387` number / `#89b4fa` function / `#94e2d5` operator / `#f9e2af` type / `#f38ba8` tag)。
- 切到 `vscode-github-light`,对应 MUST 与 preset 数据对齐(`#cf222e` keyword / `#0a3069` string / `#6e7781` comment / `#0550ae` number / `#8250df` function / `#24292f` operator / `#953800` type / `#116329` tag)。
- 切到任意 preset,`--diff-inserted-text` / `--diff-removed-text` MUST 等于 preset 的 `diff.inserted` / `diff.removed` hex 值;`--diff-inserted-bg/gutter` / `--diff-removed-bg/gutter` MUST 由这两个 hex 值通过 `withAlpha(0.11 / 0.16)` / `withAlpha(0.34 / 0.44)` 派生。
- `file-tree.css` 的 8 个 `.token.*` 选择器 MUST 使用 `var(--file-preview-token-*)`,不再出现直接硬编码 hex。
- 持久化 `customThemePresetId` 缺失或字段缺失时,MUST 退回到当前 :root dark/light fallback,不出现空值或抛错。
- focused Vitest(`mapVsCodeColorsToTokens.test.ts`)、`npm run lint`、`npm run typecheck`、`openspec validate --all --strict --no-interactive` 全部通过。
- 跨大型文件治理: `diff.css` / `messages.part2.css` 等已是 large-file sentry 目标文件,改动 SHOULD 保持 scoped(只新增 / 修改少量 css 块),不进行大规模重排。
