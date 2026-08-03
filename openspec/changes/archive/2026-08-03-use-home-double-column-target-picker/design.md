## Context

`HomeChat` 不直接实现 Composer，而是接收 `useLayoutNodes` 创建的同一个 Composer node。当前 `Composer -> ChatInputBoxAdapter -> ChatInputBox` 用 `isSharedSession` 决定是否打开双栏 target picker，因此 presentation mode 与 Shared Session 的 durable state、submit gate 和 persistence callback 被耦合。

首页发送最终进入 `useAppShellKanbanComposerSection`。该链路在创建 thread 时使用闭包中的 `activeEngine`，Provider 仅能由现有 Composer selection 间接解析，无法可靠表达一次跨 CLI 的完整选择。与此同时，`sendMessageToThread` 已支持通过 `MessageSendOptions.model/effort` 覆盖首 Turn 模型参数，`startThreadForWorkspace` 已支持 Engine 与 Provider Profile。

## Goals / Non-Goals

**Goals:**

- 复用现有双栏 target picker、Provider-scoped catalog、选中态与 loading/error 行为。
- 将 picker presentation mode 与 Session Kind 解耦。
- 首页选择只形成 create-session draft，不写 Shared target store、不触发 continuation。
- 创建 thread 与发送首 Turn 使用同一个 immutable target snapshot。
- 新 thread 激活后，Composer selection 立即显示此前选择的 Model/Reasoning。

**Non-Goals:**

- 不新增后端 command 或 Provider 配置结构。
- 不扩展 Shared Session 支持的 CLI 集合。
- 不重写现有 Native/Shared picker。
- 不把 Home draft 持久化为全局 Provider 切换。

## Decisions

### 1. 使用显式 Picker Mode，而不是复用 `isSharedSession`

在 Composer/Adapter/InputBox 边界新增 create-session mode。`isSharedSession` 继续只表达 Session Kind 和 durable behavior；create-session mode 仅选择双栏 presentation 与 atomic target callback。

替代方案是让首页设置 `isSharedSession=true`，但首页没有 durable Shared `threadId`，会导致 submit gate 与 persistence owner 错配。

### 2. Home draft target 由 Composer 局部持有

首页未选择具体 Model 前保持既有默认 Engine/Model 展示；当双栏选择产生完整 `ExecutionTarget` 后，Composer 将其保存为 creation draft。该 state 只让 Composer 子树重渲染，避免将 picker browsing state挂到 AppShell 根链。

替代方案是在 AppShell 根增加 target state，但这会提高根渲染成本，并把纯 UI 草稿扩散到全局 orchestration。

Home hero 位于 Composer 外部，只需要 Engine icon projection。Composer MAY 向
`useLayoutNodes` 发布低频 `engine | null` display projection，HomeChat 优先用该值渲染
hero icon；完整 target、Provider、Model 与 Reasoning 仍留在 Composer，禁止为标题回显
上提整个 creation draft。

### 3. 通过显式 Session Creation payload 贯通 send boundary

`MessageSendOptions` 新增语义化 `createSessionTarget`，包含 Engine、Provider identity、model catalog/runtime identity 与 effort。只有 Home Composer 附加该字段。

`useAppShellKanbanComposerSection` 检测到该 payload 后：

1. 解析当前或默认 workspace；
2. 切换到目标 Engine；
3. 用目标 Engine/Provider 创建新 thread；
4. 以 `modelCatalogEntryId/effort` 初始化 thread-scoped Composer selection；
5. 用 runtime `model/effort` 发送首 Turn；
6. 消费 creation-only 字段，不把它继续传入普通 turn runtime。

这样创建与首 Turn 使用同一 target，不依赖 React state 切换的异步时序。

### 4. Create mode 复用 Shared capability gate，但不复用 Native catalog owner

Create mode 使用 Atomic 双栏 catalog 和当前 enabled/disabled 规则；本变更不顺手放开尚未验证的 CLI/Provider。Native 单栏与 Atomic 双栏必须使用不同的 hook instance 与不同 input contract：Native owner 可以接收当前 Session 的 `currentModels`，Atomic owner 的类型层禁止接收该字段，只能按 `engine + providerProfileId` 读取 scoped catalog。Shared mode仍执行原持久化 contract。

### 5. Provider header 使用稳定 action slot，不伪造 CLI 能力

双栏右侧 Provider header 始终渲染 `Reload Config` 与 `Discover Models` 两个 action slot。Codex 在 binding 支持可信 app-server `model/list` 时启用 discovery；Claude Code 没有稳定 discovery protocol，因此保留 disabled cloud icon，仅用于维持视觉布局与表达 capability unavailable。

禁止把 Claude 的 `Reload Config` 复用成第二个 discovery action，也禁止通过 HTTP、静态列表或 `--help` 输出伪造模型发现。

### 6. Native 单栏与 Atomic 双栏的数据源彻底分离

Create-session 与 Shared 复用 Atomic 双栏 catalog 数据结构，但不复用 Native 单栏 owner。Atomic Profile 的 Models 只能来自以 `engine + providerProfileId` 为 key 的 scoped query/cache；禁止把 Composer 当前 Session 的 `availableModels` 投影到任何 Atomic Profile。这样 Local models 不可能被放进当前 managed Provider，managed Provider 也不能吸收 Local/global rows。

这里的隔离不包含 backend 明确定义的 public fallback：`source=fallback | builtin` 且无 `providerProfileId` 的公共模型仍可追加到 managed Profile。Atomic owner 只排除其他 managed Profile rows 与 Local settings override，不能删掉 CLI 的兜底模型目录。

Native 单栏和 Atomic 双栏分别持有 Profile 展开状态。Atomic 双栏的 CLI row、Provider header 与 Model row 仅在 primary `click` 后改变 active/expanded/selected state；禁止 hover/focus 自动切换，也禁止在 WebKit `pointerdown` 阶段提前提交。Native 单栏继续使用既有 Radix submenu / `onSelect` contract。

### 7. Local Profile identity 在 catalog normalization 后保持 canonical

Provider catalog bridge 可以同时收到 frontend default Local Profile 与 backend 返回的同一 local sentinel。Normalization 必须按 sentinel 或 backend `isLocalProvider` metadata 将其分类为 `source=disk`，不能因为它来自 backend response 就统一标记为 `managed`。

Picker 内部仍以 `__local_settings_json__` 等 sentinel 定位和加载 catalog；提交 `ExecutionTarget` 时再规范化为 `providerProfileId=null + providerProfileSource=disk`。`null + managed` 是非法组合，必须由测试在进入 Composer owner 前拦截。

## Risks / Trade-offs

- [Risk] `MessageSendOptions` 增加 creation-only 字段后被普通发送路径误传。→ Home 之外不生成该字段；orchestration 在创建完成前解构并移除。
- [Risk] 选择目标后 thread 激活时全局 Engine 尚未同步。→ 在 start 前显式 await Engine setter，并以 thread metadata 作为后续 owner。
- [Risk] 用户选择 managed Provider 后 metadata label 丢失。→ payload 同时携带 Provider id/name/source，并传给现有 `providerProfile` option。
- [Risk] disabled discovery icon 被误认为可点击。→ 使用原生 disabled/`aria-disabled` 状态、降低 opacity，保留现有 tooltip 文案但不绑定 action。
- [Risk] 单栏 `currentModels` 被误当成双栏当前 Profile 的 authoritative models。→ 两套 catalog owner 使用互斥 input type，Atomic owner 无法表达 `currentModels`。
- [Risk] target row / Profile header 在异步 load 前后发生 WebKit selection settlement 竞争。→ Atomic surface 独立持有展开状态，primary click 是唯一鼠标提交入口，不在 `pointerdown` 阶段关闭菜单。
- [Risk] backend 返回的 Claude Local sentinel 被通用 Provider normalization 重分类为 `managed`。→ Local sentinel / `isLocalProvider` 优先决定 `disk` identity，并用 resolved target contract test 覆盖 `null + disk`。
- [Risk] Home footer 已切换 Engine，但 hero icon 仍读取 global `selectedEngine`。→ Composer 只向 Home owner 投影 creation target Engine，focused integration test 覆盖 Claude → Codex 回显。
- [Risk] 修改共享 Composer 影响 Native/Shared。→ 三模式 focused tests，分别断言单栏、双栏创建和 Shared persistence callback。
- [Trade-off] Home draft 不跨 app restart 持久化。该 target 是未提交的 creation draft，避免形成隐式全局 Provider switch。

## Migration Plan

1. 增加类型与 picker mode，保持默认值映射到当前 Native 行为。
2. 仅为 `homeComposerNode` 开启 create-session mode。
3. 贯通 creation target 到现有 start/send orchestration。
4. 运行 focused tests、typecheck 与 OpenSpec strict validation。

Rollback 时移除 Home 的 create-session mode 和 creation payload 分支即可；Native/Shared 原链路不需要数据迁移。

## Open Questions

无。尚未验证为创建目标的 CLI 继续沿用现有 disabled capability gate。
