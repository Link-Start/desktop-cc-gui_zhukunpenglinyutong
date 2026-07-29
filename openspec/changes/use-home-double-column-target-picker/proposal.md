## Why

当前 New Home 复用 Conversation Composer，却仍使用 Native Session 单栏 Provider/Model picker。首页承担“创建新会话”的职责，用户需要先明确 CLI，再在该 CLI 下选择 Provider 与 Model；单栏视图既缺少 CLI 维度，也无法把完整目标原子传给创建链路。

## 目标与边界

- New Home Composer 使用现有双栏 CLI + Provider/Model picker。
- 首页选择形成完整 `ExecutionTarget`，并用于随后创建的新会话及首条消息。
- Picker presentation 与 Shared Session persistence 解耦；首页不得伪装成 Shared Session。
- Native Session 单栏 selector 与 Shared Session 双栏 selector 的既有行为保持不变。

## 非目标

- 不新增 Provider catalog、模型管理入口或新 CLI runtime 能力。
- 不改变 Native Provider Continuation 行为。
- 不放开当前 catalog 中尚未验证为可创建目标的 CLI/Provider。
- 不调整 picker 的视觉样式、文案或后端 Provider 配置格式。

## What Changes

- 为 Composer 增加独立的 create-session target picker mode；Native 单栏与 Atomic 双栏使用独立 catalog owner / UI state，只共享 binding-scoped cache primitives 与纯 mapping。
- New Home 持有独立的 draft `ExecutionTarget`；浏览 CLI/Provider 不改变当前会话或 Shared target，选择 Model 后原子更新 draft。
- 首页发送时使用 draft target 的 Engine、Provider、Model 与 Reasoning 创建并初始化新会话。
- 双栏 Provider header 固定两个 action slot；不支持 CLI discovery 的 Engine 保留置灰占位，禁止伪装可用能力。
- Claude Code local/disk Profile 下的 Model selection 必须稳定提交完整 Home creation target，不能被菜单关闭或 catalog 刷新吞掉。
- 双栏 CLI/Profile/Model 只能通过 primary click 切换、折叠或选中；hover/focus 不得自动改变右栏。
- managed Provider 必须保留 backend 返回的 public fallback models，同时隔离其他 Provider 与 Local settings override。
- 增加 Home、Native 与 Shared 三种模式的 focused regression tests。

### 方案对比与取舍

- **方案 A：把首页标记为 `isSharedSession`**。改动最少，但会错误启用 Shared target store、持久化与 submit gate；首页尚无 `threadId`，可能导致发送被锁定。拒绝。
- **方案 B：复制一整套首页双栏组件与 catalog implementation**。可以隔离状态，但会复制 request/cache/mapping，后续必然 drift。拒绝。
- **方案 C：新增明确的 picker mode；Native/Atomic 拆分 state owner 与 input contract，只复用 scoped cache primitives 和 pure mapping**。既隔离 `currentModels`/expanded state，又不复制 backend bridge。采用。

## Capabilities

### New Capabilities

<!-- 无新增 capability；本次扩展既有 Composer control surface。 -->

### Modified Capabilities

- `composer-control-surface`: New Home 创建会话时使用双栏 CLI + Provider/Model picker，并把完整目标原子传给新会话创建链路。

## Impact

- Frontend：`useLayoutNodes`、`Composer`、`ChatInputBoxAdapter`、`ChatInputBox` 与首页新会话 send/start orchestration。
- Runtime contract：复用既有 `ExecutionTarget` 和 `startThreadForWorkspace` Provider binding，不新增 IPC。
- State：新增 Home creation draft target；不写 Shared target store，不修改已有 Native thread。
- Dependencies：无新增依赖。

## 验收标准

- New Home 打开模型选择器时，左栏展示可用 CLI，右栏展示当前 CLI 的 Provider/Model。
- Claude 与 Codex Provider header 的 action 区域布局一致；Claude discovery icon 置灰且不可触发 discovery。
- 选择另一个 CLI 的 Model 后，首页底部展示对应选择，并可直接发送，无需二次选择。
- 从 Codex 切换到 Claude Code `Local settings.json` 后，点击任一有效 Model 必须关闭 picker 并更新首页 footer。
- 鼠标经过其他 CLI 不切换右栏；左键点击才切换 CLI、折叠 Profile 或选择 Model。
- managed Provider 展示自身 scoped models 与 public fallback，不展示其他 Provider/Local settings override。
- 新会话的 Engine、Provider binding、Model 与 Reasoning 与首页选择一致。
- 首页选择不会创建/修改 Shared Session target，也不会触发 Native Provider Continuation。
- Native Session 仍为单栏；Shared Session 仍为双栏且持久化行为不变。
