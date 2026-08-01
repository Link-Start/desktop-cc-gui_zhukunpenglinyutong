## 1. Editor command bridge（P0）

- [x] 1.1 [依赖: 无] 输入现有 `selectParentSyntax` 与 editor ref，输出 `FileCodeMirrorEditorHandle.expandSelection()`；以 focused editor test 验证 selection 扩大和 focus。

## 2. Context menu discoverability（P0）

- [x] 2.1 [依赖: 1.1] 输入 file editor state 与 shortcut setting，输出可点击“扩大选择范围”menu item；以 `FileViewPanel.test.tsx` 验证 action、无 editor 时隐藏及 `null` shortcut 行为。
- [x] 2.2 [依赖: 无] 输入 optional shortcut string，输出 `RendererContextMenu` 独立 shortcut slot；以 shared component test 验证 label、shortcut 与 click handler。
- [x] 2.3 [依赖: 2.1] 输入 10 个 supported locales，输出 `files.expandSelection` 翻译并通过 i18n key parity test。

## 3. Scrollbar visual contract（P1）

- [x] 3.1 [依赖: 2.1] 输入 file editor context menu modifier class，输出隐藏 scrollbar chrome 且保留 `overflow-y: auto` 的 scoped CSS；以 visual contract test 验证 Firefox/WebKit rules。

## 4. Verification and closure（P0）

- [x] 4.1 [依赖: 1-3] 运行 touched-file Vitest、TypeScript、incremental ESLint、CSS contract、`git diff --check` 和 strict OpenSpec validation；记录结果，不运行 full suite。
- [x] 4.2 [依赖: 4.1] 执行 `openspec-verify-change`、同步 main specs，并归档 change。
