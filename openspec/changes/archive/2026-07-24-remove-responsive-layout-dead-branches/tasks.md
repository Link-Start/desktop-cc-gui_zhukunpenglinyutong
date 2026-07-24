# Tasks: remove-responsive-layout-dead-branches

- [x] 1. grep 确认 `useLayoutMode` / `LayoutMode`（layout hook 版）/ `PhoneLayout` / `TabletLayout` 的引用闭包仅限目标锚点，确认 `layoutMode` 返回值无消费方
- [x] 2. 删除 `src/features/layout/hooks/useLayoutMode.ts`
- [x] 3. `useLayoutController.ts` 删除 `useLayoutMode` import 与 `:36-39` 派生逻辑，inline 恒 false 常量，return 中移除 `layoutMode`
- [x] 4. `AppLayout.tsx` 删除 Phone/Tablet import、`isPhone`/`isTablet` props、两段死分支，并停止解构仅死分支使用的 11 个 props
- [x] 5. `renderAppShell.tsx` 删除 `isPhone`/`isTablet` 向 `AppLayout` 的传递与对应 destructuring
- [x] 6. 验证：`npm run typecheck`（0 error）+ `npx eslint`（改动文件，0 problem）+ `app-shell.startup.test.tsx` / `DesktopLayout.test.tsx` vitest（23/23 通过）+ grep 无残留
