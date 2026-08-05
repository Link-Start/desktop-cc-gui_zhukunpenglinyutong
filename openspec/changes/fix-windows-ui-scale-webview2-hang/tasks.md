## 1. OpenSpec artifacts

- [x] 1.1 [P0] 创建 proposal / design / tasks / spec delta `client-ui-scale-platform-application`
- [x] 1.2 [P1] 在 `openspec/changes/README.md` 登记 active change

## 2. Implementation

- [x] 2.1 [P0] 新增 `src/utils/applyUiScale.ts` + `applyUiScale.test.ts`（四平台表驱动）
- [x] 2.2 [P0] 改 `useUiScaleShortcuts.ts` effect 调用 `applyUiScale`；禁止 Windows `setZoom(uiScale≠1)`
- [x] 2.3 [P0] 更新 `useUiScaleShortcuts.test.tsx`（Win/Mac/Linux/throw）
- [x] 2.4 [P0] 残留风险：apply 串行队列 + native pin 一次
- [x] 2.5 [P0] 右侧面板默认展开 + 一次 migration；essential chrome（topToolControls/rightActivityToolbar）强制可见
- [x] 2.6 [P0] Windows CSS zoom letterbox：zoom+`width/height = 100/scale %` 落在 **body**（勿 zoom html，overflow 先裁会黑边）；`scale===1` 与 macOS/Linux 清 html+body

## 3. Verification

- [x] 3.1 [P0] focused Vitest（applyUiScale + uiScale hook + clientUiVisibility）
- [ ] 3.2 [P1] 本机 dev 冷启动冒烟（**交用户验收**：Win `uiScale=0.8` 无黑框、可交互；Mac 缩放无 CSS width/height）
- [x] 3.3 [P2] **不** git commit（用户明确要求）

## 4. Docs

- [x] 4.1 [P1] 更新 analysis 文档状态指向本 change
