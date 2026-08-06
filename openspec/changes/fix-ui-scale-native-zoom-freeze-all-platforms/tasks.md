# Tasks: fix-ui-scale-native-zoom-freeze-all-platforms

## 1. OpenSpec artifacts

- [x] 1.1 [P0] 创建 proposal / tasks `fix-ui-scale-native-zoom-freeze-all-platforms`
- [x] 1.2 [P1] 在 `openspec/changes/README.md` 登记 active change

## 2. Implementation

- [x] 2.1 [P0] `applyUiScale` 三端统一 CSS transform scale；native `setZoom(1)` 全平台只钉一次；删除 macOS/Linux native 分支与死代码
- [x] 2.2 [P0] 新增 `uiScaleStartupGuard`：pending 记录 + 8s+rAF 健康确认 + pagehide 清除 + `shouldForceUiScaleIdentity`
- [x] 2.3 [P0] `useUiScaleShortcuts` effect 接入看门狗：残留记录 → 本次会话临时 100% + diagnostic + runtime notice；非 1 apply 打 pending；apply 1 清记录
- [x] 2.4 [P1] i18n `runtimeNotice.uiScale.startupGuardReset` ×10 语言

## 3. Verification

- [x] 3.1 [P0] focused vitest：`applyUiScale.test.ts`（18）、`useUiScaleShortcuts.test.tsx`（6）、`uiScaleStartupGuard.test.ts`（8）全绿
- [x] 3.2 [P0] `tsc --noEmit` + 改动文件 ESLint 通过；`src/i18n` 测试 37/37 绿
- [ ] 3.3 [P0] 真机验收（交用户）：macOS `uiScale=0.9` 冷启动/快捷键缩放不卡死；Windows `uiScale=0.8` 回归；模拟看门狗（手写 localStorage pending 记录）启动 → 临时 100% + 有提示
- [ ] 3.4 [P1] Linux 冒烟（无环境则 PR 注明未测）
- [ ] 3.5 [P0] **不 git commit**（交用户验收后决定）

## 4. Docs

- [x] 4.1 [P1] 更新 `docs/analysis/windows-ccgui-startup-hang-2026-08-05.md` 状态指向本 change
