## Context

当前实现已有完整的 commit message engine/language menus、Prompt Enhancer module-level LRU、workspace managed command create command 与 Rust watcher registry。本轮问题均来自 owner boundary 缺少显式 contract：主按钮根据 persisted config 改变语义、cache identity 未包含 workspace、文件创建使用 TOCTOU check、watcher start 在 registry check 与 insert 之间释放锁且 frontend cleanup 不等待 start。

约束：

- 不改变现有 Tauri command/event payload。
- `GitDiffPanel` 与 `GitHistoryWorktreePanel` 必须保持同一 interaction contract。
- Prompt Enhancer request 运行在 workspace-scoped hidden read-only session，cache 必须匹配该 scope。
- managed command duplicate rejection 必须在 filesystem operation 本身保证。
- watcher 为低频 lifecycle operation；正确性优先于并行 start throughput。

## Goals / Non-Goals

**Goals:**

- 主按钮行为稳定且配置选择可发现。
- cache 与 async result 按 workspace 隔离。
- managed command create 在并发下仍不覆盖。
- watcher start/stop 在快速 effect cleanup 下确定性收敛。

**Non-Goals:**

- 不统一所有 AI generation menu component。
- 不持久化 Prompt Enhancer cache。
- 不增加 watcher reference count、多 WebView lease protocol 或新 event schema。
- 不改变 command discovery 与 Prompt Distill UI。

## Decisions

### D1：AI commit 主按钮始终打开既有 engine menu

删除两个 component 的 `handleCommitMessageGenerateClick` direct-generate branch，`onClick` 直接调用 `showCommitMessageEngineMenu`。保留 menu 内的“使用上次配置”，继续复用 `saveLastCommitMessageConfig`；`readExecutableCommitMessageConfig` 仅用于校验 quick option，防止 disabled/retired engine 经 persisted config 绕过 execution policy。

备选：增加 split button，把左区用于 quick generate、右区用于 menu。未采纳，因为增加 UI chrome、keyboard/accessibility contract，且用户明确要求恢复三步选择。

### D2：Prompt Enhancer cache key 与 request generation 同时绑定 workspace

`enhancerCacheKey` 增加 normalized `workspaceId`。workspace 变化时递增 `activeRequestIdRef`，使旧 request 即使返回也不能写 UI/cache。fallback cache key 使用相同 workspace scope。

备选：只在 workspace change 时清空整个 module cache。未采纳，因为会丢失其他 workspace 的合法 LRU entry，且不能独立解决旧 async result 写回。

### D3：managed command 使用 filesystem exclusive create

先创建 managed directory，再用 `OpenOptions::new().write(true).create_new(true).open(path)`。`AlreadyExists` 映射为既有 duplicate error；其它 open/write error 显式传播。写入失败时删除本次新建的 partial file，避免留下不可用 command。

备选：process-local `Mutex` 包住 `exists + write`。未采纳，因为不能覆盖多 process/多 WebView 并发，filesystem 才是事实边界。

### D4：watcher lifecycle 使用 frontend ordering + backend lease count

- Frontend effect 保存 `startPromise`；cleanup 必须在 start settle 后调用 stop，保证同一 effect 的 stop 不会越过 start。
- Backend registry 为每个 scope 保存一个 watcher handle 与 lease count。重复 start 增加 lease；stop 只释放一份 lease，归零才 abort/remove。首次 start 从 missing check 到 handle insert 持有同一 mutex guard。

备选：只串行 start/stop，不计 lease。未采纳，因为 React StrictMode 或快速 remount 可形成 `start₁ → start₂ → stop₁`，单纯 remove 会误停仍活跃的第二个 effect。

## Risks / Trade-offs

- [Risk] watcher start 持锁期间需要解析目录并初始化 native watcher → lifecycle command 是低频操作；不影响文件事件 loop，且避免失管 handle。
- [Risk] caller start 成功后未执行 matching stop 会保留 lease → frontend effect 将 stop 串在 start promise 后，测试覆盖 pending start cleanup 与 duplicate lease release。
- [Risk] exclusive create 成功后 write 失败会出现 partial file → error path best-effort remove 本次新建文件。
- [Risk] workspace cache key 增加后相同 prompt 跨 workspace 不再复用 → 这是隔离要求，接受额外一次 engine call。
- [Risk] 删除左键 quick generate 增加点击次数 → “使用上次配置”仍在第一层可见 menu，保留显式 quick path。

## Migration Plan

1. 先更新 tests 锁定新 contract。
2. 修改 frontend interaction/cache/lifecycle。
3. 修改 Rust exclusive create 与 registry critical section。
4. 运行 focused tests、typecheck、lint、Rust tests、OpenSpec validate。

无需数据迁移。persisted last config 继续兼容。回滚时可逐文件撤销本 change；command/event payload 未改变。

## Open Questions

无。本轮按用户确认的四项 review closure 执行。
