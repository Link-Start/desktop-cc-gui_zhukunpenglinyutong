## 1. Contract

- [x] 1.1 [P0, depends: none] 固化 proposal：内置 skills_hub 后端、vendored skills 页面范围、transport 适配、Settings SkillsSection 下线、大列表 windowing 与 sticky 批量操作、验收口径。（追溯：2026-07-25 随 `b1d94a930` 合入后补记）

## 2. Backend（Rust skills_hub）

- [x] 2.1 [P0, depends: 1.1] 新增 `src-tauri/src/skills_hub.rs`（移植自 upstream skills-manager）：`skills_hub_query` / `skills_hub_mutate` 两个 `#[tauri::command]`，响应/错误形状与 upstream HTTP endpoint 1:1；覆盖 installed/discover/popular/search/repos/usage 查询与 install/uninstall/delete/restore/import/set-targets/repo-add/remove/check-updates 变更。
- [x] 2.2 [P0, depends: 2.1] `command_registry.rs` 注册 2 个 command；`lib.rs` 挂模块；`cargo check` 通过。

## 3. Vendor skills 页面

- [x] 3.1 [P0, depends: 1.1] vendor `pages/SkillsPage.jsx`（My Skills / 发现 / 安装 / 更新 / 目标引擎）、`pages/SkillDetailPanel.jsx`、`components/LocalOnlyNotice.jsx`、`ui/components/`（ConfirmModal / DismissibleHint / Input / Toast）、ProviderIcon 扩展与 `assets/brand-logos/`（claude-code / codex / gemini / opencode / antigravity）。
- [x] 3.2 [P0, depends: 3.1] `lib/skills-api.ts` transport 适配：Tauri runtime 走 `invoke("skills_hub_query"/"skills_hub_mutate")`（force 显式字符串化保持 upstream 语义），浏览器 dev preview 回退 `/tt-dev` proxy；新增 `tokentracker-dashboard-modules.d.ts` 类型声明。

## 4. Integration（Extensions + Settings 收敛）

- [x] 4.1 [P0, depends: 2.2, 3.2] 新增 `SkillsDashboardSection.tsx` / `TokenTrackerSkillsView.tsx` / `TokenTrackerServerGate.tsx` / `hooks/useTokenTrackerViewBridge.ts`：locale/theme 桥接 + remount key，`React.lazy` 隔离 vendored 页面依赖；无 CLI 安装门控。
- [x] 4.2 [P0, depends: 4.1] `ExtensionsView.tsx` 接入 Skills section；`CuratedSection.tsx` 微调。
- [x] 4.3 [P0, depends: 4.1] 下线 Settings 旧 `SkillsSection.tsx`（约 1289 行）与测试；Settings 仅保留 curated skills；清理 10 个 locale `settings` namespace 旧 skills 文案。

## 5. 大列表性能（perf(skills)）

- [x] 5.1 [P0, depends: 3.1] My Skills 超过阈值（80 行）后基于扩展滚动容器计算可见区间做 row windowing（固定行高 88px、overscan 8、固定高度列表容器）。
- [x] 5.2 [P1, depends: 3.1] 批量操作栏 sticky 于扩展 tab 行之下；bulk remove 显式 destructive 样式；`extensions.css` 增补共享 sticky offset。

## 6. Tests

- [x] 6.1 [P0, depends: 4.1] `SkillsDashboardSection.test.tsx`、`SkillsPage.test.tsx`（渲染 / 交互 / sticky 批量操作 / windowing 回归）。
- [x] 6.2 [P0, depends: 4.2, 4.3] 更新 `ExtensionsView.test.tsx`、`SettingsView.test.tsx`；`extensions-layout.test.ts` 覆盖 sticky offset CSS。

## 7. Verification

- [x] 7.1 [P0, depends: 6.x] focused Vitest、lint、typecheck、`check:large-files`（vendored 大文件走 new-file baseline 豁免）通过。
- [x] 7.2 [P1, depends: 7.1] OpenSpec strict validation 通过；归档时同步 `skills-hub-management` 主 spec 并回填 `extensions-management-surface` / `curated-skill-bundles` delta。

## Verification Record

- Commits: `b1d94a930` feat: skills（2026-07-25）、`c75922dec` perf(skills): keep large skill lists responsive（2026-07-25）。
- `c75922dec` commit message 记录：SkillsPage sticky bulk action 与 virtualized list 测试通过；extensions layout sticky offset CSS 测试通过；Confidence: high；Scope-risk: narrow。
- 本提案为追溯补记，行为事实以两个 commit 与仓库当前代码为准。
