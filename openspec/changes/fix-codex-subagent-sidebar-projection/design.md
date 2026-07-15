## Context

当前 local scanner 对 sessions root 中每个 `.jsonl` 调用 `parse_codex_session_summary()`。Codex child rollout 的结构示例：

```json
{
  "type": "session_meta",
  "payload": {
    "id": "child-uuid",
    "cwd": "/workspace",
    "source": {
      "subagent": {
        "thread_spawn": {
          "parent_thread_id": "parent-uuid",
          "agent_nickname": "Aristotle",
          "agent_path": "/root/intuition-audit"
        }
      }
    }
  }
}
```

Scanner 当前只把 string `source` 映射到 `LocalUsageSessionSummary.source`；object source 被忽略。Catalog construction 随后设置 `parent_session_id: None`。Frontend tree 已能消费 `ThreadSummary.parentThreadId`，所以缺口集中在 source-fact parsing 与 cross-layer projection。

## Goals / Non-Goals

**Goals:**

- 保留 child 的 canonical UUID、usage、cost、physical path 与 provider metadata。
- 从 structured metadata 建立 deterministic parent link。
- child title 使用 agent nickname/path label，避免继承 parent prompt。
- 同时覆盖 authoritative catalog 与 runtime local fallback。
- 复用现有 generic Sidebar parent-child tree，不新增并行 UI tree。

**Non-Goals:**

- 不隐藏或删除 Codex child transcript。
- 不按 title 去重，也不把 child identity 改写为 parent UUID。
- 不修改 Codex TUI / resume 的文件格式。
- 不改变 child transcript loading、turn settlement 或 collaboration card behavior。

## Decisions

### Decision 1: parse structured subagent metadata once at local source boundary

在 `local_usage.rs` 增加 pure extractor，兼容 snake_case / camelCase keys，并只在发现 non-empty `parent_thread_id` 时认定为 Codex child。parser 在首次有效 child metadata 后保持该 relationship，后续嵌入的 parent `session_meta` 不得覆盖它。

### Decision 2: keep parent relationship as optional source fact

`LocalUsageSessionSummary` 增加 optional `parent_session_id`。该字段是 transcript source fact，不是 workspace membership 或 organization metadata；catalog 每次仍重新执行 ownership attribution。

### Decision 3: prefer agent identity for child display title

child display label precedence：`agent_nickname` → `agent_path` basename → existing user-summary fallback。该规则只作用于 identified subagent，不改变普通 Codex session title truth。

### Decision 4: propagate relationship through every visible local projection

- workspace/global catalog entry：`parent_session_id = summary.parent_session_id`
- local Codex thread JSON / daemon adapter：输出 `parentSessionId`
- frontend runtime fallback：normalize 到 `parentThreadId`
- catalog merge 已有 `parentSessionId -> parentThreadId` behavior，保持不变。

### Decision 5: canonical dedupe precedes limits and visible-id projection

`scan_codex_session_summaries()` 在任何 usage aggregation 或 workspace/global limit 之前按 canonical `session_id` 去重。重复记录选择较新的 physical evidence，同时合并 aliases，并保留任一副本中的 subagent relationship 与 agent title；usage/cost 取最大完整 evidence，禁止求和造成 double count。

runtime local/live merge 允许 visible row 保留 app-server 返回的 rollout filename alias，但 MUST 用 local canonical identity 覆盖 `canonicalSessionId`，随后建立 canonical/alias → visible id map，将 child `parentSessionId` 归一到 Sidebar 实际可见的 parent row id。

## Risks / Trade-offs

- [Risk] structured `source` schema 演进导致漏识别。
  - Mitigation：兼容 snake_case/camelCase，并对未知结构 fail open 为普通 session。
- [Risk] parent 不在当前 bounded page 时 child 暂时仍成为 root。
  - Mitigation：保持 child identity/parent field；load-older 或 continuity refresh 后 tree 自动收敛，不扩大 membership。
- [Risk] duplicate physical rollouts 在去重前占用 scan limit，导致 older rows 永久不可分页或 usage double count。
  - Mitigation：source boundary canonical dedupe 先于 sort/limit/statistics，workspace children count 在 catalog dedupe 后计算。
- [Risk] live row 使用 rollout filename alias，canonical parent UUID 与 visible row id 不相等。
  - Mitigation：local/live merge 保留 canonical identity map，并只在 parent row 当前可见时重写 `parentSessionId`；不可见 parent 继续保留 canonical UUID。
- [Risk] 增加 shared Rust struct 字段影响构造点。
  - Mitigation：字段 optional + serde default；compiler 驱动更新所有 explicit literals。
- [Risk] 误把普通 source object 当 subagent。
  - Mitigation：必须存在明确 `subagent.thread_spawn.parent_thread_id`。

## Verification Strategy

- Rust parser RED/GREEN fixture：child metadata + inherited parent metadata + duplicated parent prompt。
- Rust mapping assertion：catalog/local thread JSON 保留 `parentSessionId`。
- Rust source scan assertion：duplicate physical rollouts 在 consumer/limit 前收敛，usage 不重复累计，relationship/title/aliases 不丢失。
- Rust local/live merge assertion：parent/child visible rows 使用 rollout aliases 时，child link 被解析到 visible parent id。
- Vitest：runtime fallback mapping 得到 `parentThreadId`；Codex parent + child 的 `useThreadRows()` root count 为 1。
- Focused Rust/Vitest 后运行 `npm run typecheck`、`npm run lint`、`npm run check:runtime-contracts` 与 relevant cargo tests。
