# Fix multi-repository file tree decorations

## Goal

实现 OpenSpec change `fix-multi-repository-file-tree-decorations`：恢复原始 folder icon，并让多个 Git 子项目同时投影 branch、working-tree token、changed file 与 ancestor folder theme-aware decoration。

## Requirements

- 以 `openspec/changes/fix-multi-repository-file-tree-decorations/**` 为 behavior single source of truth。
- aggregate summary 在既有 status scan 中返回 compact repository-relative `path + status` entries，不新增 N-repository polling。
- frontend boundary 校验 path/status，并合并 root/nested repository workspace projection。
- folder icon 保持 `getFileTreeIconSvg` 原有输出，变更只着色 name/token。
- branch/clean/dirty/conflict/error 使用 semantic theme variables。
- local desktop 与 remote daemon payload additive parity；旧 payload 缺字段时保持兼容。

## Acceptance Criteria

- [x] 两个 dirty sibling repositories 同时显示各自 changed file/folder 状态。
- [x] Git repository folder 不再出现蓝色 icon override 与 corner marker。
- [x] branch、clean、dirty、conflict/error token 颜色语义独立并适配主题。
- [x] malformed path、partial failure、stale response 不污染其他 repository。
- [x] focused tests、typecheck、lint、runtime contracts、large-file gate、strict OpenSpec validation 通过。
- [x] dark/light/system theme 使用独立 IDEA-inspired Git palette，file tree 与 Composer 不发生颜色漂移。
- [x] repository branch 使用暖橙色 token，changed file/folder name 使用 `font-weight: 550`。
- [x] dirty repository folder 无论内部变更类型均统一为 theme-aware blue，内部仍按 status-specific palette。
- [x] file tree 与 Composer repository branch text 使用 `font-weight: 600`。

## Technical Notes

- 不新增 dependency 或 Tauri command；扩展 existing `GitRepositorySummary` additive field。
- 关联 OpenSpec：`fix-multi-repository-file-tree-decorations`。
- 用户未要求 commit，本 task 默认不执行 commit/archive。
