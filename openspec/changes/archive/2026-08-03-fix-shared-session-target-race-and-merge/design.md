# Design: fix-shared-session-target-race-and-merge

## Context

`fix-shared-session-identity-id-first` 已建立 id-first 身份判定。残余路径仍可导致 **UI 外观退化** 与 **`threadKind` / 条目丢失**：

- **T4**：无乐观更新；history 用 stale/null 覆盖；persist × reload 竞态。
- **T5**：merge truthy 覆盖 kind；shared list 空时整段不 merge。

用户体感：「Shared 选了 DeepSeek，一会儿底栏又像本地配置了」。send 路径不受影响（id-first 硬闸）。

## Goals / Non-Goals

**Goals:** T4a 乐观；T4b/c 写序+代次+不降级；T5a kind 硬闸；T5b existingThreads 补回。

**Non-Goals:** 不改 Rust；不动 native merge；不实证 kind 丢失具体路径；不修 Native `k3` model 串台。

## Decisions

### D1. 乐观更新：hydrate → persist → rollback

```
capture previous → hydrate(new) → persist
  success: hydrate(backend authoritative target)
  failure: hydrate(previous) + toast
```

### D2. persistGeneration 计数器

每次 `hydrateSharedTargetState` 递增。loader 在 await 前后比对：若代次前进 → 跳过覆盖。

### D3. 不降级覆盖（补强）

即使 generation 未前进，若：

- store 已有完整 `ResolvedExecutionTarget`，且
- persisted 为 null / 不完整，或与 store 不同且无法证明 persisted 更新

则 **不得** 用 null/不完整覆盖 store。首次加载（store 亦空）仍允许 hydrate null。

可选增强：若需更强 stale 防御，可与 Composer 的 in-flight `sharedTargetPersistenceByThreadRef` 联动（本 change 以 generation + 不降级为主）。

### D4. merge threadKind 保护

```ts
const threadKind = existing.id.startsWith("shared:")
  ? "shared"
  : thread.threadKind || existing.threadKind;
// 后置：所有 shared: id → threadKind "shared"
```

### D5. shared list 保留：真相源 = existingThreads（补强）

**错误草案**（已否决）：

```ts
// 从本轮 allSummaries 提取 —— 此时尚未 merge shared，几乎恒为空
const existingSharedSummaries = allSummaries.filter(s => s.id.startsWith("shared:"));
```

**正确**：

```ts
const existingSharedSummaries = existingThreads.filter(s =>
  s.id.startsWith("shared:"),
);

// merge sharedSessions（可为空）
// 之后无论 length 如何：
existingSharedSummaries.forEach(s => {
  if (!merged.has(s.id)) merged.set(s.id, s);
});
```

`listSharedSessions` 的 `.catch(() => [])` 已将 error 归一为空数组，因此「空」路径覆盖失败场景；补回逻辑不区分空与 error。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 乐观 rollback 闪动 | 仅失败时；toast 解释 |
| 空 list 补回「过时」shared | 补回 existing（含最新 updatedAt），优于丢条目 |
| 后端已删除的 shared 短暂残留 | 下次非空 list 会自然收敛；可接受 |

## Verification Plan

- `npm run typecheck`
- `openspec validate --strict --no-interactive`（本 change）
- Vitest：targetStore generation；Composer 乐观/rollback；sharedHistoryLoader；useThreadsReducer merge；useThreadActions empty/partial list
