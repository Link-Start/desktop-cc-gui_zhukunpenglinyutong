## Why

Rust、daemon 与 TypeScript 对 `EngineFeatures` 的字段名和语义不一致，且 production capability projection 仍用固定 `unknown` 掩盖可知事实。未来 adapter、message delivery 和 plugin registration 若建立在错误能力判断上，会继续产生误开、误关和静默降级。

## 目标与边界

- 建立跨 Rust / daemon / TypeScript 的统一 runtime capability DTO。
- 区分 spec stance、policy enabled、runtime available 与 compatibility input。
- 让 production runtime 消费生成 artifact，而不是直接 import `openspec/**` fixture。
- 扩展 `input.mid-turn`、session control 与 RPC readiness capability domain。

## What Changes

- 对齐 `reasoningEffort`、`toolsControl`、`sessionResume`、`collaborationMode`、`mcp` 等字段。
- capability lookup 返回结构化状态和原因，不再把缺失字段直接压成 `unsupported`。
- OpenSpec matrix 继续作为 authoritative input，生成 frontend/Rust 可消费 artifact。
- CI 校验 spec、generated artifact、Rust、daemon 与 TypeScript parity。

## 方案比较与取舍

- 方案 A：继续维护四份常量并增加测试。改动小，但仍存在多 owner 与人工同步，拒绝。
- 方案 B：OpenSpec matrix 生成 production artifact，各 runtime 显式投影并由 CI 校验。采用；兼顾治理 SSOT 与 Rust 类型安全。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `engine-capability-matrix`: 扩展状态维度、production artifact、runtime query 与新 capability domain contract。

## 验收标准

- 已知 capability 不再因 DTO 字段错位显示为 `unknown` 或 `unsupported`。
- Kimi、Claude、Codex 的 tool/session capability 与 Rust 声明一致。
- `input.mid-turn`、session fork/switch/tree、RPC readiness 可通过统一 API 查询。
- `npm run check:engine-capability-matrix` 与跨层 contract tests 通过。

## 非目标

- 不实现 steering、session fork 或 RPC server。
- 不动态生成 Rust built-in enum。
- 不在本 change 拆分 `useEngineController`。

## Impact

- Frontend：engine types、capability projection、policy consumers。
- Rust/daemon：`EngineFeatures` DTO、generated matrix projection。
- Governance：matrix generator、CI parity gate、OpenSpec fixture。
