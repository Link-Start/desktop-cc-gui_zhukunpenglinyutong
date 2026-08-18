## 1. Common tail contract

- [x] 1.1 抽出 older-page 输入/结果类型与 engine registry（`claude:` → 80 / Claude loader；`dsh:` → 200 / DSH loader；其余 false）
- [x] 1.2 `createOlderHistoryRequester` 去掉 `claude:` 硬门，改为 registry；`deps.loadPage` 只覆盖已注册引擎；All 仍不打磁盘
- [x] 1.3 requester 单测：DSH 走 limit 200；`codex:` 仍 false；Claude 既有 memory / disk / retry 用例保持绿

## 2. DSH one-page adapter

- [x] 2.1 Rust：`resolve_dsh_history_load_window`；`DshSessionLoadResult` 增加 `hasMore` / `nextCursor`；默认 `limit=200` → 最多 1 次 host 页；进度计数改 folded messages，`maxPages` 用本次预算
- [x] 2.2 `load_dsh_session` command（含 remote）转发 `limit` / `before`；`latest_assistant_text` 走同一默认且保持静默
- [x] 2.3 JS `loadDshSession(..., { limit, before })`；DSH `HistoryLoader.load()` 默认 1 页并写 meta
- [x] 2.4 `loadDshOlderHistoryPage`；legacy resume `dsh:` 分支同样传 1 页并 `setThreadHistoryWindow`
- [x] 2.5 rust window / fold-count 单测 + JS loader / page / sidebar-cache 调用参数

## 3. Compatible engines

- [x] 3.1 Claude：不改磁盘 80；确认 chip / loader meta 回归
- [x] 3.2 Grok / Kimi / Pi loader 显式 `historyHasMore: false`（不造假 cursor）
- [x] 3.3 Shared：不改 V0 ready-gate / projection merge

## 4. Curtain counts + verify

- [x] 4.1 进度 mapper / i18n：数值语义改为 folded messages；打开 1 页时 `maxPages` 为 1
- [x] 4.2 红线：虚拟化仍关；80/300/800 不变；无后台 39 页预取；无 timeout 卸幕布
- [x] 4.3 既有 focused suites + 本 change 新测；`cargo test` 覆盖 DSH window helper
- [ ] 4.4 本地 dump `session-817dbcda…` 手测：打开停在第 1 页、幕布可卸、芯片能露出更早 user（手动）
