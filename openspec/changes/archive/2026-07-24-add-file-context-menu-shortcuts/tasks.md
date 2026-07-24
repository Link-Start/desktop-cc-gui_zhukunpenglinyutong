## 1. Shortcut Contract

- [x] 1.1 [P0, depends: none] 增加 files feature-local fixed shortcut definitions；输入为已确认 IDEA mapping，输出为 menu/keymap/listener 共用常量；验证现有 `Cmd/Ctrl+W`、`Cmd/Ctrl+B`、`Alt+F7`、`Cmd/Ctrl+S` 未改变。
- [x] 1.2 [P0, depends: 1.1] 在 CodeMirror keymap 接入 Go to Implementations；输入为 `Cmd/Ctrl+Alt+B`，输出为既有 `runImplementationsFromCursor` callback；验证 editor focus 与 command precedence。

## 2. Context Menu And File View Bindings

- [x] 2.1 [P0, depends: 1.1] 为可执行 file content menu leaf 增加 platform-aware shortcut hint；输入为 configurable/fixed definitions，输出为与 action availability 一致的 label；验证 submenu trigger 不显示 shortcut。
- [x] 2.2 [P0, depends: 1.1] 在 FileViewPanel 接入 Reveal、Preview/Edit、Canvas、Note、File History 与 Git Blame scoped bindings；输入为当前 mode/callback/disabled state，输出为与 menu click 相同 side effect；验证 unavailable action no-op。
- [x] 2.3 [P1, depends: 2.1, 2.2] 保护普通 editable target 与动态 file state；输入为 keyboard event 与最新 action closure，输出为无 stale callback、无 input/dialog 抢占；验证切换 file/mode 后 behavior 收敛。

## 3. Verification

- [x] 3.1 [P0, depends: 1.2, 2.3] 增加 focused Vitest；覆盖 macOS/Windows label、keyboard trigger、existing binding preservation、disabled/no-op 与 submenu behavior。
- [x] 3.2 [P0, depends: 3.1] 运行 affected Vitest、`npm run typecheck` 与 targeted lint；输出为通过的 frontend gate evidence。
- [x] 3.3 [P1, depends: 3.2] 执行 changed-code review 与 `openspec validate add-file-context-menu-shortcuts --strict --no-interactive`；输出为无未处理 regression finding 的可验证变更。

## Verification Record

- Focused Vitest：5 files / 139 tests passed（single-worker，避免 shared CodeMirror mock 跨文件竞争）。
- TypeScript：\`npm run typecheck\` passed。
- ESLint：\`npm run lint\` passed。
- Diff hygiene：\`git diff --check\` passed。
- OpenSpec：strict validation passed。
- Existing shortcut sentinel：\`cmd+w\` defaults remain unchanged in settings、FileViewPanel and FileCodeMirrorEditorImpl。
- Converter regression：修复 \`toCodeMirrorShortcut()\` 将 normalized \`f1\`–\`f12\` 输出为 CodeMirror canonical uppercase；真实 \`Alt-F7\` keydown regression 覆盖 References，避免 menu formatter 正确但 executable keymap 漂移。
