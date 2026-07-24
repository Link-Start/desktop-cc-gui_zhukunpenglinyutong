## Context

21 个 curated VSCode 风格 preset 当前只携带 UI surface 颜色(`editor.background` / `editor.foreground` / `editorGutter.*` 等约 30 个 key)。`mapVsCodeColorsToTokens` 把这些 key 映射到约 130 个 CSS 变量,覆盖 sidebar / panel / popover / button / input / list / status / 等 UI 表面。但代码块和 diff 颜色走的是另一条独立路径:

- **5 套代码 token 命名空间**(共 40 个 CSS 变量):
  - `--message-code-token-*` (markdown codeblock)
  - `--fvp-token-*` (file-view 单文件预览)
  - `--diff-token-*` (diff viewer 内联)
  - `--session-activity-command-output-*` (session activity 命令输出)
  - `file-tree.css` 内的 `.file-preview-line-text .token.*` (硬编码 hex)
  - 这 5 套都靠 `:root[data-theme="light"]` 和 `prefers-color-scheme` 提供 dark/light fallback,**完全脱离 preset**。
- **`--diff-added-bg/-gutter/-text` / `--diff-deleted-bg/-gutter/-text`** 已经从 preset 的 `editorGutter.addedBackground` / `editorGutter.deletedBackground` 派生,但 mapper 走的是旧的 `editorGutter.*`,不是 VSCode 标准的 `diffEditor.insertedTextBackground` / `diffEditor.removedTextBackground`。Catppuccin Mocha 这类 preset 的 diff 配色就因此与 VSCode 实际表现不一致。

约束:
- 不重写 Prism 解析路径,不重写 Markdown 渲染结构。
- 不引入 Shiki / Monaco,继续使用 `src/utils/syntax.ts` 的 `highlightLine`。
- 复用现有 5 套 token 命名空间,不引入新的全局 `--code-token-*`(避免 css 大规模改写)。
- preset 字段 schema 向后兼容(`syntax` / `diff` 新增为 optional)。

## Goals / Non-Goals

**Goals:**
- 21 个 curated preset 全部携带 8 类 syntax hex + 2 类 diff hex。
- mapper 派生 46 个兼容变量和 15 个稳定 override 变量,全部由 preset 驱动。
- `file-tree.css` 的硬编码 hex 全部换成 `var(--file-preview-token-*)`。
- `themes.light.css` / `themes.dark.css` 给新变量写 fallback,保证 preset 数据缺失或迁移期不出现空值。
- 切 preset 时,Markdown 代码块、文件预览、文件树缩略预览、diff viewer、session activity 命令输出、diff 行级加/减配色**全部跟随**。

**Non-Goals:**
- 不解析 VSCode `tokenColors.scope` 文法;直接用语义化 8 类 hex。
- 不改终端 ANSI 16 色(独立 change)。
- 不改 diff 算法、不改既有 preset label、不动 backend / IPC。
- 不重命名现有 5 套命名空间。

## Decisions

### Decision: preset 数据扩展为 `syntax: SyntaxTokens` + `diff: DiffTokens`

`VsCodeThemePresetDefinition` 新增两个 optional 字段:

```ts
export type SyntaxTokens = {
  keyword: string;
  string: string;
  comment: string;
  number: string;
  function: string;
  operator: string;
  type: string;     // 覆盖 Prism .property / .constant / .symbol / .deleted
  tag: string;      // 单独覆盖 Prism .tag
};

export type DiffTokens = {
  inserted: string;
  removed: string;
};
```

21 个 preset 全部填齐,使用各 preset 对应 VSCode theme 的官方 hex 值(从 VSCode 仓库的 `*.color-theme.json` 抓取)。

Alternative: 解析 `tokenColors: Array<{ scope, settings }>` 全量语法。拒绝原因: scope 文法(scope 前缀匹配 + 多 scope 数组)解析代码量大,本次只关心 8 类视觉语义。

### Decision: mapper 输出 46 个兼容变量，并增加 15 个稳定 override 变量

`mapVsCodeColorsToTokens` 新增 helper `syntaxFor(preset)` 和 `diffFor(preset)`,输出:

```ts
{
  // markdown codeblock
  "--message-code-token-comment": syntax.comment,
  "--message-code-token-punctuation": syntax.operator,
  "--message-code-token-constant": syntax.type,
  "--message-code-token-number": syntax.number,
  "--message-code-token-string": syntax.string,
  "--message-code-token-operator": syntax.operator,
  "--message-code-token-keyword": syntax.keyword,
  "--message-code-token-function": syntax.function,

  // file-view 单文件预览
  "--fvp-token-comment": syntax.comment,
  "--fvp-token-punctuation": syntax.operator,
  "--fvp-token-property": syntax.type,
  "--fvp-token-number": syntax.number,
  "--fvp-token-string": syntax.string,
  "--fvp-token-operator": syntax.operator,
  "--fvp-token-keyword": syntax.keyword,
  "--fvp-token-function": syntax.function,

  // diff viewer 内联
  "--diff-token-comment": syntax.comment,
  "--diff-token-punctuation": syntax.operator,
  "--diff-token-property": syntax.type,
  "--diff-token-number": syntax.number,
  "--diff-token-string": syntax.string,
  "--diff-token-variable": syntax.operator,
  "--diff-token-keyword": syntax.keyword,
  "--diff-token-function": syntax.function,

  // session activity 命令输出
  "--session-activity-command-output-comment": syntax.comment,
  "--session-activity-command-output-punctuation": syntax.operator,
  "--session-activity-command-output-constant": syntax.type,
  "--session-activity-command-output-number": syntax.number,
  "--session-activity-command-output-string": syntax.string,
  "--session-activity-command-output-operator": syntax.operator,
  "--session-activity-command-output-keyword": syntax.keyword,
  "--session-activity-command-output-function": syntax.function,

  // file-tree 缩略预览(本次新接入)
  "--file-preview-token-comment": syntax.comment,
  "--file-preview-token-punctuation": syntax.operator,
  "--file-preview-token-property": syntax.type,
  "--file-preview-token-number": syntax.number,
  "--file-preview-token-string": syntax.string,
  "--file-preview-token-operator": syntax.operator,
  "--file-preview-token-keyword": syntax.keyword,
  "--file-preview-token-function": syntax.function,

  // diff 行级 — 替换原 editorGutter.* 派生路径
  "--diff-inserted-text": diff.inserted,
  "--diff-inserted-gutter": withAlpha(diff.inserted, isDark ? 0.44 : 0.34),
  "--diff-inserted-bg": withAlpha(diff.inserted, isDark ? 0.16 : 0.11),
  "--diff-removed-text": diff.removed,
  "--diff-removed-gutter": withAlpha(diff.removed, isDark ? 0.44 : 0.34),
  "--diff-removed-bg": withAlpha(diff.removed, isDark ? 0.16 : 0.11),
}
```

兼容变量合计为 `5×8 + 6 = 46`。此外输出 `--theme-syntax-{comment,punctuation,property,tag,number,string,operator,keyword,function}` 与 `--theme-diff-{inserted,removed}-{text,gutter,bg}` 共 15 个 override。consumer 使用 `var(--theme-*, var(--legacy-*))`，避免容器 scoped fallback 覆盖 root preset，也避免动态节点挂载后需要重新扫描 DOM。

> 注意: 现有的 `--diff-added-*` / `--diff-deleted-*` 保留，新增 `inserted/removed` 与 override 命名只承担 preset 语义，不删除旧消费契约。

Alternative: 用单一 `--code-token-*` 命名空间。拒绝原因: 5 个入口的 css 上下文独立且各自已有 fallback 历史观感,合并会扩大 diff.css / messages.part2.css 等已是 large-file sentry 目标文件的改动面。

### Decision: 8 类 token 命名映射固定

| 语义类 | Prism class | VSCode 语义 |
|---|---|---|
| keyword | .token.keyword, .token.atrule, .token.attr-value | `keyword` |
| string | .token.string, .token.char, .token.attr-name, .token.selector, .token.builtin, .token.inserted | `string` |
| comment | .token.comment, .token.prolog, .token.doctype, .token.cdata | `comment` |
| number | .token.number, .token.boolean | `number` |
| function | .token.function, .token.class-name | `function` |
| operator | .token.operator, .token.entity, .token.url, .token.variable, .token.punctuation | `operator` |
| type | .token.property, .token.constant, .token.symbol, .token.deleted | `type` |
| tag | .token.tag | `tag` |

8 类通过稳定 override namespace 显式映射；历史命名空间继续提供兼容 fallback。

### Decision: root override 替代 DOM container 扫描

R2 曾让 `useThemePreference` 在主题切换时 `querySelectorAll` 已挂载 token container 并写 inline style。该方案漏掉切换后新挂载的 file-view、diff 与 Settings preview。R3 保持 `useThemePreference` 只写稳定的 `document.documentElement` / `.app` target；所有 consumer 从 root 继承 `--theme-syntax-*` / `--theme-diff-*`，不存在时回退原 scoped token。无需 `MutationObserver` 或重复扫描。

### Decision: `themes.light.css` / `themes.dark.css` 给新变量写 fallback

```css
/* themes.dark.css :root 段新增 */
--message-code-token-comment: rgba(150, 170, 200, 0.78);
--message-code-token-punctuation: rgba(200, 210, 220, 0.85);
--message-code-token-constant: #ff7b72;
... (46 个兼容变量全部填默认 dark 兜底)
```

```css
/* themes.light.css :root[data-theme="light"] 段新增 */
:root[data-theme="light"] {
  --message-code-token-comment: rgba(74, 92, 118, 0.82);
  ...
}
```

兜底值与现有 4 套 css 文件(`messages.part2.css` / `file-view-panel-shell.css` / `diff-viewer.css` / `session-activity.css`)内置的 dark/light 默认值**完全一致**;`file-tree.css` 的硬编码 hex 直接迁移到 themes.dark.css 作为 fallback。

Alternative: 不写 fallback,仅靠 preset 派生。拒绝原因: 启动期 / preset 数据缺失 / 未来新增 preset 数据残缺时,5 套代码 token 会出现空值,直接破坏代码块可读性。

## Risks / Trade-offs

- [Risk] Catppuccin / One Dark Pro / Solarized 等 preset 的 syntax hex 需要从 VSCode 官方 `.color-theme.json` 抓取,抓错会导致 preset 与官方观感漂移 → 用 TS 单测锁定 hex 值,任何对 preset 数据的改动必须同步更新测试。
- [Risk] `file-tree.css` 的 fallback 颜色迁移到 `themes.dark.css` 后,light mode 仍需 fallback → 同时在 `themes.light.css` 加 light fallback(初始等于现有 4 套 css 的 light 默认值)。
- [Trade-off] 暂不消费 VSCode 完整 `tokenColors.scope` → 保留升级路径,后续 change 可在 preset 数据上叠加 scope 数组,mapper 解析增强。
- [Trade-off] `--diff-added/deleted-*` 和 `--diff-inserted/removed-*` 共存 → 短期保持兼容,后续 change 统一迁移到新命名。
- [Risk] CSS scoped fallback 会覆盖 root 继承值 → consumer 统一优先读取 `--theme-*` override，并用 focused CSS contract test 固化 file-view 链路。

## Migration Plan

1. 在 `vscodeThemePresets.ts` 的 `VsCodeThemePresetDefinition` 加 `syntax` / `diff` 两个 optional 字段,21 个 preset 全部填齐。
2. 在 `mapVsCodeColorsToTokens.ts` 新增 helper + 输出 46 个兼容变量和 15 个 override 变量。
3. 修改 `file-tree.css` 的 8 个 `.token.*` 选择器,把硬编码 hex 换成 `var(--file-preview-token-*)`。
4. 在 `themes.light.css` / `themes.dark.css` 给新变量写 fallback。
5. 扩展 `mapVsCodeColorsToTokens.test.ts`:
   - 校验每个 preset 都填齐 `syntax` 8 个字段 + `diff` 2 个字段
   - 校验至少一对 preset(dark + light)切换后 `--message-code-token-keyword` / `--diff-inserted-text` 发生变化
6. 接入实际 consumer 与外观设置实时预览，确保动态挂载节点直接继承 root override。
7. 运行 focused Vitest、targeted lint/typecheck、large-file sentry、目标 change strict validation。

Rollback 只需回退 mapper 输出与 `file-tree.css` 改动;preset 数据字段新增为 optional,旧数据兼容。

## Open Questions

无。
