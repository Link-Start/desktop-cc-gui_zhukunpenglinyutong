## Context

Codex rate-limit 数据在 frontend 已被归一化为 `RateLimitSnapshot.primary/secondary.windowDurationMins`，但 Composer Usage popover 的两个 render paths、旧版 Composer surface 和本地 `/status` fallback 仍分别写死 `5h limit` / `Weekly limit`。当 runtime 调整 primary window（例如变为一周）时，百分比正确而标题错误。

约束：

- 保持现有 `RateLimitSnapshot`、刷新与 reset contract 不变。
- 同一映射会被多个 frontend feature 消费，必须避免复制。
- 旧 payload 可能没有 `windowDurationMins`，需要 deterministic fallback。

## Goals / Non-Goals

**Goals:**

- 由每个 limit window 自身的 `windowDurationMins` 派生标题。
- 所有现有 Usage 与本地 `/status` 展示入口使用同一个 pure formatter。
- 对 invalid / missing duration fail safely。

**Non-Goals:**

- 不扩展 Codex app-server protocol、`limitName` 或 multi-limit collection。
- 不改变百分比、reset time、refresh behavior、layout 或 i18n 范围。

## Decisions

### Decision: 使用 feature-shared pure formatter

在 Composer 与 thread messaging 都可访问的 frontend shared utility 中提供 `formatRateLimitWindowLabel(windowDurationMins)`。输入保持 `number | null | undefined`，输出始终为可展示 `string`。

映射顺序：

1. 非 finite、非正值返回 `Rate limit`。
2. `10080` 分钟精确映射为 `Weekly limit`。
3. 完整天映射为 `Nd limit`。
4. 完整小时映射为 `Nh limit`。
5. 其余整数分钟映射为 `Nm limit`。

Alternative: 在各组件内分别判断 primary/secondary。拒绝原因是当前已有至少三个消费面，会继续产生 behavior drift。

### Decision: 以窗口数据而非位置命名

primary 与 secondary 都调用同一 formatter，不假设 primary 恒为 5 小时或 secondary 恒为一周。

Alternative: 只把 primary hardcode 改成 `Weekly limit`。拒绝原因是仍然写死，下一次 runtime policy 变化会再次失真。

### Decision: 保持现有数据 contract

`ChatInputBox` 的本地 `RateLimitWindowInfo` 补齐已存在于 domain type 的 optional `windowDurationMins`，不新增 backend/IPC 字段。旧 payload 缺少该字段时显示 generic fallback。

## Risks / Trade-offs

- [Risk] runtime window duration 不是整数分钟 → formatter 对 finite positive value 取整后展示，保证文案稳定。
- [Risk] `Weekly limit` 是语义 special case → 只对精确 7 天窗口使用该专业文案，其余天数使用 `Nd limit`。
- [Trade-off] 暂不消费 protocol 中潜在的 `limitName` → 保持本次 UI-only 边界；未来若 frontend contract 正式引入 name，可让 server-provided name 优先并保留 duration fallback。

## Migration Plan

1. 新增 formatter 与 focused unit tests。
2. 透传 `windowDurationMins` 到现有 UI snapshot。
3. 替换 Usage popover、legacy Composer 与本地 `/status` hardcode。
4. 运行 focused Vitest、lint、typecheck 与 OpenSpec strict validation。

Rollback 只需回退 frontend formatter 与调用点；无数据迁移、无 backend compatibility 风险。

## Open Questions

无。本次明确只解决 duration-derived label。
