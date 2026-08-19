## 1. 测试锁合同

- [x] 1.1 为 ingest 预过滤补 Vitest：uuid-only hide set 丢掉 `rollout-*-{uuid}` / `codex:rollout-*-{uuid}`；`S:\` / UNC / `/Users` / `/home` 不误藏。验证：测试先红（orchestrator 仍 exact/colon）或先锁 helper 合同再改调用点。

## 2. 重写 orchestrator 预过滤

- [x] 2.1 `useThreadActions.ts` 导入 `threadIdInHiddenSharedBindingSet`。
- [x] 2.2 重写 live Codex ~1074：`threadIdInHiddenSharedBindingSet(entry.id, hideSet)`。
- [x] 2.3 重写 Claude ~1282、OpenCode ~1400 live 预过滤。
- [x] 2.4 删除 catalog ~1510 first-colon IIFE，改为 identity；保留协作标题闸。
- [x] 2.5 重写 OpenCode / DSH continuity ~1568 / ~1610。
- [x] 2.6 重写 Gemini/Kimi/Grok/Pi/DSH cache 与异步 refresh 预过滤（含 `freshHiddenSharedBindingIds`），candidate 用 `engine:sessionId`。

## 3. 验收

- [x] 3.1 `rg 'hiddenSharedBindingIds\\.has|freshHiddenSharedBindingIds\\.has'` 在 `useThreadActions.ts` 为 0。
- [x] 3.2 确认未改 `useThreadActions.lastGoodSnapshots.ts`、Rust `push_id`、`shouldRememberHideUnreadiness`。
- [x] 3.3 focused Vitest + `openspec validate rewrite-shared-hide-list-prefilter --strict` 通过。不自动 commit。
