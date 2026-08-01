## Decisions

### Extract row dispatch first

先机械迁移 projection-row switch、wrapper 与 row prop mapping，再提取 stateful hooks。这样 DOM/key contract 可以由现有
projection、virtualized jump 与 live markdown tests 锁定，避免在同一 diff 同时改变 rendering 与 state ownership。

### Stable measurement registry

row measurement callback 按 row key 缓存稳定 identity；registry 内部读取最新 measurement implementation。live-only props
变化不得为 unchanged row 构造新 callback ref，也不得制造 React detach/attach cycle。

### Separate update frequencies

virtualizer、hydration 与 outline 返回独立 typed models。不得合并成 mega-controller：virtual scroll、heavy-row promotion 与
outline heading 的更新频率不同，consumer 应只订阅其使用的 owner。

### Preserve constants and diagnostics

本 phase 不调整 threshold、overscan、estimate、cooldown 或 hydration budget。现有 renderer diagnostics 与 scope keys
随 owner 迁移，但 metric id 和 payload contract 保持不变。

## Risks / Mitigations

- row switch 漏 prop：先运行现有 projection/jump tests，再机械 move，并用 typecheck 捕获 exhaustive contract drift。
- callback ref identity 漂移：新增 registry-focused test，明确验证 unchanged key 的 callback identity。
- effect cleanup 漏失：hydration/outline hook 增加 scope reset、RAF/listener cleanup focused coverage。
- virtualization 行为漂移：不改 constants/estimates，并运行 timeline virtualization、hydration 与 jump suites。
- 大文件只是搬家：新 owner 按职责分文件，`MessagesTimeline.tsx < 1600`，且不增加 large-file finding。
