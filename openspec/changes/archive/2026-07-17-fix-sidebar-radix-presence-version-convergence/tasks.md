## 1. Dependency Contract

- [x] 1.1 [P0, depends:none] 输入 current `radix-ui` scoped overrides 与 ScrollArea exact dependencies；输出 Presence `1.1.7` compatible override 和 refreshed lockfile；验证 `npm ls` exits `0` without `invalid`。
- [x] 1.2 [P0, depends:1.1] 输入 manifest/lockfile；输出 dependency-resolution regression，断言 ScrollArea/Presence compatibility 且无 broad override；验证 focused Vitest。

## 2. Sidebar Startup Regression

- [x] 2.1 [P0, depends:1.1] 输入真实 ScrollArea 与多个 Sidebar-shaped workspace rows；输出 StrictMode repeated-rerender regression；验证 stable Root/Viewport refs 且无 React `#185`。

## 3. Quality Gate

- [x] 3.1 [P0, depends:1.2,2.1] 输入 implementation；输出 focused Tooltip/ScrollArea/Sidebar/AppShell test evidence；验证 commands exit `0`。
- [x] 3.2 [P0, depends:3.1] 输入 final diff；输出 lint、typecheck、production build、`git diff --check` 与 strict OpenSpec validation evidence；验证 commands exit `0`。
- [ ] 3.3 [P1, depends:3.2] 输入 rebuilt production dependency graph；输出人工 cold-start acceptance pending note；验证不把 automated checks 冒充实机 acceptance。
