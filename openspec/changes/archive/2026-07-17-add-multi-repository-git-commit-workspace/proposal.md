## Why

多 Git repository workspace 当前存在两类 identity 错配：文件树右键“更新”虽然携带目标 `repositoryRoot`，却会因全局 selected repository 尚未建立而提前返回；Git 提交面板则只加载 configured/selected repository，导致其他 dirty child repositories 不可见且无法安全 stage/commit。现在需要把 Git 操作 identity 从单一 `workspaceId` 收敛为 `workspaceId + repositoryRoot`，同时保持 single-repository workspace 的既有轻量体验。

## 目标与边界

- single-repository workspace 继续使用既有单组提交形态，不增加无意义的 repository group chrome；single/multi 都统一为 changed files 在上、commit composer 吸底。
- multi-repository workspace 同时显示所有 dirty repositories，并按 repository 分组展示 branch、文件数量和 changed files。
- status、stage、unstage、commit、push、pull、sync、update 等 mutation 必须显式绑定目标 `repositoryRoot`。
- 多 repository selection 使用同一提交信息，但每个 repository 生成独立 commit；执行过程允许 partial success，并逐 repository 反馈。
- 底部 Git History 在 multi-repository workspace 中提供 repository picker，切换历史目标不得改变主窗口 active workspace。
- 保持旧调用未传 `repositoryRoot` 时使用 configured Git root 的兼容语义。

## 非目标

- 不实现跨 repository atomic transaction；Git 本身不提供该语义。
- 不把多个 repository 合并为虚构 working tree；Git History 沿用既有 command family，并补充 optional `repositoryRoot` scope。
- 不引入新的秒级 polling、AppShell 根级高频数组 state 或第三方依赖。
- 不自动回滚已经成功创建的 commit。

## What Changes

- 修复 repository-scoped branch update，使显式 `repositoryRoot` 不再依赖全局 selected repository 才能执行。
- 为 Git read/write bridge 增加 optional `repositoryRoot`，并在 Rust command boundary 验证其属于 workspace 内已发现的 repository。
- 新增 workspace Git status orchestration：multi-repository 并行加载、stale response rejection、partial failure isolation。
- Git 提交面板新增自适应 single/multi repository view model；multi 模式按 repository group 展示并隔离选择。
- 多仓库 commit/commit-and-push 按稳定 repository 顺序执行，保留失败 repository 的选择并展示 repository-level result。
- single/multi commit panel 统一将 changed-file surface 放在上方并滚动，将 commit composer 固定在 panel 底部。
- Git History repository picker 复用 existing `repositoryRoot` resolver，并以独立 history repository state 切换子 repository；不注册 child workspace，也不修改主 active workspace。
- Git History 保留 existing workspace/worktree picker 作为第一层；仅在当前 History workspace 存在多个 repositories 时显示第二层 repository picker，禁止用子仓列表替换旧根结构。
- single/multi commit composer 复用同一 AI generation affordance；multi mode 按 `repositoryRoot + selectedPaths` 聚合 scoped diffs，避免图标恢复后仍从错误 Git root 生成 message。
- 增加 frontend、service mapping、Rust isolation、single/multi UI 与 partial failure 回归测试。

## 方案比较与取舍

### 方案 A：仅多组展示，一次只允许提交一个 repository

改动较小且沿用单 repository controller，但用户仍需手工切换，无法完成参考 UI 中跨 repository 勾选并提交的工作流，也没有解决 selection 与 mutation identity 的系统性问题。

### 方案 B：repository-scoped contract + 分组状态 + 顺序独立提交（采用）

每个 action 都携带 `repositoryRoot`，UI 可以同时选择多个 repository；提交时逐 repository 建立独立 commit。该方案跨层改动更完整，但 identity 清晰、兼容 single repository，并能正确表达 partial success。

### 方案 C：backend 提供跨 repository 原子提交

需要自建补偿事务，无法可靠回滚已推送或被 hook 改写的 commit，复杂度和数据风险均不可接受。

## Capabilities

### New Capabilities

- `multi-repository-git-commit-workspace`: 定义 repository-scoped status/mutation、single/multi adaptive commit panel、多仓库独立提交与 partial failure contract。

### Modified Capabilities

- `git-operations`: 将现有 Git status、stage、commit、push/pull/sync 与 branch update 扩展为 optional repository-scoped operation，同时保留 legacy configured-root fallback。
- `git-panel-diff-view`: 提交文件列表从单 repository 投影扩展为 single/multi adaptive grouping 与 repository-isolated selection。

## Impact

- Frontend：`src/features/git/**`、`src/features/layout/**`、`src/app-shell-parts/**`、Git panel styles/i18n。
- Bridge：`src/services/tauri/git.ts` 及其 mapping tests。
- Backend：`src-tauri/src/git/**`、Git command registration/types/helpers。
- Specs/tests：OpenSpec delta、Trellis frontend/backend contract、Vitest 与 Rust tests。
- Dependencies：无新增依赖。

## 验收标准

- 未选择全局 Git root 时，右键任意 child repository 执行“更新”能够命中该 repository。
- single-repository workspace 保留既有 stage/commit/push 行为，并与 multi-repository workspace 一致采用底部 commit composer。
- multi-repository workspace 同时显示至少两个 dirty repository group，branch/file counts/files 均与各自 repository 一致。
- 同名 relative file path 在不同 repositories 中可独立选择和 stage，不发生串仓库。
- 多 repository commit 对每个 selected repository 创建独立 commit；一个失败时其他 repository 继续，成功项刷新，失败项保持选择并显示原因。
- focused frontend tests、runtime contract tests、Rust isolation tests、typecheck 与 strict OpenSpec validation 通过。
- Git History 选择任意 discovered child repository 后只刷新底部历史面板，主 workspace、文件树与会话保持不变。
- Git History 第一层 workspace/worktree hierarchy 与旧行为一致；multi repository 只新增第二层选择器，single repository 不增加冗余 chrome。
- multi repository composer 显示与 single mode 一致的 AI engine icon/menu/loading state，生成内容覆盖本轮所有 selected repository scopes。
