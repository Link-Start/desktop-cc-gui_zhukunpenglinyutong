## Why

当前 thread ID 同时承担 engine routing、native session、pending alias 和 UI row identity，大量业务代码依赖字符串前缀。Kimi、Claude 的 pending-to-canonical promotion 已证明该模型会造成重复消息、迟到 delta 复活旧 row 和 terminal settlement 分叉。

## 目标与边界

- 定义 `logicalSessionId`、`nativeSessionId`、`pendingAlias` 的职责。
- 定义 `runId`、`turnId`、`itemId` 的稳定关联规则。
- 显式 engine identity 优先，prefix 仅作为 legacy compatibility boundary。
- 保留既有 persisted thread ID，不进行一次性数据迁移。

## What Changes

- 新增统一 identity value objects 与 mapping owner。
- event、action、history 与 UI projection 通过显式 identity contract 关联。
- Kimi/Claude promotion 通过 alias mapping 收敛，不由无状态 prefix parser 猜测。
- 增加 prefix fallback telemetry 和禁止新增 literal branch 的 gate。

## 方案比较与取舍

- 方案 A：集中一个 `parseThreadEngineIdentity` helper。只能减少散点，无法表达 alias/promotion，拒绝作为最终方案。
- 方案 B：显式 logical/native/pending identity + legacy parser boundary。采用；允许渐进迁移且保留历史兼容。

## Capabilities

### New Capabilities

- `engine-runtime-identity`: 定义跨 engine 的 session、run、turn、item identity 与 alias convergence contract。

### Modified Capabilities

无；Kimi-specific promotion 的加强由 `harden-kimi-engine-governance` 独立 change 负责。

## 验收标准

- 新业务代码不再新增 `startsWith("<engine>:")`。
- 同一 logical session 在 pending、history-first 和 terminal-after-promotion 时只有一个用户可见 row。
- run/turn/item identity 在 frontend bridge、history 和 diagnostics 中可关联。
- persisted legacy ID 无破坏性重写。

## 非目标

- 不迁移全部历史 thread ID。
- 不建立 event bus。
- 不实现跨设备 session identity。

## Impact

- Frontend thread adapters、reducers、actions、history loaders、live text channel。
- Rust runtime event envelope 与 session mapping。
- Scanner、telemetry 和 focused sequence tests。
