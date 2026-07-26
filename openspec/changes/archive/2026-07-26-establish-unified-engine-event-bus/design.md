## Context

现有 TypeScript domain event schema 明确禁止 runtime bus；Rust engines 又通过多条 forwarder/Tauri channel 直接抵达 frontend。新 bus 必须修改旧禁止性 contract，并守住 streaming render baseline。

## Goals / Non-Goals

**Goals:** Rust ingress 归一化、private publish、isolated fan-out、唯一 `run.settled`、frontend compatibility。

**Non-Goals:** 不做 plugin runtime、durable orchestration log 或 public publish API。

## Decisions

1. bus 位于 Rust engine layer，`MossxAgentEvent` 为 immutable envelope。
2. engine adapter 负责原始事件映射；bus 负责 sequence、identity、provenance 和 settlement dedupe。
3. 每个 sink 使用 bounded queue；慢 sink 记录 diagnostics，不能阻塞 CLI stdout reader。
4. frontend sink 继续投影现有 app-server/realtime event，并保留 40ms batching、critical bypass 与 `liveAssistantTextChannel`。
5. `run.settled` 由 runtime lifecycle owner 产生；response accepted、delta、engine-specific terminal 仅作为证据。

## Risks / Trade-offs

- [双路径重复事件] → shadow bus 比对后再切 owner，并以 event identity 去重。
- [bounded queue 丢事件] → terminal/settled/control 为不可丢 critical lane；delta 可聚合并记录 drop count。
- [root render 回退] → 禁止 bus 直接 set React root state，运行现有归因/性能 harness。

## Migration Plan

按 Codex、Claude、Kimi 顺序 shadow-map；验证 parity 后逐 engine 切 frontend sink；最后移除旧 direct forwarder。feature flag 可逐 engine 回滚。

## Open Questions

初始 queue capacity 与 delta coalescing window 由压力测试校准，不写死为永久架构常量。
