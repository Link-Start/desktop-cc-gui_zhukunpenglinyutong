# Multi-repository Git Command Center

## Goal

实现 OpenSpec change `add-multi-repository-git-command-center`：让单一 workspace 中的 root/nested Git repositories 在文件树与 Composer Git command center 中拥有一致、可操作、repository-scoped 的状态与 actions。

## Requirements

- 以 `openspec/changes/add-multi-repository-git-command-center/**` 为 behavior single source of truth。
- 覆盖 repository discovery/summary、文件树 decoration、自适应 single/multi repository UI、rich branch hierarchy、Update/Commit/Push/Checkout/Create Branch。
- desktop local 与 remote daemon contract parity。
- macOS/Windows/Linux 路径兼容；backend 拒绝 absolute/traversal/workspace escape。
- 复用现有 Git Diff/History/write workflows，不复制复杂写操作。
- 单文件不超过 3000 行，不新增依赖，不执行 git commit。

## Acceptance Criteria

- [x] OpenSpec tasks 全部完成并通过 strict verify。
- [x] 单/多 repository UI、nested folder decoration 与 repository target isolation 有 focused tests。
- [x] frontend/service/Tauri/daemon mapping 一致。
- [x] typecheck、lint、runtime contracts、large-file gate 与相关 tests 通过。
- [x] 未执行 git commit，工作区 changes 保留供用户检查。
- [x] Composer Update 有 keyed loading、重复点击保护与 structured result feedback。
- [x] branch hierarchy 使用 Recent / Local / Remote 清晰分组。
- [x] 仅 exact nested repository folder 显示 typed Git submenu，普通 folder 不显示。
- [x] repository context actions 先完成 target repository selection，再复用既有 Git Diff/History workflow。
- [x] 增量 UX focused gates、OpenSpec strict verify 与跨层审计全部通过；全量 Vitest 已覆盖 793 个文件，并记录 `SettingsView.test.tsx` 与 `WorkspaceHome.test.tsx` 两处无 diff 关联的既有 baseline failure。

## Technical Notes

- Frontend + Rust fullstack cross-layer change。
- Summary read 使用 bounded aggregate command；branch direct mutation 使用 optional explicit `repositoryRoot`。
- Commit/Push action await existing Git root selection 后复用既有 workflow。
- context menu 采用 Hybrid routing：安全确定性 action 直接执行；高风险或参数化 action 路由到现有 Git surface。
