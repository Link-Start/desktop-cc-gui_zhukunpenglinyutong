## 1. Restore surface contract

- [x] 1.1 [P0, depends: none] 删除 `onOpenUnavailablePreview`、preview cache 与首次点击 navigation，恢复 `FileChangeRow` 原有 lazy expansion。
- [x] 1.2 [P0, depends: 1.1] 删除 `GenericToolBlock` 对 non-empty added diff 的隐式 canonical fallback wiring。

## 2. Fix event-time patch preview

- [x] 2.1 [P0, depends: 1.1] 扩展 `unifiedDiffToPreview`，把 `*** Add File:` / `*** Delete File:` body 转换为 inline add/del lines。
- [x] 2.2 [P1, depends: 2.1] 增加 adapter 与 `GenericToolBlock` integration tests，验证新增文件原地展开且不触发 navigation。

## 3. Contract and quality gates

- [x] 3.1 [P1, depends: 1.2, 2.2] 验证 focused Vitest、typecheck、lint、`git diff --check` 与 OpenSpec strict validation。
