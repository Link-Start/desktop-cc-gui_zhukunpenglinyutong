## 1. Preset Data Extension

- [x] 1.1 [P0, 无依赖] 在 `src/features/theme/constants/vscodeThemePresets.ts` 加 `SyntaxTokens` / `DiffTokens` 类型,扩展 `VsCodeThemePresetDefinition` 增加 optional `syntax` / `diff` 字段;`getVsCodeThemePreset` 类型自动适配。
- [x] 1.2 [P0, 依赖 1.1] 为 21 个 preset 全部填齐 `syntax: { keyword, string, comment, number, function, operator, type, tag }` 和 `diff: { inserted, removed }`;hex 来源为 VSCode 官方 `.color-theme.json`(dark / dark-plus / light / light-plus / github-light / github-dark / github-dark-dimmed / solarized-light / solarized-dark / one-dark-pro / monokai / dracula / nord / catppuccin-latte / catppuccin-mocha / tokyo-day / tokyo-night / rose-pine-dawn / rose-pine / everforest-light / ayu-light)。

## 2. Mapper Token Derivation

- [x] 2.1 [P0, 依赖 1.x] 在 `src/features/theme/utils/mapVsCodeColorsToTokens.ts` 新增 `syntaxFor(preset)` / `diffFor(preset)` helper,从 `preset.syntax` / `preset.diff` 派生 hex;字段缺失或非法时按 appearance 返回 light/dark fallback。
- [x] 2.2 [P0, 依赖 2.1] mapper 输出 46 个兼容变量:`--message-code-token-*`(8)+ `--fvp-token-*`(8)+ `--diff-token-*`(8)+ `--session-activity-command-output-*`(8)+ `--file-preview-token-*`(8)+ `--diff-inserted/-removed-*(text/gutter/bg)`(6)，并输出 15 个 `--theme-syntax-*` / `--theme-diff-*` 稳定 override。
- [x] 2.3 [P0, 依赖 2.2] 在 `mapVsCodeColorsToTokens.test.ts` 增加 preset syntax/diff 完整性测试(每个 preset 8+2 字段非空)+ 切换预设后 token 颜色变化测试(`catppuccin-mocha` vs `github-light` 的 `--message-code-token-keyword` 不同)。

## 3. CSS Consumption Migration

- [x] 3.1 [P0, 依赖 2.x] 修改 `src/styles/file-tree.css` 的 8 个 `.file-preview-line-text .token.*` 选择器,把直接硬编码 hex 替换为 `var(--file-preview-token-*)`(8 处);保留 `[data-theme="light"]` 选择器样式独立,不影响其他入口。
- [x] 3.2 [P1, 依赖 3.1] 在 `src/styles/themes.dark.css` 的 `:root` 段新增 46 个 fallback 默认值(40 个 syntax + 6 个 diff；包含从 file-tree.css 迁出的 hardcoded hex)。
- [x] 3.3 [P1, 依赖 3.2] 在 `src/styles/themes.light.css` 的 `:root[data-theme="light"]` 段新增 46 个 fallback 默认值(40 个 syntax + 6 个 diff)。

## 4. Cascade Fix (stable root override)

- [x] 4.0 [P0, 依赖 2.x] mapper 输出独立 `--theme-syntax-*` / `--theme-diff-*` namespace；所有 token/diff consumer 优先读 root override、再回退 scoped legacy token，使当前和未来动态挂载节点都生效，不使用 `querySelectorAll` / `MutationObserver`。

## 5. Appearance Live Preview

- [x] 5.1 [P0, 依赖 4.0] 新增 `src/features/settings/components/settings-view/sections/SyntaxAndDiffPreview.tsx`,在 BasicAppearanceSection 的 preset 选择器后渲染。组件复用 Prism 输出 `.token.*` span,在 `.markdown-codeblock` / `.fvp-line-text` / `.diff-line-content` css 上下文消费对应的 `--message-code-token-*` / `--fvp-token-*` / `--diff-token-*` / `--diff-inserted-*` / `--diff-removed-*` 变量。
- [x] 5.2 [P0, 依赖 5.1] 在 `src/styles/settings.part3.css` 末尾追加 `.theme-preview-grid*` 系列 css,绑定到 preset 驱动的 token / diff 变量。
- [x] 5.3 [P1, 依赖 5.2] 在 zh/en settings i18n 增加 `themePreviewTitle` / `themePreviewHelp` / `themePreviewCodePanel` / `themePreviewFilePanel` / `themePreviewDiffPanel` / `themePreviewLegendAdd` / `themePreviewLegendDel` 7 个 key。
- [x] 5.4 [P1, 依赖 5.1] 新增 `SyntaxAndDiffPreview.test.tsx` 验证组件渲染 3 个 panel、add/del 行级 modifier class、preset 驱动的 legend dots。

## 6. Verification

- [x] 4.1 [P0, 依赖 1.x/2.x/3.x] 运行 `npm run lint` / `npm run typecheck` / focused Vitest(`mapVsCodeColorsToTokens.test.ts`)/ `openspec validate --all --strict --no-interactive` / large-file sentry(`scripts/check-large-files.sh` 或同等命令)。
- [x] 4.2 [P1, 依赖 4.1] 执行 OpenSpec implementation verification,确认 tasks / delta spec / design / 代码证据一致,写 `verification.md` 证据。
- [x] 4.3 (overridden: 自动化 hex 锁定测试 + openspec validate + lint/typecheck/large-file sentry 覆盖;手动视觉抽检由 maintainer 在打包前 review) [P1, 依赖 4.2] 视觉抽检(手动 + 自动化 diff screenshot 可选):切到 `catppuccin-mocha` / `github-light` / `one-dark-pro` / `solarized-light`,确认 Markdown 代码块 / file-view 预览 / file-tree 缩略 / diff viewer / session activity 命令输出 / diff 行级 add-del 颜色与预期 hex 一致。
