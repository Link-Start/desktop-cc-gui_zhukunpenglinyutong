## 1. Header Safe Offset

- [x] 1.1 [P0, depends: none] 将 continuation row sticky top 绑定 `--main-topbar-height`；输入为现有 row class，输出为 collapsed/expanded header 均位于 Canvas topbar 下方；验证 focused class contract。

## 2. Source Navigation Density

- [x] 2.1 [P0, depends: 1.1] 将来源导航收敛为 icon-only semantic button；输入为现有 ArrowLeft + text button，输出为无 resting chrome、无 visible text、保留 aria/title/disabled 的 28px action；验证 DOM/accessibility assertions。
- [x] 2.2 [P0, depends: 2.1] 保留 expanded → collapsed 和 source callback 行为；输入为既有 component fixture，输出为可逆交互与单次导航调用；验证 focused Vitest。

## 3. Quality And Closure

- [x] 3.1 [P0, depends: 2.2] 运行 focused Vitest、typecheck、lint 与 diff hygiene；输入为本次最小 diff，输出为通过的质量证据。
- [x] 3.2 [P0, depends: 3.1] 完成 strict validation、verification、spec sync 和 archive；输入为 artifacts/实现/测试，输出为已归档 corrective change。
