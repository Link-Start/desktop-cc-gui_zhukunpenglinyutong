## Why

生产包冷启动在恢复 persisted selected agent 与异步 built-in agent catalog 时，再次触发 React #185 `Maximum update depth exceeded`。现有 `useSelectedAgentSession` 仍让 reload effect 订阅并回写同一个 React cache state；新增 built-in catalog readiness 与 identity migration 后，这个潜在自反馈路径变得可达。

## What Changes

- 让 selected-agent reload 与 migration 读取同步 cache ref，而不是订阅自身写入的 React cache state。
- 将 ref、React state 与 client storage 的等价判断收口到单一 cache writer，保证恢复操作幂等。
- 收敛 AppShell 冷启动 catalog reload ownership，避免同一 mount window 重复发起相同 reload。
- 增加 React StrictMode 回归测试，覆盖 persisted built-in selection、async catalog readiness 与 thread identity migration 的组合路径。
- 不新增 dependency，不改变 Tauri command、agent storage key 或 value schema。

## Capabilities

### New Capabilities

- `agent-startup-selection-stability`: 定义 Agent catalog 与 thread-scoped selected agent 在冷启动恢复期间必须无环、幂等并有限收敛。

### Modified Capabilities

- 无。

## Impact

- Affected code:
  - `src/app-shell-parts/useSelectedAgentSession.ts`
  - `src/app-shell-parts/useSelectedAgentSession.test.tsx`
  - `src/app-shell.tsx`
  - `src/app-shell.startup.test.tsx`
- APIs: 无 external API 变化。
- Dependencies: 不新增依赖。
- Storage: 保持现有 `app/composer.selectedAgentByThread.*` key 与 value schema。

## 目标与边界

- 目标：selected-agent reload 不得由自身 cache write 重新触发。
- 目标：catalog 从 pending 变为 ready 时，合法 persisted built-in agent 稳定恢复，失效 agent 至多清理一次。
- 目标：AppShell 每个冷启动 mount window 只有一个 catalog reload owner。
- 边界：只修 Agent selection 与 catalog 的 startup convergence，不重构 AppShell 其他启动状态。

## 非目标

- 不修改 built-in agent catalog 内容、启停规则或 prompt resolution。
- 不清理用户历史 persisted state。
- 不改变 composer model selection、发送参数或 backend agent catalog API。
- 不为未来状态管理引入 reducer、external store 或新 dependency。

## 技术方案取舍

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 增加 last-run guard | 相同 key 的 reload 只运行一次 | diff 最小 | 会吞掉 catalog ready 后的合法重算，掩盖真实依赖环 | 不采用 |
| B. 同步 cache ref + 单一 equality gate | reload/migration 从 ref 读取，真实变化才通知 React state 与 storage | 复用 composer 已验证模式，切断自反馈且保持现有 contract | 需要补 ref/state/storage 一致性测试 | 采用 |
| C. 重构为 reducer/external store | 把 catalog、selection、migration 建模为完整 state machine | 长期边界最清晰 | hotfix 范围和回归面过大 | 暂不采用 |

## 验收标准

- React StrictMode 下，persisted built-in selection、catalog readiness 与 pending-to-canonical migration 连续发生时，hook 在有限 render 内收敛且不报 React #185。
- 等价 selected agent 不创建新 cache state reference，不重复写 client storage。
- AppShell 冷启动只自动调用一次 `reloadAgentCatalog()`；Settings 关闭后的刷新语义保持可用。
- Focused Vitest、`npm run typecheck`、`npm run lint` 与 strict OpenSpec validation 通过。
