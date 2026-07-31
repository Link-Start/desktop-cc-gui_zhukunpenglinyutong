## Context

Foundation Design 已把 `ExecutionTarget = engine + providerProfileId + model + reasoning` 定为核心对象，代码也已有 Provider profile registry、Provider-scoped model catalog、Shared target state、Context Compiler 和 Native Continuation command。当前偏差发生在 presentation/orchestration：

- Composer 把 catalog 压成 `Record<EngineType, ModelOption[]>`，模型点击后再按 model id 反推 engine，丢失 Provider Profile 维度；同名 model 存在歧义。
- `targetPicker.ts` 已定义四级纯逻辑，但真实 `ModelSelect` 仍是 `CLI → Model`，形成“测试了未接线 helper”的纸面闭环。
- Native continuation context menu 只列出已支持 target 的 profile，Kimi 完全消失；降级确认通过 Tauri native dialog，视觉和无障碍均不受产品控制。
- Context marker 是 runtime control protocol，却被 native history 当作首条普通 user message，继而污染标题、sidebar 和 canvas。
- `sourceSessionId` 已写入 catalog，但来源入口只藏在右键菜单里。

约束：

- macOS、Windows、Linux 均需运行；frontend flow 不依赖 shell、路径分隔符或平台原生 dialog。
- 不改变 vendor history 与 ACK marker 的底层真实性。
- 不把 Kimi source capability 错当成 Kimi target capability。
- 高频状态不得进入 AppShell 根链；Provider model catalog 按需加载并复用现有缓存。

## Goals / Non-Goals

**Goals:**

- 一个可见入口完整表达 CLI、Provider Profile、Model、Reasoning。
- 一个受控 Dialog 完成 Continuation 预览、降级确认、执行、错误与恢复反馈。
- control protocol 在 projection 层被转换为人可读的 continuation identity。
- source relationship 在 canvas 与 sidebar 均可发现、可导航。
- 对选择原子性、能力边界、marker projection 与跨平台纯逻辑补回归测试。

**Non-Goals:**

- 不建立新的全局 Target Registry。
- 不预加载全部 Provider 的远程 model catalog。
- 不开放未经 probe 的 Kimi continuation target。
- 不把 Continuation 变成原 Session 的 provider mutation。

## Decisions

### D1. 选择事件携带完整 Target，不再从 model id 反推

Selector item 的 identity 使用 `engine + providerProfileId + model`，选择完成后一次性提交完整 `ExecutionTarget`。Provider Profile 是 model catalog 的作用域；不同 Profile 下同名 model 保持独立。

备选是保留 `handleSelectModel(modelId)` 并扫描 catalog。该方案无法消除同名 model 歧义，也无法可靠写入 `providerProfileId`，不采用。

### D2. Provider catalog 按需加载，现有缓存作为唯一事实源

打开 Provider Profile 子菜单或进入对应层级时触发该 Profile 的 model refresh；last-good catalog 与 stale/error metadata 继续由 engine controller/model service 管理。UI 不在 AppShell 根节点维护逐 Profile 轮询，也不一次性探测所有 Provider。

备选是 composer mount 时并行拉取全部 catalog。Provider 数量会线性增加 IPC/runtime 调用，且触犯根链性能基线，不采用。

### D3. Shared 与 Native 共用 Target 展示模型，但提交语义分开

- Shared Session：选择只更新 `selectedNextTarget`，send 时固化 snapshot。
- Native Session：当前 binding 内允许选 model；跨 engine/provider 进入 Provider Continuation Dialog，创建新 Session。

这样避免把“选择另一个 Provider”误实现成原地改写 Native binding。

### D4. 不可用能力可见但不可选

A–D 范围内的 Kimi 不再静默过滤。UI 根据 capability contract 显示禁用原因。Kimi 当前文案明确为“可作为来源；目标续接尚未验证”，直到新 probe/spec 改变事实。Gemini/OpenCode 是否进入 Shared V2 属于各自后续 capability change，不在本轮扩张。

### D5. 使用 React/Radix Dialog 代替平台原生确认框

Continuation request 先生成可渲染 preview state；首次 Dialog 展示 source、target。首次确认允许 backend 冻结/编译材料，但 target creation 仍受 backend confirmation gate 保护；若返回 `confirmation-required`，同一 Dialog 再展示 mode、omissions、token estimate 与 recovery status，用户二次确认后才允许 target side effect。错误在 Dialog 内和 toast 中展示，异步状态用 `aria-live`。

不调用 `window.alert`、`window.confirm`、Tauri `ask` 或 `confirm`，确保三平台视觉、键盘与测试一致。

### D6. Marker 保留在存储，projection 转换为 control card

底层继续发送并持久化 marker，用于 checksum/ACK/recovery。Frontend normalization 识别：

- `MOSSX_NATIVE_CONTEXT_V1...`
- `MOSSX_CONTEXT_PACKAGE:...`
- `MOSSX_CONTEXT_ACCEPTED:...`

这些 entry 不作为普通 user/assistant bubble。Continuation metadata 投影成一张 card，显示来源 title、source/target snapshot，并提供“查看来源会话”；mode/fidelity/recovery 只在有真实 operation result 的 Dialog 中展示，不从缺失字段猜测。无法解析的未知 `MOSSX_` 文本不得被宽泛隐藏，以避免吞掉真实用户内容。

### D7. 目标标题由 continuation metadata 生成

创建结果登记后，catalog projection 必须使用可读标题，格式优先使用来源标题，例如“继续：{source title}”；缺少来源标题时使用“Provider 续接 · {target}”。当前实现为 presentation fallback，不改写 vendor history。禁止把 Context Package prompt/hash 当标题。

## Risks / Trade-offs

- [Provider model discovery 较慢] → 子菜单显示 loading/stale/error，复用 last-good；不阻塞其他 Provider。
- [旧 Continuation 没有完整 snapshot] → 使用 engine/profile id 的安全 fallback；不猜 Provider。
- [Marker 过滤误伤用户文本] → 只匹配完整 protocol grammar 与已知位置，不使用 `includes("MOSSX_")`。
- [来源已删除] → 卡片仍保留 snapshot，导航按钮禁用并解释“来源会话已不可用”。
- [Dialog state 增加 Sidebar 复杂度] → continuation orchestration 收敛为 feature hook/component，不向根 store 增加轮询或 append state。

## Migration Plan

1. 先引入纯 target identity/catalog projection helper 与测试。
2. 接入 Shared picker，再接入 Native continuation Dialog。
3. 增加 marker classifier/card/title projection，兼容既有 Continuation。
4. 更新 capability specs、人工 smoke 与自动化证据。
5. 回滚时可独立撤回 presentation；底层 marker、artifact、operation 与 Native Session 数据不受影响。

## Open Questions

无阻塞问题。Kimi continuation target 的开放必须由后续 capability probe 驱动，不在本 change 内推断。
