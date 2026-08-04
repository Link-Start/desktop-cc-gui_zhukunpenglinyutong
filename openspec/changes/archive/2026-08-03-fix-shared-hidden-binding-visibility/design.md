## Context

Shared Session 用 **Hidden Native Binding** 承载 Claude/Codex/Kimi/Grok/OpenCode 的真实
runtime session。用户只应看到一条 `shared:*` 行；binding 的 native session 必须从
thread list / catalog / tabs 过滤。

当前过滤入口已存在：

1. `list_shared_sessions` → `nativeThreadIds`（V0 meta + V2 `shared_binding_state`）
2. FE `hiddenSharedBindingIds = Set(nativeThreadIds)`
3. Claude/Codex/Kimi/Grok/OpenCode merge 路径 `has(id)` 跳过

Claude 能藏住：materialize 预分配 `claude:{uuid}`，CLI 用同一 id。  
Grok 漏：materialize 写 `grok-pending-shared-*`，send 在 `continue_session=false` 时
再生成新 UUID → 落盘 id ≠ binding id。  
Kimi/OpenCode 漏：CLI 事后产出真实 id，binding 仍停在 pending，hide set 匹配失败。

## Goals / Non-Goals

**Goals**

- Grok/Kimi/OpenCode Shared-owned binding 与 Claude/Codex 一样对用户不可见。
- binding identity 与落盘/list id 对齐（或 hide set 可等价匹配）。
- 改动面窄、可回归、不破坏 Native 路径。

**Non-Goals**

- 不清理历史 orphan 磁盘 session。
- 不改 Shared send 状态机 / Context Package 语义。
- 不引入新 IPC。

## Decisions

### D1 — Grok 预分配 identity（对齐 Claude）

- materialize：`grok:{uuid}`（拒绝把 pending 当 established）。
- shared send 始终传 raw uuid 给 engine。
- `resolve_grok_session_id_for_engine_send`：`continue_session=false` 时若有 explicit
  id 仍使用它（Grok `-s` 支持 caller-chosen UUID）；否则新生成。
- `normalize_native_session_identity`：Grok 与 Claude 一样补 `grok:` 前缀，保证
  hold / SessionStarted / binding 同一 key。

### D2 — Kimi / OpenCode 事后 rebind

- materialize 可先写 pending 或 engine-prefixed provisional id。
- 真实 id 在 SessionStarted / SessionHint / settlement 出现后，upsert
  `native_session_id` 为 `kimi:{id}` / `opencode:{id}`。
- FE `thread/started`：pending rebind 引擎集合扩为 shared 五引擎
  （`claude|codex|kimi|grok|opencode`）。
- 不在 Kimi/OpenCode 上强行预分配 CLI 不支持的 id。

### D3 — FE hide set 等价扩展

构建 hide set 时对每个 binding id 收录：

- 原文
- 若带 `engine:` 前缀 → 同时收 raw
- 若为 raw 或 pending → 同时收 `engine:raw`（五 shared engines）

避免 catalog `grok:xxx` 与 binding `xxx` 差一个前缀就漏过滤。

### D4 — 边界硬约束

| 允许 | 禁止 |
|------|------|
| Shared-owned binding hide | 隐藏用户主动 Native 会话 |
| identity / rebind / hide set | 标题启发式 |
| focused tests | 全量 test 强依赖 |
| Claude/Codex 行为不变 | 改 Shared architecture |

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Grok 预分配 id 与 CLI 行为不符 | 已有 `-s` 契约；加 unit test |
| Kimi 真实 id 晚到，首帧短暂可见 | rebind 后下次 list 隐藏；可接受 |
| hide set 过宽误伤 | 仅扩展 shared 五引擎前缀，不扫 Gemini 用户会话 |
| 历史 orphan 仍可见 | 文档声明非本次范围 |

## Migration

- 无 DB migration。
- 已存在 pending binding：下次 Shared turn rebind / materialize 时收敛到真实 id。
- 历史 orphan native 行：用户可手动删除；不自动 purge。

## Open Questions

无（实现边界已在 proposal 锁定）。
