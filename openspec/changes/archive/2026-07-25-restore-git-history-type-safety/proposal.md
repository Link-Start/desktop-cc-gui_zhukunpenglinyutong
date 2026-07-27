## Why

Git History 的四个核心文件仍用 `@ts-nocheck` 屏蔽 494 个 diagnostics。delete、reset、rebase、checkout 等高风险操作因此缺少 compile-time contract，继续扩展会放大误传 payload 与 dead scope drift。

## 目标与边界

- 为 Impl、View、Dialogs、Interactions 建立 typed scope contracts。
- 删除剩余四个 `@ts-nocheck`，修复全部 diagnostics。
- 保留现有 Git 操作、UI、persistence 与 service signatures。
- 用 focused tests 和 `tsc --noEmit` 证明行为与类型闭环。

## 非目标

- 不重新设计 Git History UI。
- 不修改 Rust Git commands。
- 不借机合并或删除现有 Git capability。

## What Changes

- 将 giant `scope: any` 收敛为按 consumer 推导的 typed contract。
- 删除未使用的 scope fields、imports 和死参数。
- 修复 effect cleanup、callback payload 与 state updater 类型。
- 移除四个 `@ts-nocheck`。

方案 A 是给 494 个位置逐个补 annotation，改动快但会固化 giant scope。方案 B 是先建立共享 source scope，再用 `Pick`/consumer contract 约束各层；采用方案 B，因为它修复根因并减少后续 drift。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `git-history-panel`：核心 panel 的 render/interaction/dialog 边界必须接受类型检查，且高危操作 contract 不得依赖 `any`。

## Impact

- Frontend：Git History Impl、View、Dialogs、Interactions 与 focused tests。
- Tooling：TypeScript、ESLint、large-file diagnostics。
- 无新增 dependency，无 backend payload 变化。

## 验收标准

- 五个目标文件中 `@ts-nocheck` 数量为 0。
- 临时 stripped-check diagnostics 从 494 降为 0。
- `npm run typecheck` 与 Git History focused tests 通过。
- delete/reset/rebase/checkout capability symbols 与测试仍存在。
