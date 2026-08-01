## Context

当前 `ModelSelect` 有三条 presentation path：

1. Shared Session 使用 `targetGroups`，数据来自
   `useSharedProviderTargetCatalog`，包含 CLI、Provider Profile 与 Provider-scoped models。
2. Native Session 使用 `modelGroups`，按 CLI 分组，只表达 Engine，不表达 Provider Profile。
3. 无分组时只显示当前 `models`。

Native path 的 `handleProviderModelSelect` 会先调用 `onProviderSelect`，再调用
`onModelSelect`。这会把“选择其他 Provider/CLI”错误表达为当前 Native Session 的 active
engine/model 变化，而没有遵守 Provider Binding 与 Continuation contract。

现有 backend 已支持 `ProviderContinuationTargetInput.model`，Sidebar 已实现完整的受控
Dialog、degraded confirmation、idempotent operation 与 recovery。缺口只在 catalog
projection、picker interaction 和 Composer 到现有 controller 的入口。

## Goals / Non-Goals

**Goals:**

- Native picker 只展示当前 CLI 的 Provider Profiles 与各自 model catalog。
- Shared 和 Native 共用同一份 Provider/Profile/Model projection 与缓存。
- Provider Profile 的 Model 区域互斥展开，支持 pointer 与 keyboard。
- 当前 Provider Profile 内 Model 选择沿用当前 Native Session。
- 其他 Provider Profile 的 Model 选择请求现有 Provider Continuation Dialog，目标 snapshot
  包含 model。
- 保持 catalog 按需加载，避免 AppShell 根链新增轮询或批量 refresh。

**Non-Goals:**

- 不把 Native Session 转换为 Shared Session。
- 不允许 Native Session 原地换 Provider/CLI。
- 不修改 backend continuation protocol。
- 不开放 Kimi destination capability；Kimi 未验证目标保持可见、禁用并说明原因。
- 不重做通用 DropdownMenu primitives。

## Decisions

### D1. 共用 catalog facts，按 session kind 投影

将现有 catalog hook 泛化为支持：

- `shared`：返回 Claude/Codex/Kimi CLI groups，保持 capability state。
- `native`：只返回当前 CLI group；Provider Profile 与 Model facts 完全复用。

Native path 不再使用 `resolveProviderModelGroups` 生成跨 CLI model groups。当前绑定的
`currentModels` 仍作为该 exact Provider Profile 尚未完成异步加载时的 last-good fallback。

备选是新建 Native catalog hook。它会复制 module cache、request coalescing、loading/error
状态，不采用。

### D2. Provider Profile 使用单一受控 expanded identity

`ModelSelect` 维护 `expandedProviderProfileKey`，identity 为
`engine + providerProfileId`。展开新 Profile 时覆盖旧 key；再次激活当前 Profile 时折叠。
Model rows 只在其 Profile 展开时渲染。

Shared path 继续保留 CLI 一级 submenu；CLI submenu 内复用同一个 Profile accordion。
Native path跳过 CLI 一级，直接展示当前 CLI 的 Profile accordion，避免再次显示
Claude/Codex/Kimi 列表。

使用 button/menuitem 可访问语义与 `aria-expanded`，不依赖 hover 才能操作。

备选是为每个 Profile 保存 boolean。该结构允许多个列表同时展开，不满足互斥要求。

### D3. 选择动作按 frozen binding identity 分流

Native selection 比较：

```text
selected engine + normalized providerProfileId
        │
        ├─ 与来源 binding 相同 → onModelSelect(model)
        └─ 与来源 binding 不同 → request Provider Continuation(target + model)
```

`null` local/default identity 必须与现有 local synthetic profile id 通过同一 normalize helper
比较，禁止把同一个本地 Provider 误判为跨 Provider。

Kimi destination 未验证时，非当前 Kimi Profile 不允许触发 continuation；当前 Profile 内
Model 仍可选择。

### D4. 使用 typed feature event 接入现有 Sidebar controller

Provider Continuation Dialog state 目前由 Sidebar-local `useSidebarMenus` 管理。为避免把
Dialog state 提升到 AppShell 根链，新增 feature-local typed request channel：

- Composer 发布 `workspaceId + sourceSessionId + destination target`。
- `useSidebarMenus` 订阅请求，使用当前 authoritative `ThreadSummary` 构建 source snapshot，
  然后进入与 context menu 完全相同的 Dialog preparation function。
- context menu 与 Composer 必须调用同一个 preparation function，保持 operation id、
  capability fingerprint、source/destination label 与 recovery 行为一致。

该 channel 只传用户显式交互事件，不保存 durable state；Dialog state、operation guard 和
backend operation 仍由现有 controller 拥有。

备选是把 Dialog state 提升到 `useLayoutNodes`/AppShell。该方案会扩大 prop surface，并让
稀有 UI 状态触发昂贵的根链 render，不采用。

### D5. Model 选择在确认前不改写当前 UI target

跨 Provider Model row 点击只打开 Dialog，不先执行 `onProviderSelect` 或 `onModelSelect`。
取消、失败或 degraded 二次确认前，当前 Native Session 的 provider/model 保持不变。
成功后由现有 continuation flow reload catalog 并导航到新 Session。

## Risks / Trade-offs

- [Risk] Event request 到达时来源 Thread 已切换或消失 → Subscriber 按 event 中的
  workspace/session identity 重新读取 `ThreadSummary`；不存在则 fail closed 并显示
  actionable notice。
- [Risk] local synthetic id 与 persisted `null` 比较错误 → 复用唯一 normalize helper，
  focused tests 覆盖 local/default。
- [Risk] Profile 展开后 model request 晚到覆盖新 Profile UI → catalog 按 identity 缓存；
  expanded key 只控制展示，晚到数据不会改变 selection 或展开状态。
- [Risk] Kimi Provider 列表可见但不可跨 Profile 续接 → 对非当前 Profile 显示既有
  “目标续接尚未验证”原因，不静默隐藏。
- [Trade-off] Typed DOM event 是进程内瞬时 bridge，不承担 durable delivery；它只请求打开
  Dialog，真正 operation 仍由 backend idempotency contract 负责。

## Migration Plan

1. 增加 delta specs 与 focused tests。
2. 泛化 catalog projection，保持 Shared tests 先通过。
3. 抽出 Profile accordion presentation。
4. 接入 Native action routing 与 typed continuation request channel。
5. 运行 focused Vitest、typecheck、OpenSpec strict validation。

无需数据迁移。回滚时恢复 Native `modelGroups` path 并移除 request channel；backend 与
persisted Session/operation 数据无需回滚。

## Open Questions

无。Kimi destination capability 继续遵循现有 source-only contract。
