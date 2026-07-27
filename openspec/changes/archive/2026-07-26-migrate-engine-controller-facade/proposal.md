## Why

`useEngineController` 同时承担 selection、availability、catalog merge、storage migration、effects 和 notices。直接机械拆分会把旧 contract 扩散；在 capability、registry、catalog 和 lifecycle owner 稳定后，应完成最后的 facade 迁移和删除。

## 目标与边界

- 保留 AppShell 可兼容调用的窄 facade，逐步迁移到 foundation owner。
- selection、availability、catalog、runtime notices 各自只有一个状态 owner。
- facade 不订阅高频 message/event bus 数据。
- 最终使 controller 降到治理阈值内或删除。

## What Changes

- 将已建立的 registry、capability、catalog 与 lifecycle API 接入 facade。
- 删除 facade 内重复 merge、engine map、storage migration 和 side-effect owner。
- 用 typed domain inputs/outputs 替代大返回对象传播。
- 加入 facade equivalence、render isolation 与 large-file gate。

## 方案比较与取舍

- 方案 A：先按文件长度拆成多个 hooks。会复制旧 owner，拒绝。
- 方案 B：先迁移 ownership，再缩薄 compatibility facade。采用；diff 可分段验证且不改变 AppShell 行为。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `app-shell-runtime-boundaries`: 增加 engine controller facade ownership migration 与高频事件隔离 contract。

## 验收标准

- AppShell engine selection/model/status 用户行为不变。
- controller 不再拥有重复 engine registry、capability 或 catalog 事实。
- 高频 delta 不触发 facade/AppShell root 重算。
- focused tests、typecheck、render regression 与 large-file gate 通过。

## 非目标

- 不改变 Composer UI。
- 不拆 OpenCode retired panel。
- 不在 foundation changes 完成前实施本 change。

## Impact

- `useEngineController`、AppShell engine wiring、models/vendors hooks。
- Typed runtime boundaries、render tests 与 large-file governance。
