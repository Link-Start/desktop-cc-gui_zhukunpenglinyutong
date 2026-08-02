## 1. Backend: Shared 源接入 Catalog 读路径

- [x] 1.1 `SharedSessionSummary` 与 `list_workspace_shared_sessions` 提升为 `pub(crate)`
- [x] 1.2 新增 `build_shared_catalog_entry` 构造器
- [x] 1.3 `build_workspace_scope_catalog_data` 接入 shared 源（strict 扫描）
- [x] 1.4 `build_global_engine_catalog_entries` 接入 shared 源（related/global 扫描）
- [x] 1.5 `SESSION_CATALOG_PARTIAL_SHARED` 常量定义

## 2. Backend: Shared 接入 Lifecycle 写路径

- [x] 2.1 提取 `delete_shared_session_files` 复用函数
- [x] 2.2 `delete_workspace_sessions_core` 去掉 Shared 硬拒绝，新增 `"shared"` match arm
- [x] 2.3 `archive_workspace_sessions_core` 去掉 Shared 硬拒绝，fallback 到 metadata soft archive

## 3. Frontend: UI 适配

- [x] 3.1 `isSharedCatalogEntry` / `resolveCatalogEntryEngineIcon` utils
- [x] 3.2 幕布 `loadSessionCurtainItems` 增加 shared 加载分支
- [x] 3.3 幕布加载入口 guard：shared 不进入 Codex 双源路径
- [x] 3.4 引擎筛选下拉增加 `Shared CLI`
- [x] 3.5 SessionList: Shared badge + is-shared CSS + 引擎标签
- [x] 3.6 幕布标题: Shared 标签 + sourceLabel
- [x] 3.7 i18n: `projectSessionEngineShared` / `sessionManagementBadgeShared` (10 locales)
- [x] 3.8 CSS: `.is-shared` 行背景 + badge 样式 + 幕布标签样式

## 4. 测试

- [x] 4.1 Utils 单测: `isSharedCatalogEntry` / `resolveCatalogEntryEngineIcon`
- [x] 4.2 `cargo check --lib` 通过
- [x] 4.3 `cargo test --lib session_management` 89 项通过

## 5. Review 修复 (待处理)

- [x] 5.1 修复日志 tag: `list_global_codex_sessions` → `list_global_shared_sessions`
- [x] 5.2 修复 `source_completeness`：shared 有数据时应报 `Complete`
- [ ] 5.3 (可选) `build_shared_catalog_entry` 增加 Rust 单元测试
- [ ] 5.4 (可选) `exists_on_disk` 增加 shared dir 存在性检查
