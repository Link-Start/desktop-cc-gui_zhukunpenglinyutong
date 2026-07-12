## 1. Baseline Reconstruction

- [x] 1.1 [P0, 无依赖] 输入 unified patch 与 working source，输出可验证的 previous-version source；为 add/delete/context/malformed cases 增加 pure helper tests

## 2. Editable Compare Surface

- [x] 2.1 [P0, 依赖 1.1] 输入 workspace file document state 与 reconstructed baseline，输出左只读/右可写 CodeMirror 双栏及差异行对齐、同步滚动、difference navigation
- [x] 2.2 [P0, 依赖 2.1] 将 `WorkspaceEditableDiffReviewSurface` 从 mode toggle 改为 eligibility-driven compare/fallback，并保留 save refresh、dirty guard、annotation 与 modal close contract
- [x] 2.3 [P1, 依赖 2.2] 更新 i18n 与 responsive CSS，稳定显示左栏“上个版本”、右栏“源代码”，并覆盖 desktop/narrow layout
- [x] 2.4 [P0, 依赖 2.3] 保留原 `GitDiffViewer` 弹窗控制壳和四种查看组合，默认 `split + all` 组合可编辑 compare，并修复 horizontal grid layout
- [x] 2.5 [P0, 依赖 2.4] 显式设置 `--file-compare-column-count: 2`，消除 lazy stylesheet 加载顺序导致的上下布局回退
- [x] 2.6 [P0, 依赖 2.5] 使用共享 `UnsavedChangesDialog` 替换 Diff 编辑链路原生 `window.confirm`，并消除 parent/child double prompt
- [x] 2.7 [P0, 依赖 2.6] 为未保存弹窗增加异步“保存并关闭”，保存成功后才关闭或执行待切换动作
- [x] 2.8 [P0, 依赖 2.7] baseline reconstruction 改用最后已保存内容，保证 cached dirty draft 重开后仍为可编辑双栏
- [x] 2.9 [P0, 依赖 2.8] 为 `GitDiffPanel` 增加 `useFeatureStylesReady(loadDiffStyles)` boundary，阻止侧栏 Git 入口在 CSS ready 前渲染裸 DOM
- [x] 2.10 [P0, 依赖 2.9] 修正 `loadGitHistoryStyles()` 的样式依赖图，复用 `loadDiffStyles()` 以覆盖 worktree file actions 与 diff modal

## 3. Verification

- [x] 3.1 [P0, 依赖 2.3] 增加 focused component tests，验证默认可编辑右栏、左栏只读、保存刷新、dirty guard 与不可编辑 fallback
- [x] 3.2 [P0, 依赖 3.1] 执行 OpenSpec strict validation、focused Vitest、typecheck、lint，并启动本地 dev server 完成人工测试准备
- [x] 3.3 [P0, 依赖 2.4] 回归验证旧 Toolbar、renderer mode switching、horizontal layout 与 editable save/dirty contract
- [x] 3.4 [P0, 依赖 2.6] 验证 custom dialog 的继续编辑、放弃修改、overlay/close/mode switching 与 no-native-confirm contract
- [x] 3.5 [P0, 依赖 2.8] 回归验证保存并关闭 success/failure，以及“编辑 -> inline preview -> 重开 modal”的草稿恢复与连续交互
- [x] 3.6 [P0, 依赖 2.9] 验证 styles pending 时 `GitDiffPanel` 不渲染业务 DOM，ready 后正常渲染，并重跑 focused tests/build
- [x] 3.7 [P0, 依赖 2.10] 验证 `GitHistoryPanel` 冷启动独立请求 shared diff styles，无需 `GitDiffPanel` warm-up

## 4. Pre-Commit Hardening

- [x] 4.1 [P0] 修复保存后 dirty 派生、clean-cache refresh 覆盖草稿与 in-flight save 新输入竞态，并补 hook tests
- [x] 4.2 [P0] 将 save-in-flight 状态贯通共享未保存弹窗，并让 Git 文件列表刷新复用 dirty close guard
- [x] 4.3 [P1] defer editable diff alignment，并为隐藏 `GitDiffViewer` 增加 toolbar-only no-render/no-fetch 快路径
- [x] 4.4 [P0] 补充 focused regression tests，执行 typecheck、lint、build 与 OpenSpec strict validation
