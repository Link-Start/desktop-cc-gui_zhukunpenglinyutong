## 验证报告：fix-editor-navigation-affordances

### 摘要

| 维度 | 状态 |
|---|---|
| 完整性 | implementation 7/7 完成；closure task 等待 sync/archive |
| 正确性 | 5 个 changed/added requirements 均有实现与 focused test evidence |
| 一致性 | 遵循 existing native menu ids、shared shortcut parser、CodeMirror extension 与 feature-local navigation utility pattern |

### Requirement Evidence

- `File Editor Expand Selection Shortcut MUST Be Configurable And Editor Scoped`
  - 默认值：`src/features/settings/hooks/useAppSettings.ts`、`settingsViewShortcuts.ts`、`src-tauri/src/types.rs`
  - editor precedence：`FileCodeMirrorEditorImpl.tsx` 的 `Prec.highest` + `preventDefault`
  - regression：`FileCodeMirrorEditorImpl.test.ts`
- `Expand Selection Shortcut MUST Respect Platform And Editable Boundaries`
  - `cmd+w` 经 `toCodeMirrorShortcut` 映射为 `Mod-w`
  - previous `ctrl+w` default only receives bounded compatibility alias；custom/`null` 不注册 alias
- `Native Close Window Menu MUST Not Reserve Expand Selection Shortcut`
  - `src-tauri/src/menu.rs` 的 File/Window close items 均为无 accelerator `MenuItemBuilder`
  - `file_close_window | window_close` 继续复用 existing close handler
  - source sentinel 确认不存在 `PredefinedMenuItem::close_window`
- `LSP Failure and Unsupported Fallback`
  - `resolveCodeNavigationErrorMessage` 区分 no-symbol、unsupported、timeout 与 operational failure
  - `useFileNavigation` 对 definition/references/implementation 使用 action-specific message
  - 10 个 supported locales 各包含 7 个新增 keys（共 70 个）
- `Modifier Hover MUST Reveal Navigable Symbol Affordance`
  - local `syntaxTree + wordAt` 只接受 identifier-like syntax nodes
  - 单一 Decoration 提供 underline + pointer，不触发 backend query
  - keyup、mouseleave、window blur、visibility change 与 destroy 均有 cleanup

### Incremental Evidence

- `npx vitest run --reporter=dot ...`：6 files / 161 tests passed。
- 最终 editor/navigation rerun：3 files / 102 tests passed。
- `npm run typecheck`：passed。
- incremental ESLint：passed。
- `rustfmt --edition 2021 --check src-tauri/src/menu.rs src-tauri/src/types.rs`：passed。
- `cargo test ... menu::tests`：3 passed；lib/daemon filtered targets 无失败。
- `cargo test ... app_settings_defaults_from_empty_json`：lib + daemon 各 1 passed。
- `cargo test ... app_settings_round_trips_all_frontend_shortcut_fields`：lib + daemon 各 1 passed。
- `npm run check:app-shell:runtime-contract`：passed。
- `git diff --check`：passed。
- `openspec validate fix-editor-navigation-affordances --strict --no-interactive`：passed。
- `app-shortcuts` 与 `file-view-code-intelligence-navigation` delta 已同步；两个 main specs targeted strict validation passed。
- change 已归档到 `openspec/changes/archive/2026-07-22-fix-editor-navigation-affordances/`，归档使用 `--skip-specs`，因为 main specs 已先行同步并验证等价。
- workspace-wide `openspec validate --all --strict --no-interactive`：437 passed / 1 unrelated active change failed。失败项为既有 `fix-claude-cli-native-installer` 两个 `MODIFIED` requirement 缺少 requirement text；本轮未修改该 change。
- 按用户约束未运行 full test suite。

### Issues

- CRITICAL：无。
- WARNING：无。
- SUGGESTION：semantic hover 当前采用 conservative syntax-node predicate；未知 grammar 宁可不显示 affordance，不做可能误导的全 word underline。

### Final Assessment

实现、测试与 design/spec 一致。可以同步 main specs 并归档。
