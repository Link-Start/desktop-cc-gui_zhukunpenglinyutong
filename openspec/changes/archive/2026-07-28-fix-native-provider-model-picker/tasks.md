## 1. Catalog Projection

- [x] 1.1 [P0, depends: none] 泛化现有 Provider target catalog hook；输入 session kind/current CLI，输出 Shared 多 CLI 或 Native 单 CLI Provider groups；用 hook focused tests 验证 scope、cache 与 Kimi boundary。
- [x] 1.2 [P0, depends: 1.1] 让 Native Composer 使用 Provider Profile-scoped catalog，移除旧的跨 CLI `modelGroups` selection path；用 adapter/component tests 验证只显示当前 CLI。

## 2. Picker Interaction

- [x] 2.1 [P0, depends: 1.1] 在 `ModelSelect` 实现 Provider Profile 单开互斥 accordion；输出可访问的 `aria-expanded`/keyboard path；用 focused tests 验证 A→B 自动折叠。
- [x] 2.2 [P0, depends: 1.2, 2.1] 按 current frozen Provider identity 分流 Model selection；同 Provider 调用 current model callback，跨 Provider只发 continuation request；验证 local/default normalization 与取消前 UI 不变。

## 3. Provider Continuation Integration

- [x] 3.1 [P0, depends: 2.2] 抽取 context-menu 已有 Dialog preparation 为共享函数，并增加 typed feature-local request channel；输入 workspace/session/destination target，输出同一 Dialog state。
- [x] 3.2 [P0, depends: 3.1] Composer 跨 Provider Model 选择接入 request channel，destination 包含 model；用 hook/dialog tests 验证 context menu 与 Composer 共享 preparation、确认/取消/recovery 行为不变。

## 4. Validation And Closure

- [x] 4.1 [P0, depends: 1.2, 2.2, 3.2] 运行 ModelSelect、catalog hook、ChatInputBox/Composer、useSidebarMenus focused Vitest suites，并修复回归。
- [x] 4.2 [P0, depends: 4.1] 运行 `npm run typecheck` 与 `openspec validate fix-native-provider-model-picker --strict --no-interactive`，记录 verification evidence。
- [x] 4.3 [P1, depends: 4.2] 执行 OpenSpec implementation verification，确认 tasks/spec/design/实现一致并更新变更状态。
