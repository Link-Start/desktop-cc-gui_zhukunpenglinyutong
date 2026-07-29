## Why

Native Session 的 Composer model picker 仍按 CLI 分组，只显示 `Claude / Codex / Kimi`
入口；这会隐藏当前 CLI 已配置的 Provider Profiles，并让用户误以为可以在原 Native
Session 内直接切换 CLI。现有 Provider-scoped catalog 与 Provider Continuation 已具备完整
底层能力，需要把 Native picker 的展示和动作语义校准到这些事实。

## 目标与边界

- Native Session 只展示当前 CLI 的 Provider Profiles，不展示其他 CLI。
- 每个 Provider Profile 展示其独立 Model catalog；同名 model 不跨 Provider 混用。
- Provider Profile 与其 Model 列表使用单面板互斥折叠，同一时间只展开一个 Provider。
- 当前 Provider 内切换 Model 继续使用原 Session；选择其他 Provider 的 Model 必须进入
  现有 Provider Continuation Dialog，并把目标 Model 写入 destination snapshot。
- Shared Session 的 `CLI → Provider → Model → Reasoning` 语义保持不变。

## What Changes

- 将 Composer model picker 区分为 Shared 与 Native 两种投影：
  - Shared：继续展示多 CLI target groups。
  - Native：只投影当前 CLI 的 Provider Profiles。
- 将 Provider/Profile/Model 菜单改为受控互斥展开，避免多个 Provider 的 Model 列表同时占用空间。
- 复用现有 Native Provider Continuation controller 与 Dialog，接入 Composer 的跨 Provider
  Model 选择入口。
- 为 Native picker 增加 Provider-scoped loading、error、empty 与 selected 状态测试。

## 技术方案对比

1. **推荐：泛化现有 Provider catalog 与 continuation controller。** Native 与 Shared 共用
   catalog facts，按 session kind 生成不同 projection；跨 Provider 动作复用同一 Dialog。
   改动集中，不新增 backend contract，也避免两套 catalog/continuation 状态漂移。
2. **备选：为 Native picker 新建独立 catalog hook 与 Dialog state。** 初始接线较直接，
   但会复制缓存、loading/error、operation idempotency 与 recovery 逻辑，后续容易出现两个入口
   行为不一致，不采用。
3. **备选：把 Native Session 升级为 Shared target state。** 可统一 picker，但会改变 Native
   binding 与生命周期语义，范围和回归风险远超本需求，不采用。

## 非目标

- 不允许 Native Session 原地切换 Provider 或 CLI。
- 不修改 Provider Continuation backend、artifact、recovery 或 fidelity contract。
- 不新增 Provider、Model、Reasoning capability。
- 不改变 Shared Session target selection、send pipeline 或历史 Turn attribution。
- 不预加载所有 CLI 的全部 Provider Model catalog。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-control-surface`: Native model selector 改为当前 CLI 范围内的
  Provider Profile → Model 互斥折叠列表。
- `native-provider-continuation`: Composer 选择其他 Provider 的 Model 时复用产品内续接确认，
  并冻结目标 Model。

## 验收标准

- Claude/Codex/Kimi Native Session 分别只显示自身 CLI 的 Provider Profiles。
- 展开 Provider B 时 Provider A 的 Model 列表自动折叠。
- 当前 Provider 内选择 Model 不创建新 Session。
- 其他 Provider 下选择 Model 先显示 Provider Continuation Dialog；确认前无目标 side effect。
- Dialog destination 与最终 request 同时包含目标 CLI、Provider Profile、Model。
- 取消 Dialog 后来源 Session、当前 Provider 与当前 Model 均不变。
- Shared Session 原有多 CLI picker focused tests 保持通过。

## Impact

- Frontend：Composer model picker、Provider catalog projection、AppShell/Sidebar continuation
  orchestration、相关 i18n 与 focused tests。
- Backend/Tauri command：无 contract 变更，复用现有 `ProviderContinuationTargetInput.model`。
- Dependencies：零新增。
- Performance：Provider catalog 继续按需加载；不得把全量 Provider refresh 或轮询挂入 AppShell 根链。
