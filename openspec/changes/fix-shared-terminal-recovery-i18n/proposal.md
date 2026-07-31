## Why

Shared Session 的 Runtime terminal 可能以 `failed` 结束却不携带 `errorCode`。当前 coordinator
把该不完整 evidence 直接交给 canonical assembler，导致合法的 fail-closed validator 拒绝
`conversation.turnCommitted`，继而把已接受 Attempt 锁进 `recovery-required`；同一诊断又被
Native Session reconnect renderer 解释成第二张恢复卡片。与此同时，Shared 底部状态条直接
暴露 `portable-transcript`、`omissions`、`estimated tokens`、`not-retrievable` 等协议词，
中文界面难以理解。

回归验证还发现三条同源的 foundation contract 断裂：

- 同一 Binding 的 canonical facts 被记为 `destination-owned` 后仍被当作 lossy omission，
  导致未切换 CLI/Provider 也强制弹出迁移确认，并发送空的 context marker。
- Claude Runtime 回传 raw UUID 后覆盖了持久化的 `claude:<uuid>` identity，下一轮错误地
  创建/恢复另一个 session；早到 terminal 也无法命中 Shared owner。
- Codex 首发在 `thread/start` 前没有 provisioning owner，`thread/started` 会先进入普通
  Session catalog，直到整个 Shared dispatch 返回后才被前端隐藏。
- Shared V2 Hidden Binding 只写入 `shared_binding_state`，但 Sidebar refresh 的
  `list_shared_sessions` 仍只读取 V0 `bindings_by_engine`；即使实时事件被正确拦截，刷新后
  仍可能把内部 Native Session 重新投影为普通会话。

## 目标与边界

- 在 Shared Runtime terminal trust boundary 把未分类失败归一为稳定、非空的
  `errorCode`，保留 Provider 已提供的真实 code，继续由 canonical validator 严格校验。
- 明确恢复 UI ownership：Shared Session 只使用 Attempt/Binding 驱动的
  `SharedSendStatusBar`；Native Session 继续使用现有 `RuntimeReconnectCard`。
- 保留 degraded-context 的显式确认与“继续发送 / 取消”按钮；只重写信息层级和 i18n
  映射，不弱化发送门禁。
- 对 Shared 状态、projection mode、omission category/reason/disposition、token 统计等
  用户可见文本提供 locale 资源；中文 locale 不再直接显示可翻译的英文协议词。
- 同一 Binding 的 destination-owned facts 只作为审计去重证据，不触发 degraded gate；
  zero-delta package 不注入空 transcript，也不等待不存在的 checksum echo。
- Native session identity 在 Runtime coordinator trust boundary 统一规范化；Codex 新建
  thread 的早到事件必须在 Shared owner 下投影，不能进入普通 Session catalog。
- Shared Session summary 必须从 V2 `shared_binding_state` 投影全部 Native identity，作为
  Sidebar catalog exclusion 的 durable truth；V0 metadata 只保留兼容读取。
- Native Binding 确认失效时，落账当前 failed Attempt 并把 Binding 标记为
  `recovery-required`；前端进入唯一恢复入口，不显示原始 Provider 诊断或自动重试。

## 非目标

- 不放宽 canonical schema 或删除 `failed outcome must include errorCode` 校验。
- 不自动重试、自动切换 Provider、自动重建 Binding，也不改变 strict linear ordering。
- 不删除 Native Session 的 reconnect card，不修改 Native history/recovery 语义。
- 不本地化未知的 backend 原始诊断；未知值继续保留为可追踪 fallback。
- 不删除 Shared Context Compiler 的 destination-owned 审计事实，也不放宽真正 lossy
  omission 的显式确认。

## What Changes

- Shared Runtime coordinator 对 `Failed` terminal 缺失/空白 `errorCode` 使用
  `runtime_failure_unclassified`，并为 Codex 与 EngineEvent 两条入口补 focused tests。
- Messages presentation 根据 Session ownership 禁止 Shared Session 激活 Native reconnect
  card，同时保持对应诊断不成为第二个恢复入口。
- `SharedSendStatusBar` 使用结构化 Manifest omission，而不是拼接 backend 英文字符串；
  主文案解释“对话正文正常发送，私有思考/不兼容内容不会传递”，协议详情通过本地化标签展示。
- 所有现有 `sharedSend` locale 保持 key parity；简体/繁体中文完整翻译 Shared 状态条中的
  `Probe`、`Binding`、`Attempt`、`Target`、mode、disposition 与 token labels。
- Context Compiler 对 zero-delta package 生成空 `promptPrefix`；Shared prepare 只把真正
  不可迁移的 omission 标记为 `degraded`。
- Runtime coordinator 对 Claude native session identity 统一使用 `claude:<uuid>`，并为
  Codex provisioning `thread/started` 建立 provider-scoped hold + exact replay barrier。
- `list_shared_sessions` 合并 V0 metadata 与 V2 binding rows 的 Native identity，保证首次
  dispatch 后立即刷新、重启或重新扫描 catalog 都不会泄漏 Hidden Binding。
- `No conversation found with session ID` 归类为 typed Binding recovery，清理当前 Runtime
  owner 并保留显式 rebuild；已存在 failed terminal 时不再追加冲突的第二份 canonical fact。

## 方案对比与取舍

1. **推荐：trust-boundary normalization + recovery ownership gate + structured i18n**
   - 保留 validator 的 fail-closed 价值；一次归一覆盖所有 Runtime adapter。
   - Shared/Native recovery UI 各自只有一个 owner。
   - UI 消费结构化 Manifest，避免按英文句子做脆弱解析。
2. **仅隐藏卡片并放宽 validator**
   - 改动更少，但会把无 `errorCode` 的 failed fact 写入 canonical log，并掩盖
     uncommitted Attempt；拒绝。
3. **逐 Adapter 补 code、UI 继续拼 raw string**
   - 容易遗漏新的 terminal caller，且 i18n 继续漂移；拒绝。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `assemble-shared-canonical-facts`: failed Runtime terminal 在进入 canonical assembler 前必须
  具有稳定的非空 failure code，且不得覆盖真实 Provider code。
- `shared-send-pipeline`: Shared recovery surface 必须由 Attempt/Binding 状态机唯一拥有；
  degraded-context 保留显式确认，但 destination-owned 去重不属于降级；Runtime native
  identity、首发可见性与 stale Binding 必须由 durable owner 收口。
- `client-localization-language-support`: `sharedSend` namespace 必须覆盖状态、动作与已知
  protocol vocabulary，并保持所有 locale key/placeholder parity。

## 验收标准

- Codex `turn/completed status=failed` 和 EngineEvent `TurnCompleted status=failed` 在缺少 code
  时都生成 `runtime_failure_unclassified`，可通过 canonical validation/commit。
- Runtime 已提供的 failure code 原样保留；cancel intent 仍优先归类为 `cancelled`。
- Shared thread 的 reconnect diagnostic 不展示 Native reconnect card；Native thread 行为不变。
- degraded-context 未确认时仍不发送；确认按钮保留并改为 locale 文案“继续发送”。
- 同一 CLI/Provider/Binding 连续发送不显示 degraded card，zero-delta package 的估算为
  `0 → 0` 且不注入 `MOSSX_CONTEXT_PACKAGE`。
- Claude raw UUID 事件能够命中 `claude:<uuid>` Binding；两个 Provider 即使 raw UUID 相同
  也按 provider runtime scope 隔离并正常 terminal settlement。
- Codex Shared 首发 `thread/started` 不创建可见普通 Session，事件在 exact bind 后只投影
  到 Shared thread；Sidebar refresh/reload 后仍只保留 Shared row。
- stale Claude Binding 返回 typed recovery early return；用户只看到本地化恢复状态条，
  不出现 `target-provider-rejected` / `No conversation found` 原始诊断。
- 中文界面不直接显示已知 `portable-transcript`、`omissions`、`estimated tokens`、
  `not-retrievable`、`Probe`、`Binding`、`Attempt`、`Target`。
- focused Rust/Vitest、targeted ESLint、TypeScript typecheck 与单 change strict validation 通过；
  不要求启动 App 或运行全量测试。

## Impact

- Backend：Shared Context Compiler、`shared_session_v2`、Runtime coordinator、
  Shared event store/catalog projection 及 focused Rust tests。
- Frontend：Messages runtime reconnect presentation boundary、`SharedSendStatusBar`、Shared
  degraded state payload 与对应 Vitest。
- Localization：`src/i18n/locales/*/sharedSend.ts` 与 locale parity test。
- Specs：上述三个 existing capabilities 的 delta specs；无新增 dependency、command 或 IPC
  mutation authority。
