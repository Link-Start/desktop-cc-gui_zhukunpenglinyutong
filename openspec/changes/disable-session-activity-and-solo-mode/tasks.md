## 1. Entry & Solo kill-switch

- [x] 1.1 [P0][Depends: none][Input: `PanelTabs.tsx`][Output: `SHOW_ACTIVITY_TAB = false`，activity 不出现在 toolbar/menu][Verify: `PanelTabs.test.tsx`] 隐藏会话活动入口。
- [x] 1.2 [P0][Depends: none][Input: `useAppShellSections` / Solo 入口][Output: `soloModeEnabled = false`，UI 无 Solo/聚焦入口][Verify: layout / app-shell focused test 或手动] 禁用 Solo。

## 2. Cut activity wiring

- [x] 2.1 [P0][Depends: none][Input: `useAppShellSearchRadarSection.ts`][Output: 不再调用 `useWorkspaceSessionActivity`；导出空 stub][Verify: typecheck + search-radar section test] 切断壳层派生。
- [x] 2.2 [P0][Depends: none][Input: `useLayoutNodes.tsx`][Output: 不再调用 hook；不渲染 `WorkspaceSessionActivityPanel`；`activityLive = false`][Verify: `useLayoutNodes` 相关 test] 切断布局派生与面板。
- [x] 2.3 [P0][Depends: 2.1][Input: Live Edit / Quick Switcher][Output: 空 timeline 或不调用下游 hook][Verify: 无 runtime error] 切断 timeline 下游。
- [x] 2.4 [P1][Depends: 2.2, 1.2][Input: 持久化 filePanelMode / solo][Output: activity/solo 残留 normalize 到安全态][Verify: 手动或 unit] 处理旧状态。

## 3. Specs & verification

- [x] 3.1 [P0][Depends: 1.x, 2.x][Input: 本 change delta specs][Output: 行为与代码一致][Verify: `openspec validate disable-session-activity-and-solo-mode --strict`] 校验 OpenSpec。
- [x] 3.2 [P0][Depends: 2.x][Input: 改动测试][Output: 失败用例更新为「不可达」期望][Verify: focused Vitest] 修回归测。
- [x] 3.3 [P0][Depends: 3.2][Input: 实现完成][Output: 门禁证据][Verify: `npm run typecheck` + focused tests + lint] 工程门禁。
- [ ] 3.4 [P1][Depends: 3.3][Input: 本地 app][Output: 人工清单勾选][Verify: manual] 无活动入口、无 Solo、雷达可用、对话流式正常。
