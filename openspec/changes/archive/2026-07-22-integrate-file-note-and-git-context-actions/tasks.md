## 1. Unified note capture menu

- [x] 1.1 [P0, depends: none] 输入 `FileViewBody` canonical selection；输出 parent context-menu request callback；验证 child 不再 render 独立 `RendererContextMenu`。
- [x] 1.2 [P0, depends: 1.1] 输入 selection/whole-file snapshot；输出 `FileViewPanel` note capture item；验证 edit/preview、unsaved、blank/truncated boundaries。

## 2. Repository-scoped Git submenu

- [x] 2.1 [P0, depends: none] 输入 active file Git scope 与 host callbacks；输出 `Git 操作` submenu；验证 nested repository File History 与 Git Blame availability。

## 3. Localization and focused regression coverage

- [x] 3.1 [P1, depends: 1.2] 输入新增 whole-file capture label；输出全部 locale key，验证 TypeScript/i18n shape compatibility。
- [x] 3.2 [P0, depends: 1.2, 2.1] 输入 unified menu behaviors；输出 focused Vitest cases，验证 selection/no-selection/preview/single-popover/Git scope。

## 4. Incremental quality and closure

- [x] 4.1 [P0, depends: 3.1, 3.2] 执行 focused Vitest、targeted ESLint、typecheck、diff review 与 OpenSpec strict validation；明确不运行全量测试。
- [x] 4.2 [P1, depends: 4.1] 记录 verification evidence，同步 main spec 并归档 change；保留人工验收项。
