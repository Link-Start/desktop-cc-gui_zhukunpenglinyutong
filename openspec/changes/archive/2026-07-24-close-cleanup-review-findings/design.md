## Context

Cleanup wave 删除了 JCEF backend refresh calls，但 provider 仍保留 callback/waiter/retry consumer，形成无 producer 的等待链。Semantic review 的 per-turn cache 只使用 identity，未绑定输入内容；frontend timeout 又无法取消已发出的 Tauri request。Storage quarantine 使用秒级 timestamp，同秒重复 recovery 可能命名冲突。

## Goals / Non-Goals

**Goals:**

- 让无 runtime producer 的 completion provider 立即、确定性地降级。
- 让 semantic review cache 与实际输入一致，并保证 engine fallback 串行。
- 让 corrupted backup filename 唯一。
- 删除已不可达的 notice presentation branch。

**Non-Goals:**

- 不设计新的 command discovery protocol。
- 不引入 AbortSignal 跨 Tauri IPC cancellation。
- 不清理整个 responsive parameter graph。

## Decisions

### Decision 1: 删除 legacy provider state，而不是模拟 refresh

Slash provider 只保留 local commands；prompt provider 只保留 empty/create fallback。外部通过 props 注入的 project command/prompt provider 保持不变。

Alternative：保留 callback 并将 timeout 缩短。拒绝，因为 producer 不存在，任何等待都是错误状态。

### Decision 2: cache key 使用 input fingerprint

Key 由 `workspaceId + turnKey + language + normalized entries` 计算。使用本地稳定 hash，避免把完整 diff 复制到 Map key；同时加入 serialized length 降低碰撞风险。

Alternative：turn 完成后才允许生成。拒绝，因为 hook 当前没有稳定 turn-complete contract，扩大调用链。

### Decision 3: 删除 frontend-only timeout

不可取消的 `engineSendMessageSync` 必须 settle 后才可 fallback。Backend/runtime 自身负责 request timeout。

Alternative：timeout 后立即 fallback。拒绝，因为原 request 仍运行，会产生双 task / 双 cost。

### Decision 4: backup filename 增加 UUID

保留 timestamp 便于人工识别，同时追加 UUID 保证跨平台 rename target 唯一。

Alternative：毫秒 timestamp。拒绝，因为并发与低分辨率 clock 下仍非严格唯一。

## Risks / Trade-offs

- [首个 semantic engine 极端情况下长时间不 settle] → 不并发 fallback；后续若需要 bounded UX，应先扩展 cancellable backend contract。
- [fingerprint hash 理论碰撞] → 同时包含 serialized length；输入规模小且 cache 上限 100。
- [slash 只剩 local fallback] → 这是当前 Tauri 的真实能力；project custom commands 继续由 adapter props 提供。

## Migration Plan

1. 先落 focused tests，再删除 legacy branches。
2. 运行 typecheck、focused lint/Vitest/cargo。
3. Strict validate change 后同步并归档。
4. 回滚时可 revert correction commit；无 data migration。

## Open Questions

无。本次不扩展 backend cancellation contract。
