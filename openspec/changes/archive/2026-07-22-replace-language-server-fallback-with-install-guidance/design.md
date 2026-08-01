## Context

`FileViewNavigationPanel` 已能根据 `fallbackReasonCode === "provider-unavailable"` 推导 platform-specific install hint，但当前 DOM 先渲染 generic fallback notice，再渲染 nested install block。用户需要恢复动作成为该 warning surface 的主内容。提交前 review 同时发现：bare executable 会把 empty parent 放进 child `PATH`；semantic runtime 又持有 global sessions mutex 跨 `spawn/kill await`，可能让 Java cold start 阻塞无关 provider/workspace。

## Goals / Non-Goals

**Goals:**

- 让 missing provider warning 直接显示 language、platform、command、copy 与 retry。
- 保持非安装故障、fallback result、cache invalidation 和 backend retry 行为不变。
- 保证单结果 missing-provider fallback 不会因自动跳转而隐藏 warning。
- 收紧 provider process launch 与 session initialization 的 security/concurrency boundary。

**Non-Goals:**

- 不改 provider discovery priority、IPC payload 或安装策略。
- 不新增自动安装、polling、dependency 或独立状态模型。

## Decisions

1. 在现有 `FileViewNavigationPanel` 内按 `installHint` 分支选择 warning 内容。相比新增 panel/component，这个改动只改变现有 presentation branch，避免平行抽象。
2. 复用既有 `getLanguageServerInstallHint` 与 `onRetryNavigation`。retry 的 cache clear 已在 `useFileNavigation.retryNavigation` 中统一完成，不在 UI 重复实现。
3. 新增 localized `navigationLanguageServerMissing` copy；保留已有 install/copy/retry keys。所有 locale 同步，避免 fallback 到错误语言。
4. focused component test 直接断言 command 可见、generic notice 不存在、retry handler 被调用。既有 hook tests 继续证明 cache bypass，不扩大测试面。
5. definition/implementation 仅在 `provider-unavailable` 单结果时保留 candidate list；semantic 与其他 fallback 单结果继续自动跳转。这样 warning 有稳定 visible lifecycle，且结果仍可用。
6. `build_seed_search_paths` 忽略 bare executable 的 empty parent，避免 current working directory 经 empty `PATH` component 进入 executable lookup。
7. semantic runtime 使用 weakly-held `(provider, workspace)` initializer mutex 防止同 key 双 spawn；global sessions mutex 只负责 map mutation，process spawn/kill 全部在锁外 await。不同 provider/workspace 可并行 cold start，initializer registry 可在后续访问时清理 dead weak entries。

## Risks / Trade-offs

- [Risk] 其他 platform/language copy 出现 locale drift → 所有 locale 使用同一 key shape，并由 typecheck/targeted assertions 兜底。
- [Risk] 删除 generic notice 后用户不知道结果是 fallback → 顶部 status row 仍显示 `快速搜索（降级）` 与 result count。
- [Risk] missing-provider 单结果不再自动跳转 → 仅该恢复场景要求一次显式点击，换取安装指引可见；其他单结果路径保持原行为。
- [Risk] parallel cold starts 短暂超过 pre-spawn session cap → insert 时再次执行 opportunistic eviction，最终 session map 仍受 cap 约束。
- [Trade-off] 不拆新组件，保留少量 conditional JSX → 当前逻辑只服务一个 panel，最小 diff 优先。

## Migration Plan

无数据迁移。回滚 component/hook、locale/style、backend PATH/session lock 修复与 focused tests 即恢复原行为。

## Open Questions

无。
