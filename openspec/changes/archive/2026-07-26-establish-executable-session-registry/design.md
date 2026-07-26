## Context

Frontend catalog 能展示 session，但不应拥有 live process handle。backend 需要把 session execution ownership、control lane 与 durable recovery 分开。

## Goals / Non-Goals

**Goals:** executable registry、plain-data persistence、durable cursor、deadlock-safe control。

**Non-Goals:** 不替换 workspace UI catalog，不实现云同步或完整 scheduler。

## Decisions

1. backend registry key 使用 logical session identity，entry 指向 current runtime generation 和 native binding。
2. live handle 只存在内存；durable record 保存 identity、adapter、state、cursor、last settled run。
3. transition append-only，snapshot 可压缩但不得丢 idempotency evidence。
4. control commands 进入独立 serial lane；event handlers 只能 enqueue，不同步等待同 lane response。
5. frontend 通过 selector projection 订阅低频 session facts。

## Risks / Trade-offs

- [日志增长] → checkpoint/compaction 保留 cursor 和 idempotency set。
- [crash 后半完成状态] → replay 根据 settled/abort evidence 收敛。
- [registry 与 catalog 分叉] → catalog 只消费 registry projection，不反向拥有 handle。

## Migration Plan

先实现 in-memory registry，再加入 append-only record 与 recovery，最后迁移 active session controls。旧 catalog 保持读取兼容，失败可切回旧 control owner。

## Open Questions

持久化文件位置与 compaction threshold 在实现前依据现有 app-data owner 选定。
