## Why

当前 `0.7.7` production bundle 在 heavy Codex conversation streaming settlement 期间仍可触发 React #185 `Maximum update depth exceeded`，并把整个应用推进全局 `Application Error`。source map 将失败表面映射到 `MessagesCore`，但可执行 startup regression 进一步证明根因来自 AppShell sibling Quick Switcher 的 recent-files effect：等价 `workspaces` 数组换引用后，无条件发布新 state，导致父层无限重渲染。

## What Changes

- 用 production bundle stack、renderer diagnostics 与 AppShell startup OOM 建立可执行归因链。
- 在 `useQuickSwitcherRecentFiles` 的共享 refresh updater 中，对语义等价 projection 复用旧 state reference，切断 AppShell feedback loop。
- 保留真实 recent-file storage event、workspace rename 与 Quick Switcher 分组更新行为。
- 恢复 AppShell startup regression gate，避免无关 Quick Switcher test fixture 继续遮蔽启动链测试。
- 不新增 dependency，不改变 Tauri command、conversation storage schema 或 engine history payload。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `client-renderer-stability-under-pressure`: AppShell sibling feature 的等价 collection refresh 不得形成 parent render feedback loop；真实 observable transition 仍须发布。

## Impact

- Affected code:
  - `src/features/quick-switcher/hooks/useQuickSwitcherRecentFiles.ts`
  - `src/features/quick-switcher/hooks/useQuickSwitcherRecentFiles.test.tsx`
  - `src/app-shell.startup.test.tsx`
- APIs: 无 external API 变化。
- Dependencies: 不新增。
- Storage: 无 schema 变化；production diagnostics 只读取 content-safe metadata。

## 目标与边界

- 目标：AppShell 面对等价 collection identity churn 时有限收敛，不触发 React #185。
- 目标：修复真实 state feedback owner，并用 referential-equality assertion 锁定。
- 边界：只处理 Quick Switcher recent-files projection loop 与对应 startup fixture。

## 非目标

- 不以 ErrorBoundary retry、提高 React update limit 或禁用 conversation 功能作为修复。
- 不重构整个 Messages architecture、virtualizer 或 AppShell state model。
- 不把历史 prompt、assistant text、tool output 或文件内容写入 diagnostics/test fixture。

## 技术方案取舍

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. updater 归因 + 根因幂等修复 | 用现有 updater tracking、production diagnostics 和组合测试定位 feedback owner，在共享 hook/helper 切断闭环 | 修复真实根因，diff 可控，可覆盖同类入口 | 需要先完成可靠复现 | 采用 |
| B. AppShell 全局 render-loop guard | 超预算后停止部分 state write | 止血快 | 会吞合法 feature 更新，掩盖新闭环 | 不采用 |
| C. 要求所有调用方稳定 `workspaces` reference | 在上游逐处 `useMemo` | 局部容易验证 | 漏掉任一调用方仍可复发，ownership 错位 | 不采用 |

## 验收标准

- AppShell startup regression 有限完成，无 React #185 或 heap exhaustion。
- Quick Switcher updater 对等价 projection 返回原引用；真实 recent-file transition 仍发布。
- 既有 Messages streaming/recovery suites 保持通过，证明截图对应 conversation surface 无回退。
- AppShell startup focused tests、Messages focused tests、`npm run typecheck`、`npm run lint`、`npm run build` 通过。
- `openspec validate fix-messages-core-update-depth-loop --strict --no-interactive` 通过。
