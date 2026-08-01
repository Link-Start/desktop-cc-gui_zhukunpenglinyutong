## Why

OpenCode 已 soft-retired：默认关闭、settings 无正常入口、control panel 不可达；但 legacy config、AppShell selection hook、全局 CSS 和 runtime compatibility code 仍残留。继续拆分千行面板没有产品收益，残余根链反而增加渲染和维护成本。

## 目标与边界

- 把 OpenCode 明确定义为 soft-retired compatibility engine。
- 阻止 legacy config 绕过产品入口策略。
- 移除不可达 panel、AppShell root hook 与无用全局 CSS。
- 保留读取历史/迁移或 foundation adapter 所需的最小 compatibility boundary。

## What Changes

- **BREAKING**：已有 legacy enable 值不再恢复 OpenCode 交互入口。
- 删除或隔离 `OpenCodeControlPanel` 及仅由其使用的 heuristic。
- AppShell 不挂载 OpenCode-specific selection/runtime hook。
- 修改旧 `opencode-engine` active UX requirements，使其只在显式 compatibility harness 中成立或正式 retired。

## 方案比较与取舍

- 方案 A：继续 modernize provider parser 并拆 panel。投入大且固化已退休产品，拒绝。
- 方案 B：soft-retirement hard boundary，保留最小 compatibility adapter。采用；若未来恢复产品入口，另开 change 重新评估。

## Capabilities

### New Capabilities

- `opencode-soft-retirement-boundary`: 定义不可达入口、legacy config normalization 与最小 compatibility surface。

### Modified Capabilities

- `opencode-engine`: 移除默认活跃 UI/runtime 假设，限定旧行为不再构成 production entry contract。

## 验收标准

- 默认和 legacy settings 均不能使 OpenCode 出现在生产交互入口。
- AppShell 不挂载 OpenCode root hook，不加载退休专用全局 CSS。
- 不可达 panel 删除或与 production bundle 隔离。
- 必需历史/诊断 compatibility 不误发 CLI command。

## 非目标

- 不 hard-delete 所有 OpenCode Rust 历史兼容代码。
- 不重构千行 panel。
- 不承诺未来恢复 OpenCode。

## Impact

- AppShell、engine settings/selection、OpenCode feature/CSS。
- OpenCode Rust compatibility adapter 和相关 main specs。
- Legacy settings migration 与 bundle/render checks。
