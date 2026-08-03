## Context

Shared model picker 的 catalog lazy-load 由
`useSharedProviderTargetCatalog` 管理。managed Provider 使用完整
`engine + providerProfileId` 读取配置；local/disk Provider 虽然也有 sentinel identity，
但目前会先命中 module-level cache，随后 backend persistence validation 又重新读取 disk。
于是 selector 与 persistence 可能在一次点击中观察到两个不同 catalog snapshot。

Claude local settings 的 catalog entry 还具有刻意分离的两种 identity：
`settings-main` 是稳定 catalog id，`kimi-for-coding` 是 runtime model。任何把前者或
display label 当成 runtime model 的修补都会把 UI bug 变成错误执行。

## Goals / Non-Goals

**Goals:**

- local/disk Provider 展开时读取当前 authoritative catalog。
- 请求仍按完整 binding key 合并，避免快速 hover/focus 造成并发 refresh。
- model click 原子提交 catalog id 与 runtime model 两个独立字段。
- backend 继续严格验证 target membership。
- Native / Shared Provider selected state 复用同一 normalized binding identity。

**Non-Goals:**

- 不更改 managed Provider cache policy。
- 不新增 backend command 或修改 IPC schema。
- 不进行 optimistic target update。
- 不从 display label 猜测 runtime model；只保留 backend 已定义的 catalog `id`
  compatibility fallback。

## Decisions

### 1. local/disk catalog 在交互边界 bypass completed cache

`ensureModels` 通过 local sentinel 判定 local/disk scope。该 scope 不读取已完成的
module-level `modelCatalogCache`，而是调用现有 `getEngineModels` 并传
`forceRefresh: true`。managed scope 保持原 cache 行为。

选择该方案是因为 persistence validation 的 authoritative source 本来就是 disk。
另一方案是为 module cache 增加 TTL/version，但 app 内外都可能修改 settings，TTL
只能缩小而不能消除 stale window，并增加新状态。

### 2. 保留 in-flight request coalescing

local forced refresh 仍复用 `modelCatalogRequests`。因此同一个
`engine + local sentinel` 在请求完成前只创建一次 IPC；同一 picker catalog owner
成功刷新后，pointer / focus / accordion 的重复 activation 复用该结果，不再重新进入
loading。新的 owner 生命周期仍会绕过 module-level completed cache。

选择 coalescing 而非 debounce，是因为 keyboard focus、pointer hover 与 click 可能在同一
帧进入，coalescing 不会延迟首个有效请求。

### 3. runtime identity 必须来自 catalog contract

`ModelSelect` 优先使用非空 `model.model`；若 legacy row 的 runtime model 为空，则与
backend `validate_model_catalog_pair` 一致，使用非空 catalog `id` 作为 compatibility
runtime model。点击后：

- `modelCatalogEntryId` = catalog row id；
- `model` = catalog row runtime model；
- label 只用于可读 snapshot。

不采用 `displayName` fallback，也不放宽 backend validation。catalog id 为空的 malformed
row 仍 fail closed；已知 `id != model` 的 row 必须继续使用明确 runtime model。

### 4. Provider source 不参与选中身份

Provider 选中态复用现有 `isSameProviderExecutionProfile`，以
`engine + normalized providerProfileId` 判断。`providerProfileSource` 继续随完整
`ExecutionTarget` 提交，但 Native synthesized target 暂未携带该 metadata 时不会丢失
Provider / Model 勾选。

## Risks / Trade-offs

- [local Provider 首次展开会产生一次配置读取] → 同一 owner 成功后复用结果；
  managed profiles 与 root render 不受影响。
- [disk 在 catalog load 与 click 之间再次变化] → backend authoritative validation 继续
  fail closed，并返回可诊断错误。
- [module cache 中保留旧 local entry] → local lookup 永不消费 completed cache；旧 entry
  不影响 correctness，成功请求仍会覆盖它。

## Migration Plan

1. 新增 local scope refresh policy 与 focused tests。
2. 运行 frontend focused tests、typecheck、lint、runtime contract 与 strict OpenSpec。
3. 无数据迁移；回滚仅需撤销 frontend hook policy，backend/storage 不受影响。

## Open Questions

无。当前 backend command 已支持 `forceRefresh`，无需扩展 API。
