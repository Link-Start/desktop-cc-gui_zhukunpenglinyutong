## 1. Additive aggregate decoration contract

- [x] 1.1 [P0] 扩展 Rust/TypeScript `GitRepositorySummary` 与 normalization，输入为 optional compact `fileStatuses` payload，输出为 validated repository-relative `path + status` entries；依赖：无；验证：frontend normalizer tests + Rust serde/assertions。
- [x] 1.2 [P0] 在现有 `git_repository_summary` status iteration 中收集 compact entries，保持 unavailable repository empty collection 与 desktop/daemon parity；依赖：1.1；验证：Rust tests 覆盖 root、two sibling repositories、conflict、partial failure。

## 2. Workspace-level file tree projection

- [x] 2.1 [P0] 新增/复用纯 helper 将 repository-relative entries 投影为 workspace path，并与 active-root compatibility status 合并；输入为 normalized summaries，输出为 deterministic file/folder status maps；依赖：1.1；验证：Vitest 覆盖 root、nested、Windows separator、traversal rejection 与 priority。
- [x] 2.2 [P0] 将 aggregate decoration maps 接入 `FileTreePanel`/`FileTreeRows`，使多个 dirty repositories 的 file、ancestor folder 与 exact repository folder 同时着色；依赖：1.2、2.1；验证：focused FileTree render tests。

## 3. Restore icon semantics and theme-aware tokens

- [x] 3.1 [P0] 删除 repository folder icon color override 与 corner marker，保持 `getFileTreeIconSvg` 原样；输入为 exact repository row，输出为原始 folder icon + trailing Git summary；依赖：2.2；验证：FileTree DOM/class regression test。
- [x] 3.2 [P0] 将 repository summary 拆为 branch/sync/clean/dirty/conflict/error semantic tokens，并使用 existing theme variables/`color-mix`；依赖：2.2；验证：utility/component tests + CSS theme token assertions。

## 4. Quality gates and specification verification

- [x] 4.1 [P1] 运行 focused frontend/Rust tests、`npm run typecheck`、`npm run lint`、`npm run check:runtime-contracts`、`npm run check:large-files`，修复本 change 引入的问题；依赖：1-3 全部完成。
- [x] 4.2 [P1] 运行 `openspec validate fix-multi-repository-file-tree-decorations --strict --no-interactive` 并复核 task/spec/implementation 一致性；依赖：4.1。

## 5. IDEA palette visual refinement

- [x] 5.1 [P1] 在 shared dark/light/system theme 层定义 IDEA-inspired Git status 与 warm-orange branch tokens，并让 file tree / Composer summary 统一消费；changed file/folder name 使用 `font-weight: 550`；依赖：3.2；验证：CSS contract test 覆盖三套 theme token、shared consumers 与 unchanged icon contract。
- [x] 5.2 [P1] 同步 executable code-spec，运行 focused style/component tests、`npm run typecheck`、`npm run lint`、`git diff --check` 与 strict OpenSpec validation；依赖：5.1。

## 6. Repository-level color hierarchy

- [x] 6.1 [P1] 新增 theme-aware `--git-repository-dirty` blue，仅覆盖 exact dirty repository folder；内部 file/ordinary folder 保留 status-specific IDEA palette，并将 file tree / Composer branch token 设为 `font-weight: 600`；依赖：5.1；验证：CSS contract + multi-repository render assertions。
- [x] 6.2 [P1] 同步 executable code-spec，运行 focused tests、`npm run typecheck`、`npm run lint`、`git diff --check` 与 strict OpenSpec validation；依赖：6.1。
