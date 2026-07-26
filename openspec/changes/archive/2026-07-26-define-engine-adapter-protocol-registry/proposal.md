## Why

当前“引擎 registry”主要是 ID、label 和 switch 的集中化诉求，process spawn/parsing、session semantics 与消息投递仍按 engine 各自实现。新增 CLI 或未来 plugin engine 仍会复制一整条 runtime。

## 目标与边界

- 建立 `EngineAdapter × EngineProtocol` 分层 contract。
- built-in engine 保留 Rust enum；external/plugin engine 使用稳定 string `EngineId`。
- registry 记录 source/provenance、capabilities、lifecycle 和 protocol binding。
- runtime manager 统一 handle create/replace/rebind/abort/teardown。

## What Changes

- `EngineProtocol` 负责 executable resolution、spawn、stdin、stdout/stderr parse 与 termination。
- `EngineAdapter` 负责 identity、capability、session semantics 和 delivery mapping。
- 建立 registry parity/schema gate，builtin 与 external registration 分开验证。
- session replace 后旧 handle fail-fast，只允许 plain data 跨 runtime boundary。

## 方案比较与取舍

- 方案 A：单一万能 engine object。接口简单，但把 protocol 与 domain 继续耦合，拒绝。
- 方案 B：adapter/protocol composition + runtime manager。采用；复用 protocol 的同时保留 engine-specific semantics。

## Capabilities

### New Capabilities

- `engine-adapter-protocol-registry`: 定义 built-in/external engine registration、adapter/protocol composition 与 lifecycle ownership。

### Modified Capabilities

无。

## 验收标准

- Codex persistent app-server 与 spawn-per-turn CLI 通过同一 adapter contract 接入。
- registry 能表达 built-in 和 external engine provenance。
- session replacement、abort、teardown 不遗留 process 或 listener。
- 新 built-in engine 的 frontend/Rust/daemon parity 可由 CI 检出。

## 非目标

- 不实现 plugin loader、sandbox 或 marketplace。
- 不把 Rust built-in enum 改成无类型 JSON。
- 不改变现有用户可见 engine 名称。

## Impact

- Rust engine modules、daemon bridge、runtime process registry。
- Frontend engine registry projection 与 realtime adapter migration。
- Engine onboarding governance tests。
