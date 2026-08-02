# Tasks: fix-shared-session-target-race-and-merge

## 1. T4 — 乐观更新 + 写序基础设施

- [x] 1.1 `targetStore.ts`：`persistGenerationByThread` + `getPersistGeneration` / hydrate 时自动递增 / `clearPersistGeneration` / test reset
- [x] 1.2 确保 `getSharedTargetState` 同步读取器可用（非 hook）
- [x] 1.3 单测：代次递增、并发 hydrate 代次不乱、beginTurn 不递增
- [x] 1.4 in-flight 计数 `begin/endSharedTargetPersist` + loader 跳过

## 2. T4 — Composer 乐观更新

- [x] 2.1 `handleSharedTargetChange`：`capturePrevious → hydrate(optimistic) → persist → 成功 hydrate(authoritative) / 失败 rollback + toast`
- [x] 2.2 复用现有 i18n toast key
- [x] 2.3 in-flight begin/end 配对

## 3. T4 — sharedHistoryLoader 写序保护

- [x] 3.1 hydrate 前读 generation；await 后再读；代次更大 → 跳过
- [x] 3.2 persisted 不完整：store 有完整 target → 不覆盖；store 亦空 → hydrate null
- [x] 3.3 in-flight persist → 跳过覆盖
- [x] 3.4 targetStore 单测覆盖 generation / in-flight

## 4. T5 — merge threadKind 保护

- [x] 4.1 `useThreadsReducer`：`shared:` id → kind 恒 `"shared"`
- [x] 4.2 后置矫正 map
- [x] 4.3 id-first getThreadKind 回归（既有 + 扩展）

## 5. T5 — shared list 保留（existingThreads 真相源）

- [x] 5.1 从 **`existingThreads`** 提取 `shared:` 条目
- [x] 5.2 **仅空 list** 时补回 previous shared（非空 list 为权威，防删除回魂）
- [x] 5.3 catch→[] 与空列表走同一补回路径
- [x] 5.4 review 收紧：撤销「部分 list 补回」以免已删 shared 复活

## 6. 回归验证

- [x] 6.1 typecheck / 聚焦 vitest（targetStore、thread-kind-identity）
- [x] 6.2 `openspec validate fix-shared-session-target-race-and-merge --strict --no-interactive`
- [ ] 6.3 手工：Shared 切渠道乐观 UI；list 刷新不丢 shared 条目
