## Why

`Messages.tsx` 同时承担 public façade、legacy flat props precedence、canonical `ConversationState`
解析和 2700+ 行 render/orchestration。调用方继续依赖 private component/type paths，导致输入 contract
无法稳定，scope mismatch 时 canonical state 也缺少明确的防泄漏边界。

## What Changes

- 新建 grouped `MessagesCoreProps` 与 pure `adaptLegacyMessagesProps`。
- `Messages` 保留 legacy public signature，仅负责 adapter + `MessagesCore` delegation。
- 机械迁移现有主体到 `MessagesCore.tsx`，本 change 不拆 hook 或改变 streaming/render behavior。
- 新建 feature public index，并迁移 layout direct callers 到 stable surface。

## 验收标准

- canonical state 在 matching scope 下优先，explicit empty collections 不回退 legacy。
- workspace/thread mismatch 不泄漏旧 canonical items/queue/plan/meta。
- `MessagesCore` 只消费 grouped canonical contract，legacy mapping 只存在于 adapter。
- public index 不导出 timeline、row、toolBlock、orchestration 或 private helper。
