## 1. Contract

- [x] 1.1 [P0, depends: none] 固化 Sidebar、独立 layout、CLI selector 与 tab order 的 behavior spec。

## 2. Regression Tests

- [x] 2.1 [P0, depends: 1.1] 增加 Sidebar market/extensions 并存与 disabled/click behavior 测试。
- [x] 2.2 [P0, depends: 1.1] 增加 Desktop Extensions 独立布局测试。
- [x] 2.3 [P1, depends: 1.1] 更新 ExtensionsView 结构与交互测试。

## 3. Implementation

- [x] 3.1 [P0, depends: 2.1] 恢复 disabled 市场项并保留拓展 mode entry。
- [x] 3.2 [P0, depends: 2.2] 收敛 Desktop/Tablet/Phone 的 Extensions 独立 surface 条件。
- [x] 3.3 [P1, depends: 2.3] 按当前页面要求调整 toolbar、selector、tabs 与 introduction panel，并移除页面级 Browse Marketplace button。

## 4. Verification

- [x] 4.1 [P0, depends: 3.1, 3.2, 3.3] 运行 focused Vitest、lint、typecheck、large-file check 与 diff check。
- [x] 4.2 [P1, depends: 4.1] 运行 desktop/mobile screenshot QA 与 OpenSpec strict validation。

## Verification Record

- Focused Vitest: Sidebar、DesktopLayout、ExtensionsView 共 67 tests passed；ExtensionsView 断言页面级 Browse Marketplace button 不渲染。
- Full frontend suite: 905 test files passed。
- Static gates: `npm run lint`、`npm run typecheck`、`npm run check:large-files` passed。
- Visual QA: 1440x813 desktop 与 390x844 mobile captures；无 horizontal overflow，right panel/composer 未挂载；visual verdict 94/100。
- OpenSpec: strict validation passed。
