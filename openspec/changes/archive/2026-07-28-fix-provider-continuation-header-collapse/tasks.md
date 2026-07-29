## 1. Continuation Header Layout

- [x] 1.1 [P0, depends: none] 为 `ProviderContinuationContextCard` 添加 feature-scoped sticky surface；输入为现有 `<details>` row，输出为折叠/展开时均不被 Canvas chrome 裁剪的 header；验证 focused DOM/class test。

## 2. Regression Coverage

- [x] 2.1 [P0, depends: 1.1] 扩充 `ProviderContinuationContextCard.test.tsx`；输入为 collapsed row，输出为 collapsed → expanded → collapsed 可逆交互断言；验证 focused Vitest。
- [x] 2.2 [P1, depends: 1.1] 验证 source navigation 与 missing-source disabled 行为保持不变；输入为既有 fixtures，输出为无回归测试结果；验证 focused Vitest。

## 3. Quality And Closure

- [x] 3.1 [P0, depends: 2.1, 2.2] 运行 focused Vitest、`npm run typecheck` 与 `npm run lint`；输入为全部实现改动，输出为通过的质量门禁。
- [x] 3.2 [P0, depends: 3.1] 完成 change-level strict validation 与 implementation verification；输入为 OpenSpec artifacts 和测试证据，输出为可同步归档的 change。
