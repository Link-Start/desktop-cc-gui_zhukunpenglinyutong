## 1. Shortcut Precedence（P0）

- [x] 1.1 输入现有 native File/Window close item，输出无 accelerator 的 custom menu items；验证 menu handler 与 focused Rust tests。
- [x] 1.2 依赖 1.1，输入 shared shortcut defaults，输出 platform-primary `cmd+w` expand-selection default；验证 frontend/Rust persistence tests 与 editor precedence test。

## 2. Navigation Error Semantics（P0）

- [x] 2.1 输入 navigation action + backend error，输出 no-symbol/unsupported/operational 三类 localized message；验证 pure helper tests 与 hook/component error paths。
- [x] 2.2 依赖 2.1，输入所有 supported UI locales，输出完整 definition/references/implementation guidance keys；验证 TypeScript locale contract。

## 3. Modifier Hover Affordance（P1）

- [x] 3.1 输入 modifier/pointer/editor syntax state，输出单一 identifier decoration 与完整 lifecycle cleanup；验证 identifier、keyword/comment/string、keyup/leave/blur cases。
- [x] 3.2 依赖 3.1，输出 underline + pointer theme styling，且 hover 不调用 backend；验证 CodeMirror focused tests。

## 4. Incremental Verification And Closure（P0）

- [x] 4.1 运行 touched frontend focused Vitest、incremental ESLint、typecheck 与 targeted Rust tests，不运行 full suite。
- [x] 4.2 执行 OpenSpec strict validation、implementation verification、main spec sync 与 archive，并记录证据。
