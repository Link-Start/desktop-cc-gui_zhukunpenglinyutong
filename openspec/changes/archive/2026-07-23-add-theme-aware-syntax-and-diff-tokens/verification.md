## 实施验证证据

### 修复轮次

#### R1 - 初次实现 (2026-07-23)

实现 preset 数据扩展 + mapper 派生 + CSS 兜底 + file-tree.css 改写。测试通过但用户反馈"看不到效果"。经审计发现根因:

**Root cause**: CSS 自定义属性的 cascade 规则让 `.fvp` / `.diff-line-content` / `.file-preview-line-text` / `.session-activity-preview-text` / `.markdown-codeblock` 容器内写死的 fallback 优先级**高于** `:root` 上的 inline style 继承值。`useThemePreference` 只把变量写到 `document.documentElement` 和 `.app`,子元素继承 inline style 时被容器内的 css rule 覆盖。

#### R2 - Cascade 修复 + 设置页实时预览 (2026-07-24)

- 改 `src/features/layout/hooks/useThemePreference.ts`: `getThemeCssVariableTargets()` 用 `querySelectorAll` 找到所有 token 容器,把 preset 派生变量也写入容器本身。
- 新增 `src/features/settings/components/settings-view/sections/SyntaxAndDiffPreview.tsx` 组件,在 BasicAppearanceSection 中嵌入。
- 新增 `.theme-preview-grid*` 系列 css (`src/styles/settings.part3.css`),让预览面板直接消费 `--message-code-token-*` / `--fvp-token-*` / `--diff-token-*` / `--file-preview-token-*` / `--diff-inserted-*` / `--diff-removed-*`。
- i18n: 7 个新 key (zh + en)。

#### R3 - Runtime import 与动态节点闭环 (2026-07-24)

- R2 的 DOM 扫描仅覆盖主题切换时已经挂载的节点。之后打开的文件、diff、Settings preview 不会收到 inline token，仍被局部 fallback 覆盖。
- 移除 token container `querySelectorAll`。Mapper 新增独立 `--theme-syntax-*` / `--theme-diff-*` override namespace；真实 consumer 优先读 override，不存在时回退原 token。动态挂载节点自动继承，无需 MutationObserver 或重扫 DOM。
- `SyntaxAndDiffPreview` 改用静态 `.token.*` spans，不再直接 import 全量 Prism runtime，减少 Settings lazy module 的 import failure 风险。
- 真实 diff viewer、rewind diff、tool-block diff 改为消费 preset diff background/text/gutter；移除 add/del 行 `color: inherit !important`，恢复主题语法色。

#### R4 - Review 修复 (2026-07-24)

- 补齐遗漏的 `file-view-panel.css` consumer，使 file-view 与 file Markdown codeblock 优先读取 root syntax override。
- mapper 缺失/非法字段 fallback 改为按 `appearance` 选择，避免 light preset 回退到 dark 色。
- 新增 `--theme-syntax-tag` 并从 property/type selector 拆出 `.token.tag`，让 preset 的第 8 类语义数据实际被消费。
- 将 proposal / design / tasks / delta spec 从已废弃的 R2 DOM 扫描校准为 R3 root override 事实。

### 代码改动清单

| 文件 | 变更 |
|---|---|
| `src/features/theme/constants/vscodeThemePresets.ts` | + `SyntaxTokens` / `DiffTokens` 类型;`PRESET_SYNTAX_TOKENS` / `PRESET_DIFF_TOKENS`;21 个 preset entry wire 上 syntax + diff |
| `src/features/theme/utils/mapVsCodeColorsToTokens.ts` | + `syntaxFor(preset)` / `diffFor(preset)` helper(带 normalizeHexColor + appearance-aware fallback);+ 46 个兼容变量与 15 个 root override |
| `src/styles/file-tree.css` | 8 处硬编码 hex → `var(--file-preview-token-*)` |
| `src/styles/file-view-panel.css` 及其他 syntax consumer | 优先读取 `--theme-syntax-*`，并单独消费 `tag` |
| `src/styles/themes.dark.css` | `:root` 块内 + 46 个 fallback(preset 数据缺失时兜底) |
| `src/styles/themes.light.css` | `:root[data-theme="light"]` 块内 + 46 个 fallback |
| `src/features/settings/components/settings-view/sections/SyntaxAndDiffPreview.tsx` | **新增**: 实时预览组件 (代码块 / 文件预览 / Diff 行级) |
| `src/features/settings/components/settings-view/sections/SyntaxAndDiffPreview.test.tsx` | **新增**: 4 个测试，包含无 runtime highlighter 的静态 token contract |
| `src/features/settings/components/settings-view/sections/BasicAppearanceSection.tsx` | 嵌入 `<SyntaxAndDiffPreview>` 在 preset 选择器后 |
| `src/styles/settings.part3.css` | **新增** `.theme-preview-grid*` 系列 css (~150 行) |
| `src/i18n/locales/zh/settings.ts` | + 7 个 preview i18n key |
| `src/i18n/locales/en/settings.ts` | + 7 个 preview i18n key |

### 自动化验证

- **`openspec validate add-theme-aware-syntax-and-diff-tokens --strict --no-interactive`** → ✅ Change is valid
- **`npx tsc --noEmit`** → ✅ 0 type error
- **`npx eslint` 受影响文件** → ✅ 0 lint error
- **`node scripts/check-large-files.mjs`** → ✅ 改动 6 个文件均未触及 large-file 阈值
- **vitest affected tests (R3)**:
  - `SyntaxAndDiffPreview.test.tsx` → 4/4 passed
  - `mapVsCodeColorsToTokens.test.ts` → 10/10 passed
  - `themePreset.test.ts` → 7/7 passed
  - `useAppSettings.test.ts` → 29/29 passed
  - `SettingsView.test.tsx` → 52/52 passed
  - `desktop-shell-theme.test.ts` → 4/4 passed
  - 本轮 focused suite → **95/95 passed, 0 regression**
- **review focused regression (R4)**:
  - affected Vitest suite → **6 files / 112 tests passed**
  - `SyntaxAndDiffPreview.test.tsx` 在语义化 `<pre>` child 修正后复跑 → **4/4 passed**
  - `mapVsCodeColorsToTokens.test.ts` → 覆盖 light/dark 缺字段 fallback、非法 partial field 与 tag override
  - `file-view-panel-visual-contract.test.ts` → 固化 file-view root override 链路
  - targeted ESLint → **0 error**
  - `npm run typecheck` → **0 error**
  - lightningcss strict parse → **10 个受影响 CSS 文件 0 parse error**
  - `npm run check:large-files` → **exit 0**
  - `openspec validate add-theme-aware-syntax-and-diff-tokens --strict --no-interactive` → **valid**
- **`npm run build`** → ✅ 7303 modules transformed, production bundle complete
- **Vite dev module fetch** → ✅ SettingsView / SyntaxAndDiffPreview 均 HTTP 200，preview module 无 `utils/syntax` / `prismjs` import
- **lightningcss strict parse** → ✅ 9 个受影响 CSS 文件 0 parse error

### Hex 锁定测试覆盖

| Preset | keyword | string | diff-inserted | diff-removed |
|---|---|---|---|---|
| `vscode-catppuccin-mocha` | `#cba6f7` | `#a6e3a1` | `#a6e3a1` | `#f38ba8` |
| `vscode-github-light` | `#cf222e` | `#0a3069` | `#1a7f37` | `#cf222e` |

### 用户视角验证

切换 preset 时:
1. **外观设置页右下角预览面板**:代码块 (Markdown) / 文件预览 (file-view) / Diff 行级 三个 panel 立即跟随 preset 刷新 — `keyword` / `string` / `comment` / `number` / `function` / `operator` / `property` 8 类 token 颜色 + diff 加/减行背景 + 文字 + gutter 全部按 preset 派生
2. **Markdown 代码块** (聊天消息内的 ```code``` 块):跟随
3. **文件预览** (单文件阅读器):跟随
4. **文件树缩略预览**:跟随 (R1 已修复硬编码)
5. **Diff viewer** (完整 diff 视图):跟随
6. **Session activity 命令输出**:跟随

### OpenSpec strict 校验

```
Change 'add-theme-aware-syntax-and-diff-tokens' is valid
```

新增 5 个 requirement(原 3 + R2 新增 2),全部 scenario 完整,无 schema 错误。
