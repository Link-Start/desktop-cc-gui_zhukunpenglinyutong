## Why

设置页「项目管理 → 会话管理」的 Catalog 读模型从设计之初就只聚合 native engine
（codex/claude/gemini/kimi/grok/opencode）的磁盘历史，从未接入 Shared Session。
同时 delete/archive mutation 对 `SessionCatalogIdentity::Shared` 硬拒绝，
文案 `Shared sessions are not supported in phase-one delete management`。

产品已经有 Shared CLI，侧栏 threads 能列出、删除 shared session，
但会话管理中心既扫不到也删不了——形成了“侧栏看得到、管理页管不了”的双轨分裂。
此外幕布预览没有 shared 消息加载路径，`normalizeEngineType("shared")` 还会误走
Codex 双源加载，导致预览白屏。

## 目标与边界

- 将 Shared Session 接入 workspace session catalog 的读路径（strict + related/global）。
- 将 Shared Session 接入 catalog mutation（delete/archive），与侧栏行为一致。
- 幕布预览支持加载 shared 历史内容。
- UI 区分 Shared 会话：badge、引擎筛选、幕布标签。

## 非目标

- 不改变 Shared Session 的存储格式或 binding 逻辑。
- 不优化 catalog 扫描性能（仍走 Exhaustive 预扫描，删除性能优化另开 change）。
- 不实现 shared session 的文件夹分组。
- 不级联删除 native binding 会话（与侧栏 `delete_shared_session` 行为一致，
  只删 shared 目录 + 清 metadata）。
- 不运行仓库全量测试；只执行受影响模块的增量测试。

## What Changes

- Catalog read：`build_workspace_scope_catalog_data` 与
  `build_global_engine_catalog_entries` 增加 `shared` 源，调用
  `list_workspace_shared_sessions` 聚合 shared 条目。
- Catalog write：`delete_workspace_sessions_core` 与
  `archive_workspace_sessions_core` 去掉 Shared 硬拒绝，按 engine `"shared"`
  路由到 `delete_shared_session_files` 或 metadata soft archive。
- Content preview：幕布增加 shared 分支，走 `createSharedHistoryLoader`。
- Visibility：`SharedSessionSummary` 与 `list_workspace_shared_sessions`
  提升为 `pub(crate)`；提取 `delete_shared_session_files` 复用。
- UI：Shared badge、引擎筛选 `Shared CLI`、幕布标签、is-shared 样式。

## Capabilities

### Modified Capabilities

- `workspace-session-catalog-projection`: Catalog 聚合 shared 源，`session_id`
  使用 `shared:{uuid}` 格式以匹配 `parse_catalog_identity`。
- `workspace-session-management`: 删除/归档 shared session 不再硬拒绝。

## Impact

- Frontend：`SessionManagementSection`、`SessionManagementSessionList`、
  `sessionManagementSectionUtils`、`settings.session-management.css`、
  i18n `zh/en/settings.ts`。
- Backend：`session_management.rs`、`session_management_catalog_projection.rs`、
  `session_management_types.rs`、`shared_sessions.rs`。
- Storage：无 schema 变更；Shared Session 目录结构不变。
- Dependencies：无新增依赖。

## 验收标准

- 打开设置 → 项目管理 → 会话管理，选择有 shared session 的 workspace，
  列表中出现带 Shared 徽章的条目。
- 引擎筛选下拉包含“Shared CLI”，选中后仅展示 shared 条目。
- 勾选 shared 条目后执行删除，确认后条目消失，刷新不再出现。
- 归档 shared 条目后状态正确切换；取消归档后恢复。
- 点击 shared 条目的消息图标，幕布正确加载历史内容。
- 侧栏 threads 中同一 shared session 的列表与删除行为与会话管理中心一致。
- `cargo check --lib` 通过。
- 单测 89 项 Rust + 3 项前端通过。
