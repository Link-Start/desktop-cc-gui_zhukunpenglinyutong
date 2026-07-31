## Context

Shared Session V2 的正确生命周期是：

```text
Runtime terminal
  -> SharedRuntimeCoordinator (authoritative terminal normalization)
  -> RuntimeFinalSnapshot
  -> canonical assembler + strict validator
  -> conversation.turnCommitted
  -> Shared send state returns idle / keeps typed recovery state
```

当前断裂发生在第一条 trust boundary：`completion_outcome()` 能识别 `failed`，但
`TerminalEvidence.error_code` 仍可为空。validator 按 foundation contract 要求拒绝
`Failed` without `errorCode`，`commit_observed_runtime_settlement()` 随后正确地把 Binding
标记为 `canonical-terminal-commit-failed`。错误在于 producer 没有完成 normalization，
不是 validator 过严。

Presentation 侧复用同一 Conversation Canvas，但 Shared 与 Native 必须保持两套 recovery
owner。现在 `useMessagesRuntimeState` 会扫描所有 assistant diagnostics，Shared thread 因而也会
激活 Native `RuntimeReconnectCard`；与此同时 `SharedSendStatusBar` 已经从 durable
Attempt/Binding 状态展示恢复动作，形成双 authority。

degraded-context 的状态机和确认 gate 正确，但 `SharedSendStatusBar` 把 backend protocol
string 直接拼进用户文案。Manifest 已提供结构化 `mode / category / reason / disposition`，
无需解析 display string。

同一 Binding 续聊时，Compiler 会把已经存在于目标 Native history 的 facts 记为
`destination-owned`。这是 de-duplication evidence，不是信息损失。当前 prepare 层却使用
`manifest.omitted.is_empty()` 判定 degraded；空 entries 又被 `transcript([])` 变成只有标题
的 7-token package，Claude 因而等待一个本不应发送的 replay checksum。

Claude identity 还存在双表示：durable Binding 使用 `claude:<uuid>`，EngineEvent forwarder
传 raw UUID。Coordinator 未规范化时，exact hold、terminal owner 和下一轮 resume 会同时
断裂。Codex 新 Binding 则在 `thread/start` 返回 thread id 之前没有 exact identity，需要
provider-scoped provisioning hold 承接唯一的 `thread/started` 早到窗口。

## Goals / Non-Goals

**Goals:**

- 一处归一所有 Runtime failed terminal，确保 canonical failure 可审计、可落账。
- Shared/Native recovery presentation 互斥，Shared 不再提供 Native rebind/fork card。
- 保留 degraded-context gate 和底部按钮，主摘要使用自然语言，详情使用结构化 i18n。
- 所有支持 locale 的 `sharedSend` namespace key 和 placeholders 对齐。
- 同一 Binding 连续发送保持 Native continuation，不触发 context migration UX。
- Claude/Codex 首发、续聊与 terminal 事件始终落到 exact Shared Runtime owner。
- stale Binding 使用 typed recovery，不把 Provider stderr 当产品文案。

**Non-Goals:**

- 不改变 Runtime outcome 分类、ACK、cursor 或 Binding rebuild semantics。
- 不把未知 backend diagnostic 翻译成推测语义。
- 不新增 dependency、IPC command、persistent schema 或 polling。
- 不自动重建 Binding、不静默 fallback 到默认 Provider。
- 不启动 App、不执行全量测试。

## Decisions

### Decision 1: 在 `AttemptAccumulator::Terminal` 统一补 failure code

伪代码：

```text
if cancel_intent && outcome == failed:
  outcome = cancelled

if outcome == failed && trim(error_code) is empty:
  error_code = "runtime_failure_unclassified"

build RuntimeFinalSnapshot
```

选择这里而不是 Codex/Claude/Kimi adapter：

- 这是所有 terminal evidence 进入 canonical domain 的共同 trust boundary。
- cancel intent 必须先重分类；被重分类为 `cancelled` 后不应伪造 failure code。
- Provider 的真实 non-empty code 原样保留。
- validator 继续 fail closed，能阻止任何绕过 coordinator 的坏 producer。

Alternative：assembler 自动填 code。拒绝，因为 assembler 应组装已归一的 authoritative
snapshot；在更下游修补会掩盖 producer contract 违约。

### Decision 2: Messages 使用显式 Native recovery presentation capability

`MessagesCore` 从 canonical thread identity 一次派生
`nativeRuntimeRecoveryEnabled = !threadId.startsWith("shared:")`：

- `useMessagesRuntimeState` 只有在 enabled 时选择 active Native reconnect card。
- `MessageRow` 在 disabled 时仍抑制匹配的 Native diagnostic 文本，但永不展示 Native
  recovery action。
- Native thread 默认值和既有行为不变。

该 capability 随 timeline runtime model 传递，避免低层 `RuntimeReconnectCard` 自己猜
Session kind，也避免只用 CSS 隐藏 action。

Alternative：在 backend 不向 Shared 投影任何 runtime-ended diagnostic。长期更纯，但本次
需要兼容已经落入 history/legacy projection 的诊断；presentation boundary 仍需防回归。

### Decision 3: degraded-context 使用结构化 omission 投影

`SharedSendDegradedInfo` 增加 Manifest omission 数组，保留旧 string omission 作为 unknown /
legacy fallback。UI 优先使用结构化数据：

```text
main summary (localized)
  -> explicit Continue / Cancel buttons
  -> details disclosure
       mode label
       localized omission category + reason + disposition
       localized estimated token count
```

已知 enum/category 使用稳定 key map，不把 backend 英文 reason 当协议；动态 assistant
outcome 使用受限 parser；未知值通过
`unknownDetail({value})` 原样展示，保证可诊断而不猜测。

按钮仍然存在：

- `继续发送`：只 resolve 已存在的 degraded decision，之后才能产生 context/prompt side
  effect。
- `取消`：保持既有 cancel/commit semantics。

Alternative：只替换中文字符串但继续拼 raw arrays。拒绝，因为新增 compiler category 后会
再次泄漏英文，并且无法区分 category/reason/disposition。

### Decision 4: i18n namespace 保持全 locale parity

新增 key 覆盖：

- degraded 摘要、详情开关、字段 label；
- projection modes；
- omission categories、reasons、dispositions、outcome statuses；
- Shared recovery 动作与对象名。

所有 locale 文件同步 key 和 placeholders；`sharedSendLocaleParity.test.ts` 继续作为结构 gate。
简体/繁体中文不出现可本地化的 `Probe/Binding/Attempt/Target/omissions/estimated tokens`。

### Decision 5: destination-owned 是 benign de-duplication，不是 degraded omission

Manifest 继续保存 `destination-owned`，用于说明哪些 canonical facts 已由目标 Native
history 持有；prepare status 和 UI gate 只计算 `requires_confirmation` omissions。

```text
portable entries = canonical facts - destination-owned facts
if portable entries is empty:
  promptPrefix = ""
  context ACK evidence = no-context-transfer-required
if actionable omissions is empty:
  status = ready
```

该决策保留 cursor/Manifest 审计，同时恢复同目标续聊的 Native UX。Alternative 是前端隐藏
卡片；拒绝，因为 backend 仍会注入空 marker 并改变 CLI 行为。

### Decision 6: Native identity 在 coordinator trust boundary 规范化

Claude 任意 Runtime ingress 的 native identity 使用：

```text
raw uuid        -> claude:<uuid>
claude:<uuid>   -> claude:<uuid>
Codex thread id -> unchanged
```

`materialize_attempt_binding` 同时兼容历史 raw UUID，不再把 raw existing identity 当成缺失并
生成新 UUID。Provider runtime key 仍是 identity 的组成部分，因此相同 raw UUID 不会跨
Provider 串线。

Codex 新 Binding 在调用 `thread/start` 前登记 provider-scoped provisioning hold。只拦截
`thread/started`，拿到 exact thread id 后转为 native-session hold；`bind_runtime_turn`
在同一 replay barrier 中把目标事件投影到 Shared owner，并释放非目标 Native 事件。该 hold
不接管普通 turn delta，也不增加 root polling/state。

### Decision 7: stale Native Binding 终止当前 Attempt，并保留显式恢复

`No conversation found with session ID` 是确定的 Binding identity rejection，不是普通模型
拒绝，也不是可自动重试 transport error：

```text
persist/confirm failed terminal once
mark binding recovery-required(reason=native-session-not-found)
remove runtime owner and held events
return binding-recovery-required
frontend -> recovery-required early return (no raw error row)
```

若 Runtime terminal 已先落账，response path 复用既有 failed terminal，不再追加语义冲突的
第二份 `turnCommitted`。用户只能显式 Probe/Rebuild；禁止自动创建新 session 或换 Provider。

### Decision 8: Hidden Binding 可见性由 V2 durable state 投影

实时 `thread/started` hold 只解决 dispatch 窗口，不能替代 catalog truth。Shared V2 不写回
V0 `bindings_by_engine`，因此 `list_shared_sessions` 必须合并：

```text
V0 bindings_by_engine.nativeThreadId      # legacy compatibility
V2 shared_binding_state.nativeSessionId   # canonical source
  -> sort + dedupe
  -> SharedSessionSummary.nativeThreadIds
  -> Sidebar catalog exclusion
```

这样 ordinary Native catalog 可以保持独立扫描，Shared ownership 仍由 durable Binding row
决定。Alternative 是在 frontend 临时记住首发 thread id；拒绝，因为刷新、重启或 catalog
重载后内存证据消失，Hidden Binding 会再次泄漏。

## Risks / Trade-offs

- [Risk] `runtime_failure_unclassified` 降低了具体错误分类精度
  → 仅在 Runtime 明确失败但未提供 code 时使用；`errorMessage` 和原始 diagnostics 仍保留，
  后续 adapter 可补更精确 code。
- [Risk] 已落入 Shared history 的 Native diagnostic 被隐藏后，用户看不到 raw error
  → Shared 状态条保留 typed recovery state/action；raw evidence 仍在 diagnostics/canonical
  error message，不作为第二恢复 UI。
- [Risk] backend 新增未知 omission category 时无法立即翻译
  → 显示 localized unknown label + raw category/reason，不静默丢失；新增稳定 category 时补
  key map。
- [Risk] locale 文件修改面较大
  → locale parity test + component focused test 锁定 key 和 placeholder。
- [Risk] provider-scoped provisioning hold 短暂拦住同 Provider 的另一个 Codex
  `thread/started`
  → hold 只覆盖 `thread/start` 到 exact bind 的窗口；exact event 归属当前 Attempt，其余事件
  在 barrier drain 原样释放。
- [Risk] 历史 raw Claude Binding 已指向不存在的 UUID
  → raw-but-valid identity 自动规范化；Runtime 明确报 missing session 时进入显式 rebuild，
  不猜测新 identity。

## Migration Plan

1. 先上线 coordinator normalization；旧未落账 Attempt 仍按现有 Probe/Rebuild 恢复，新 Turn
   不再因 missing code 进入该错误窗口。
2. 上线 Shared recovery presentation gate；Native card 行为保持默认。
3. 上线 structured omission/i18n；不改变 store 持久化或 IPC payload。
4. 上线 benign omission、identity normalization、Codex provisioning hold、V2 catalog
   exclusion 与 typed stale Binding recovery。
5. 回滚可分别撤回各层改动。validator、canonical schema 与历史数据均无迁移；raw Claude
   Binding 在首次成功发送时被就地规范化。

## Open Questions

- 无。fallback code、恢复 owner 与 degraded gate 均由现有 foundation contract 决定。
