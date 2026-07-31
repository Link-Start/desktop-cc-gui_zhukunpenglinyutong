## 1. Regression Coverage

- [x] 1.1 [P0, depends: none] 输入 Shared CLI 下两个 Provider Profiles；输出点击展开、互斥切换、折叠且 root/submenu 保持打开的 focused test；验证该测试在修复前失败。

## 2. Focus Lifecycle Fix

- [x] 2.1 [P0, depends: 1.1] 输入 Shared nested Profile interaction；输出固定 active CLI submenu 并在 pointer dismiss 前执行 accordion mutation 的最小修复；验证 Native path 与 Model terminal selection 不变。

## 3. Quality Gates

- [x] 3.1 [P0, depends: 2.1] 输入修改后的 selector；输出 focused Vitest 通过；验证 `ModelSelect.test.tsx`。
- [x] 3.2 [P0, depends: 3.1] 输入完整变更；输出 typecheck、lint、runtime contracts、diff check 与 strict OpenSpec validation 结果。
- [x] 3.3 [P1, depends: 3.2] 输入验证 evidence；输出 `verification.md`、同步 main spec 并归档 OpenSpec/Trellis task。
