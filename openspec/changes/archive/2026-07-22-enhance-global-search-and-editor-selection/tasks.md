## 1. Search Matching And Ranking

- [x] 1.1 [P0, depends: none] 提取 deterministic fuzzy matcher，输入 query/candidate，输出 match score 或 no-match；用 focused unit tests 验证 exact/prefix/substring/subsequence、`fvp` 与 path separator。
- [x] 1.2 [P0, depends: 1.1] 将 file provider 接入 fuzzy matcher，输出保留原始 path 的 ranked `SearchResult`；运行 file provider focused tests。
- [x] 1.3 [P0, depends: 1.1] 为 `SearchResult` 增加 action identity，并让 shared comparator/group order 固定 action/file/session-navigation 优先于 message/history；运行 ranking 与 palette grouping tests。

## 2. App Action And Recent Discovery

- [x] 2.1 [P0, depends: 1.1,1.3] 建立最小 `SearchActionDescriptor` registry/provider，输入 existing action metadata/callback，输出 searchable action results；focused tests 覆盖中文/English keywords 和 stable id。
- [x] 2.2 [P0, depends: 2.1] 将设置、终端、Git、新建会话、最近活动、UI scale existing handlers 接入 global search selection；focused hook tests 验证每个 action 调用原 handler 且 palette 正确关闭。
- [x] 2.3 [P1, depends: 2.1] 增加 bounded recent action store，输入 action id/timestamp，输出最多 20 条 normalized entries；focused tests 覆盖 malformed storage、dedupe、unknown id 与无内容持久化。
- [x] 2.4 [P0, depends: 1.3,2.3] 复用 Quick Switcher recent files/session projection，生成 empty-query results，且不触发 message/history provider；focused tests 验证 scope、排序与 empty fallback。
- [x] 2.5 [P0, depends: 2.2,2.4] 扩展 SearchPalette action/recent labels、filters 与空 query rendering，保持 IME、leaf-local debounce 和 keyboard index；运行 SearchPalette focused tests。

## 3. Expand Selection Shortcut

- [x] 3.1 [P0, depends: none] 在 shared shortcut metadata、frontend defaults、i18n 与 Rust settings persistence 中增加 nullable editor-scoped expand-selection setting；运行 settings metadata 与单个 Rust round-trip test。
- [x] 3.2 [P0, depends: 3.1] 在 FileCodeMirrorEditor 显式 keymap 中按 configured shortcut 调用 `selectParentSyntax`，清空或 invalid setting 时不注册；focused tests 验证 Ctrl+W、普通 editable boundary 和 macOS Cmd+W 不回退。

## 4. Incremental Verification

- [x] 4.1 [P0, depends: 1.1-3.2] 运行 touched search、AppShell、settings、editor Vitest suites 与受影响 TypeScript check；不得运行全量 test suite，记录命令和结果。
- [x] 4.2 [P0, depends: 4.1] 运行 `openspec validate enhance-global-search-and-editor-selection --strict --no-interactive`，修正所有 change-local validation errors。
