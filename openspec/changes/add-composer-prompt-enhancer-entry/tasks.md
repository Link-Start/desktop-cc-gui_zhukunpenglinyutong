## 1. Composer quick action

- [x] 1.1 [P0][depends:none] 输入：`ButtonArea` 已有 `onEnhancePrompt` 与 `isEnhancing` props；输出：在 `toolSurface` 后渲染可访问的 prompt enhancer icon button，并在调用 action 前关闭 tool menu；验证：focused component test 可按 accessible name 找到并点击入口。
- [x] 1.2 [P0][depends:1.1] 输入：enhancement running state；输出：入口在运行中 disabled，且 keyboard shortcut path 保持不变；验证：focused component test 断言 disabled 和 callback 调用次数。

## 2. Validation

- [x] 2.1 [P0][depends:1.1,1.2] 运行 focused Composer tests、`npm run typecheck`、相关 lint/large-file gate，并执行 `openspec validate add-composer-prompt-enhancer-entry --strict`。

## 3. Provider and light-theme refinement

- [x] 3.1 [P0][depends:1.2] 输入：prompt enhancer engine allowlist；输出：移除 `OpenCode` option，并将 OpenCode current provider 归一化为 Claude；验证：hook test 锁定 allowlist 与 default engine。
- [x] 3.2 [P1][depends:1.2] 输入：light-theme primary action states；输出：enabled `#2563eb`、hover 深蓝、disabled 浅蓝且无 opacity 灰化；验证：CSS contract test 锁定 scoped selectors 和颜色。

## 4. Refinement validation

- [x] 4.1 [P0][depends:3.1,3.2] 运行 prompt enhancer focused tests、`npm run lint`、`npm run typecheck`、`npm run check:large-files` 与 OpenSpec strict validation。

## 5. Quick-action surface refinement

- [x] 5.1 [P0][depends:1.1] 输入：tool-popover quick-action row；输出：提示词增强简中描述改为「输入框提示词增强」，移除回溯与输出折叠的表层 label，并统一 icon-only button 为 34×34；验证：focused component test 锁定 label absence、accessible names 与 shared class contract。
- [x] 5.2 [P0][depends:5.1] 运行 focused Composer tests、`npm run lint`、`npm run typecheck`、`npm run check:large-files` 与 OpenSpec strict validation。

## 6. Compact tool-popover spacing

- [x] 6.1 [P1][depends:5.1] 输入：Composer tool-popover spacing；输出：收紧 menu padding、submenu row padding、direct separator margin 与 quick-action row bottom padding，保留 34px icon hit area；验证：CSS contract test 锁定紧凑值。
- [x] 6.2 [P0][depends:6.1] 运行 focused Composer tests、`npm run lint`、`npm run typecheck`、`npm run check:large-files` 与 OpenSpec strict validation。
