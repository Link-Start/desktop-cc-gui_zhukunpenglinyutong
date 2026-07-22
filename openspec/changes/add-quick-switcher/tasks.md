## 1. Recent Context Model

- [x] 1.1 [P0, depends: none] 实现 workspace-scoped recent-file normalization、merge、delete、30-item trim 与 client-store persistence；输入为 user-open/AI activity facts，输出为倒序 MRU，并以 focused unit tests 验证 malformed、dedupe、limit、delete。
- [x] 1.2 [P0, depends: 1.1] 接入 central file open/activation 与 completed Session Activity file-change facts；输出为实时 recent-file 更新，并以 focused hook/model tests 验证 read-only exclusion、AI marker、single-batch write。
- [x] 1.3 [P1, depends: none] 实现 canonical `ThreadSummary[]` recent-session projection；最终由 5.1 扩展为跨 workspace 全局 top 30 分组，并以 focused unit tests 验证排序和 limit。

## 2. Quick Switcher Interface

- [x] 2.1 [P0, depends: 1.1, 1.3] 实现 lazy-loaded Quick Switcher component、完整 icons、分层 section、bounded scroll、empty states 与 theme-token CSS；以 component tests 验证结构、数量、icon、无 search input。
- [x] 2.2 [P0, depends: 2.1] 实现 pane/row keyboard model、initial previous-context selection、overlay dismiss 与 accessible labels；以 component tests 验证 arrows、Enter、Esc、listener cleanup。
- [x] 2.3 [P0, depends: 2.1] 将 navigation/session/file row 激活接入既有 App Shell callbacks，确保 session switch 保留 editor split、file open 使用现有路径；以 focused boundary tests 验证 callback payload 和 close behavior。

## 3. Entry And Integration

- [x] 3.1 [P0, depends: 2.2] 在 `⌘O` Global Search icon 旁增加 Quick Switcher icon 与 `⌘E` / `Ctrl+E` shortcut，desktop-only；以 titlebar/shortcut tests 验证入口、tooltip、compact exclusion 与快捷键冲突隔离。
- [x] 3.2 [P1, depends: 2.1, 3.1] 补齐 lazy view、feature style loader 和中英文 i18n；验证关闭状态不挂载 panel 且现有 Search Palette 不变。

## 4. Focused Verification

- [x] 4.1 [P0, depends: 1.1-3.2] 运行 Quick Switcher、titlebar、shortcut、recent-model 相关 focused Vitest suites；不运行全量测试。
- [x] 4.2 [P0, depends: 4.1] 运行 touched-file targeted ESLint、项目 typecheck、large-file sentry 与 `openspec validate add-quick-switcher --strict --no-interactive`，记录结果和任何既有无关失败。
- [x] 4.3 [P1, depends: 4.2] 完成 diff 审计，确认只包含本 change 文件；保留 manual desktop visual QA 为用户最终验收项，不擅自提交或归档。

## 5. Workspace-grouped Three-column Revision

- [x] 5.1 [P0, depends: 1.1, 1.3] 将 session/file projection 扩展为跨 workspace 全局 top 30 后分组，workspace group 与组内 item 均按最新时间倒序；补 pure model tests。
- [x] 5.2 [P0, depends: 5.1] 将 modal 改为 navigation / sessions / files 三栏并行布局，两个 recent pane 独立滚动并显示 workspace heading；重构三栏 keyboard selection tests。
- [x] 5.3 [P0, depends: 5.2] 为快速导航增加意图画布、项目地图，并让 Spec Hub/视觉工具复用 `useAppShellLayoutNodesSection` 中的 canonical actions；补 focused action wiring tests。
- [x] 5.4 [P0, depends: 5.1-5.3] 运行相关增量 Vitest、targeted ESLint、typecheck、AppShell contract 与 OpenSpec strict validation；不运行全量测试。
