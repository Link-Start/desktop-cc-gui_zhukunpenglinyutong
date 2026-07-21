## Decisions

### Split by state owner, not visual region

本阶段按 runtime、presentation、history、scroll、interactions 的 state/effect ownership 拆分，而不是按 JSX 区块切文件。
每个 hook 只暴露 typed model、stable callbacks 与 refs；不把 raw setter 泄漏回 `MessagesCore`。

### Preserve update-frequency boundaries

snapshot、live、runtime、navigation、interactions、presentation 与 slots 保持独立 memo identity。live assistant/reasoning
覆盖只更新 row-local consumer 所需数据，不得让 live delta 重建稳定历史投影或根级 model。

### Scope deferred state explicitly

所有跨 render 保存的 history/presentation snapshot 必须绑定显式 workspace + thread key。scope change 时 owner 在使用旧值前
同步拒绝 stale snapshot，并在 effect cleanup 中清理 pending timer/RAF。

### Extract in dependency order

先锁定 reconnect/live behavior，再抽 runtime；随后拆 presentation/history；再拆 scroll lifecycle；最后收敛 interaction
callback 与 composition。每一步保持已有 public props、DOM 与 timeline model contract。

### Keep submission ownership unchanged

approval 与 user-input submission 继续由现有 submission owner 管理。`useMessagesInteractions` 只组合用户命令与稳定 handler，
不复制提交状态或引入跨层状态源。

## Risks / Mitigations

- reconnect/finalizing 时序漂移：先运行 runtime/live regression suites，不调整既有 timeout 与 mitigation 常量。
- live update 扩大 render fan-out：用 memo identity regression 锁定稳定 model，并保留 `liveAssistantTextChannel` row-local contract。
- history snapshot 跨线程复用：scope key 纳入 workspace + thread，切换 scope 时立即失效。
- scroll cleanup 回归：集中 timer/RAF/listener ownership，补充 unmount 与 scope-reset focused coverage。
- 回调依赖过宽：interaction hook 接收窄 typed dependencies，使用 stable callback/ref pattern。
- 仅搬移行数：五个 hook 按 domain 分离，`MessagesCore.tsx < 2200` 且不新增 large-file finding。
