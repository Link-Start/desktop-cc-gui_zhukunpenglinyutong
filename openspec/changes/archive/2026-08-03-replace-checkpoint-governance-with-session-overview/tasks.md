# Tasks

## 1. OpenSpec / Contract

- [x] 1.1 创建 proposal / design / tasks / spec delta
- [ ] 1.2 实现后 sync 主 spec(`status-panel-session-overview` 新增;`dynamic-project-governance-evidence`、`governance-evidence-bridge` 应用 delta,archive 时执行)

## 2. client-ui-visibility 开关

- [x] 2.1 `clientUiVisibility.ts`:`CLIENT_UI_CONTROL_IDS` 新增 `bottomActivity.governanceEvidence`;`DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE.controls` 置 `false`;注册表 + `bottomActivityPanel.controls` 列表补登记
- [x] 2.2 i18n zh / en 补 `settings.clientUiVisibility.controls.bottomActivityGovernanceEvidence` 与 description;`src/test/vitest.setup.ts` 测试字典同步
- [x] 2.3 `useLayoutNodes.tsx` 计算 `governanceEvidenceVisible` 并传入 `ActiveCanvasStatusPanel.showGovernanceEvidence`

## 3. StatusPanel 治理门控 + verdict 解耦

- [x] 3.1 `StatusPanel.tsx`:新增 prop `showGovernanceEvidence`(默认 `false`);`useGovernanceEvidence` enabled 条件、`GovernanceEvidenceSection` 渲染、`costGovernanceEvidence` 合成、`governanceSnapshot` 构建四处统一门控
- [x] 3.2 确认关闭时 `buildCheckpointViewModel` 收到 `governanceSnapshot: null`,verdict 仅由会话信号决定

## 4. 会话概览 section

- [x] 4.1 `activeCanvasStatusPanelNode.tsx` selector 增选 `approvals` / `userInputRequests` / `activeRateLimits`,映射为 `pendingApprovals` / `pendingUserInputs` / `activeRateLimits` props
- [x] 4.2 `useLayoutNodes.tsx` 传 `workspaceName`;`StatusPanel` props 类型补齐(`threadStatusById` 收窄为含 `processingStartedAt` / `lastDurationMs` / `isContextCompacting` 的子集)
- [x] 4.3 `utils/sessionOverviewViewModel.ts`:`buildSessionOverview` 纯函数(字段与空态规则见 design.md 表格)
- [x] 4.4 `components/SessionOverviewSection.tsx`:紧凑 badges 渲染,复用 `sp-checkpoint-section` 样式体系;「结果」tab 内放在原治理证据位置
- [x] 4.5 i18n zh / en 补 `statusPanel.sessionOverview.*` 文案;vitest.setup.ts 同步

## 5. 测试

- [x] 5.1 `clientUiVisibility` 单测:新 control 默认 false + round-trip
- [x] 5.2 `sessionOverviewViewModel` 单测:字段派生 / 空态 / pending 计数
- [x] 5.3 `SessionOverviewSection` 组件测试
- [x] 5.4 `StatusPanel.test.tsx` 更新:默认无治理证据渲染、verdict 不受治理 fixture 影响;`showGovernanceEvidence` 开启后恢复治理断言

## 6. 结果详情默认隐藏(第二轮追加)

- [x] 6.1 `clientUiVisibility.ts`:新增 control `bottomActivity.checkpointDetails`,默认 `false`,注册表 + panel controls 列表补登记;i18n zh / en + vitest.setup.ts 测试字典
- [x] 6.2 `useLayoutNodes.tsx` 计算并传 `showCheckpointDetails`;`StatusPanel` 新增同名 prop(默认 `true`,保证 popover 与直渲染测试不变),门控 `CostBudgetSection` + `CheckpointPanel` 渲染
- [x] 6.3 tab badge verdict 保持照常计算(`buildCheckpointViewModel` 不受详情开关影响)

## 7. Verify

- [x] 7.1 `tsc --noEmit` 干净;status-panel / client-ui-visibility / layout / governance / settings 相关测试全绿;eslint 干净
- [ ] 7.2 手工:默认打开「结果」tab 只剩会话概览;设置里打开「结果详情」后恢复完整 checkpoint 表面
