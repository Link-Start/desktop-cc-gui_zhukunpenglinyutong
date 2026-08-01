## Why

`0.7.7` 安装包在升级后的首次冷启动仍可触发 React `#185`（`Maximum update depth exceeded`），全局 ErrorBoundary 因而替换整个 AppShell。现有 Quick Switcher equality guard 已进入同一 bundle，说明仍有一条独立的 cold-start state publication feedback path，需要用可执行回归定位并在真实 owner 处收敛。

## What Changes

- 以当前 production bundle sourcemap、renderer diagnostics 和脱敏 client-store shape 建立升级后首次冷启动回归。
- 将 cold-start 派生 projection 与 React state publication 解耦；逻辑值不变时不调度 state update。
- 保留真实 persisted-state 恢复、workspace rename 和 recent-file event 更新语义。
- 增加 focused regression，确保首次启动与等价 parent rerender 都有限收敛。
- 不新增 dependency，不修改 Tauri API 或 client-store schema。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `client-renderer-stability-under-pressure`: 升级后首次冷启动的 AppShell sibling projection MUST 有限收敛，不得因等价 collection/object identity churn 触发 React `#185`。

## Impact

- Affected code：AppShell cold-start orchestration、对应 feature hook 与 focused tests。
- APIs：无 external API 变化。
- Dependencies：无新增。
- Storage：无 schema 变化，不清理用户数据。

## 目标与边界

- 目标：定位当前 `App-DsnJgL2d.js` 对应代码中的第二条 cold-start feedback owner，并做最小幂等修复。
- 目标：升级后首次启动和随后重启都不得进入全局 Application Error。
- 边界：只修改被回归测试证明的 state owner 与必要测试/spec。

## 非目标

- 不提高 React update limit，不用 ErrorBoundary reload 掩盖根因。
- 不重构整个 AppShell、Messages 或 client storage。
- 不复制 prompt、message、文件内容等敏感数据到 fixture。

## 技术方案取舍

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 可执行归因后修复共享 owner | 用 persisted-state shape 和 parent identity churn 复现，在真实 updater/derived projection 处去除反馈 | 根因明确、diff 小、可防回归 | 需要先补齐真实 fixture | 采用 |
| B. AppShell 全局 update budget | 超阈值后忽略后续更新 | 止血快 | 会吞掉合法更新并留下坏状态 | 不采用 |
| C. 清理本地 store | 删除触发数据 | 当前机器可能恢复 | 丢用户状态且下次升级仍可能复发 | 不采用 |

## 验收标准

- focused cold-start regression 在等价 parent rerender 与 persisted-state hydration 下有限完成。
- 真实 observable change 仍能发布到 UI。
- 目标 Vitest、受影响文件 lint/typecheck 与 production build 通过；不跑全量测试。
- OpenSpec strict validation 通过。
