## 1. Theme Contract

- [x] 1.1 [P0][依赖: 无] 在 `themes.dark.css` 补齐 desktop shell/sidebar/main tokens；输入：现有 dark surfaces；输出：dark/system-dark 完整 token matrix；验证：CSS contract test。
- [x] 1.2 [P0][依赖: 1.1] 将 `main.css` collapsed selector 的 white fallback 替换为 theme-aware surface；输入：公共 selector；输出：缺 token 时 dark-safe fallback；验证：source assertion。

## 2. Regression Guard

- [x] 2.1 [P0][依赖: 1.1, 1.2] 新增 `desktop-shell-theme.test.ts`；输入：dark/light/system/main CSS；输出：三类 appearance 与 fallback contract；验证：`npx vitest run src/styles/desktop-shell-theme.test.ts`。

## 3. Quality And Closure

- [x] 3.1 [P1][依赖: 2.1] 运行 frontend gates；输入：CSS/test diff；输出：focused test、lint、typecheck、large-file 均通过；验证：对应命令 exit 0。
- [x] 3.2 [P1][依赖: 3.1] 验证并同步 OpenSpec change；输入：完成实现与 delta spec；输出：strict validation 通过、main spec 同步并具备归档条件；验证：main spec 包含新增 requirement。
