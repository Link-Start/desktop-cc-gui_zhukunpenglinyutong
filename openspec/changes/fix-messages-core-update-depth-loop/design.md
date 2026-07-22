## Context

0.7.7 production bundle 在 Codex 多会话高频 streaming、visible-output recovery 与 terminal settlement 交叠时仍会触发 React #185。source map 中 `MessagesCore` 是失败时正在渲染的 active canvas，不是 feedback owner。补齐 startup fixture 后，测试稳定复现 Node heap OOM；二分定位到 `useQuickSwitcherRecentFiles`：effect 依赖 `workspaces` reference，并对语义不变的 projection 无条件 `setGroups(newArray)`，父层每次创建等价数组时形成自激循环。

约束：不改变 conversation 数据契约、持久化格式、streaming throttle 或用户可见交互；不引入 dependency；不使用全局 reload/降级掩盖根因。

## Goals / Non-Goals

**Goals**

- 复现 production 同类 AppShell parent feedback path 的 React #185/OOM。
- 找到 Quick Switcher 重复 state publication 根因，并令无语义变化的更新保持 referentially stable。
- 保留 auto-follow、history recovery、stream mitigation、finalizing window 与多 canvas 行为。
- 补齐 startup regression 的 `workspaceActivity.timeline` contract。

**Non-Goals**

- 不重构完整 `MessagesCore`。
- 不调整 renderer performance 阈值或 mitigation 策略。
- 不修改 backend、Tauri command、storage schema 或 public API。

## Decisions

### 1. 用 AppShell startup regression 捕获同构反馈环

startup test 的 section mock 每次 render 返回等价但全新的 `workspaces` 数组，准确触发 production 中 selector/projection identity churn 对 Quick Switcher effect 的压力。修复前该测试约 16 秒耗尽 4GB heap；修复后应有限完成。再用 hook focused test 锁定 referential equality 与真实 storage event counter-case。

备选方案：只依据 minified stack 修改最可疑 effect。拒绝，因为同一 render chain 中多个 hook 都可能触发 parent component stack，容易修错层。

### 2. 在最靠近反馈源的共享 updater 做 equality guard

`refresh` 先计算最新 recent-file groups；语义状态不变时返回 `current`，真实 workspace/file projection 变化时返回 `next`。避免依赖调用方永久稳定数组引用，也不在 `MessagesCore` 外围增加计数器、catch 或 reload。

备选方案：增加全局 render-loop budget 并停止后续更新。拒绝，因为会静默丢失合法 UI 更新。

### 3. Startup fixture 只补齐真实 contract 的最小默认值

`workspaceActivity.timeline` 是 Quick Switcher 当前读取的 contract。测试 mock 应返回空数组，而不是修改 production selector 容忍错误 shape；后者会掩盖调用方 contract 漂移。

## Risks / Trade-offs

- [组合测试与真实 Tauri 时序仍有差异] → 同时运行 focused test、startup test、typecheck、lint、production build，并检查 build artifact。
- [equality guard 过宽导致漏更新] → 仅比较组件实际消费的 observable fields，增加“字段变化必须发布”对照测试。
- [结构比较成本] → recent-file groups 已受 `QUICK_SWITCHER_RECENT_LIMIT` 约束，比较仅发生在 effect refresh/storage event，成本有界。

## Migration Plan

无数据迁移。修改可通过回退本 change 的 frontend/test commit 完整撤销；storage 与 backend contract 不受影响。

## Open Questions

- 无。根因位置由 regression attribution 决定，不预设具体 hook。
