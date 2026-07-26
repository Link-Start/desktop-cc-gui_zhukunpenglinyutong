# mossx 多 CLI × 多 Provider 会话基石设计

> 状态：Architecture Decision Draft  
> 日期：2026-07-27  
> 适用范围：Native Session、Shared Session、Provider Runtime、Session Catalog、Sidebar Projection、未来 Plugin / Orchestration  
> 核心决策：Native Session 保持原生身份；Shared Session 承担跨 CLI、跨 Provider 的逐 Turn 切换

---

## 一、Executive Summary

mossx 的长期基石不应是“把多个 CLI 放进同一个下拉框”，而应是一个稳定的多 Runtime 会话系统：

```text
Native Session
  = 固定 CLI
  + 固定 Provider Binding
  + 原生 CLI Session Identity
  + 原生 history / resume / fork / tools 语义

Shared Session
  = 一个 Canonical Shared Thread
  + 每个 Next Turn 可选择 Execution Target
  + Execution Target = CLI + Provider + Model + Reasoning
  + 每个 CLI + Provider 组合拥有独立隐藏 Native Binding
  + 通过 Handoff Capsule 在不同 Target 之间同步上下文
```

最终产品语义：

1. Native Session 在创建时选择 CLI 和 Provider，创建后绑定不可变。
2. Native Session 更换 Provider 时，不修改原会话，而是执行“使用其他 Provider 继续”，创建一个新的 `Provider Continuation`。
3. Shared Session 在每个 Turn 发送前允许切换 CLI、Provider、Model 与 Reasoning。
4. Shared Session 对用户始终只有一个会话；内部 Native Binding 不进入 Sidebar。
5. Subagent、User Fork、Provider Continuation、Shared Binding 是四种不同关系，不共用一种 Parent/Child 语义。
6. `parentThreadId` 只表达 Engine/runtime 权威的 Subagent ownership；用户血缘关系使用独立的 `sourceSessionId`。
7. Provider Continuation 第一阶段作为带标签的顶层 Session 展示，不提前引入 Conversation Family。

一句话概括：

> Native Session 负责原生性与隔离；Shared Session 负责自由切换与编排；Handoff Protocol 负责二者之间的上下文连续性。

---

## 二、为什么必须先做“会话基石”

### 2.1 四个概念不能混为一个字段

多 CLI 客户端至少存在四个独立维度：

| 维度 | 回答的问题 | 示例 |
|---|---|---|
| CLI / Engine | 谁在执行 Agent Runtime | Claude Code、Codex CLI、Kimi CLI |
| Provider | CLI 通过哪个配置与服务端通信 | Official、OpenRouter、Azure-compatible、Company Gateway |
| Model | 本 Turn 使用哪个模型 | `claude-opus-*`、`gpt-5-*` |
| Session | 对话、恢复、工具状态归谁所有 | Claude native session、Codex thread、Shared thread |

错误建模：

```text
selectedEngine = "claude-openrouter-opus"
```

这种做法会把 Runtime、认证、Model Catalog 和 Session Identity 压成一个字符串，随后出现：

- 换 Model 被误判为换 Session；
- 同一 CLI 的不同 Provider 共享错误 Runtime；
- 删除 Provider 后历史无法解释；
- Sidebar 无法表达会话来源；
- Usage Attribution 无法确定归属；
- Shared Session 切回旧目标时无法恢复原生上下文。

正确建模：

```text
Execution Target
  ├─ Engine
  ├─ Provider Profile
  ├─ Model
  └─ Reasoning
```

### 2.2 真正困难的不是 Picker

UI Picker 只是入口。系统真正要解决的是：

1. **Target Identity**：一次 Turn 到底由哪个 CLI、Provider、Model 执行。
2. **Runtime Ownership**：Process、Home、env、pending input、approval state 归谁。
3. **Context Ownership**：历史是 App 持有，还是外部 CLI 持有。
4. **Relationship Semantics**：Subagent、Fork、Provider Continuation 如何投影。
5. **Recovery**：重启后如何恢复相同 Target、Binding 和同步游标。
6. **Provenance**：历史中每个结果来自哪里。

如果这些边界不先稳定，Provider Picker 越早接入，后续返工越大。

---

## 三、从 pi 与 LiveAgent 提炼出的架构原则

### 3.1 学 pi：薄 Core，不复制 Feature

pi 的关键不是功能数量，而是 Core 只负责：

- Agent Loop；
- 标准事件；
- Session Log；
- 消息队列；
- 可注入 Hook；
- Provider/Protocol 抽象。

Permission Gate、Plan Mode、Subagent、Sandbox 等能力建立在这些决策点之上。

mossx 应采用同样分寸：

```text
Core 提供稳定事实与决策点
Feature 决定策略
Plugin 只能消费受控能力
```

Core 不负责猜测“哪个 CLI 更适合当前 Prompt”，也不负责静默切换 Provider。

### 3.2 学 pi-ai：Provider 与 Protocol 正交

pi-ai 将 Provider 与 API/Wire Protocol 分开：

```text
Provider
  = identity + endpoint + auth + model catalog

Protocol
  = request serialization + stream parsing
```

映射到 mossx：

```text
Provider Profile
  = providerProfileId + endpoint/auth/config + model catalog

Engine Protocol
  = claude stream-json
  | codex app-server JSON-RPC
  | kimi stream-json
  | future protocol
```

CLI 不是 Provider，Provider 也不是 Model。

### 3.3 学 pi：统一 AgentEvent

不同 CLI 的事件应先归一到 mossx 自有事件，再翻译给前端：

```text
CLI Native Event
      ↓
Engine Protocol Adapter
      ↓
MossxAgentEvent
      ├─ Frontend Sink
      ├─ Session Persistence Sink
      ├─ Orchestrator Sink
      └─ Plugin Hook Sink
```

最低事件面：

```typescript
type MossxAgentEvent =
  | { type: "run:start"; runId: string; target: TurnExecutionSnapshot }
  | { type: "turn:start"; runId: string; turnId: string }
  | { type: "message:delta"; turnId: string; delta: unknown; partial: unknown }
  | { type: "tool:start"; turnId: string; toolCallId: string; toolName: string }
  | { type: "tool:update"; turnId: string; toolCallId: string; partialResult: unknown }
  | { type: "tool:end"; turnId: string; toolCallId: string; isError: boolean }
  | { type: "turn:end"; runId: string; turnId: string }
  | { type: "run:settled"; runId: string; outcome: RunOutcome };
```

`run:settled` 是编排器唯一可靠的“彻底空闲”信号。不能把单个 `turn:end` 当作没有 Retry、Compaction 或排队消息的最终完成。

### 3.4 学 pi：append-only Log + consumer-side replay

会话关系、Target 选择、Handoff、Job 状态应记录为 append-only facts：

```text
事实只追加
状态由消费者重放计算
```

优点：

- 崩溃后可以恢复；
- 历史可审计；
- 不需要依赖易丢失的内存闭包；
- 多个消费者可构建不同 Projection；
- 错误修复可以重建 Projection，而不是修改历史。

### 3.5 学 LiveAgent，但不复制 LiveAgent

LiveAgent 切换 Provider 顺滑，因为：

- Conversation History 由应用统一持有；
- Agent Loop 由应用持有；
- Tool Registry 由应用持有；
- Provider 只是 HTTP Adapter。

mossx 管理的是真实 CLI Runtime。CLI 自己拥有部分：

- Native History；
- Tool State；
- Resume Identity；
- Provider-specific Runtime；
- Approval 与 User Input 状态。

因此 mossx 不应复制 LiveAgent 的“每次把完整 canonical history 重新序列化给 API”。

mossx 应保留 Native Runtime，并建立：

```text
多个隐藏 Native Binding
        +
Canonical Shared Thread
        +
结构化 Handoff Capsule
```

---

## 四、双轨 Session 产品模型

### 4.1 Native Session

定义：

```text
Native Session
  = Engine
  + Provider Binding
  + Native Session ID
```

约束：

- Engine 创建后不可变。
- Managed Provider Binding 创建后不可变。
- Model 可以按 CLI 原生能力切换，不自动改变 Binding Identity。
- Provider 全局默认变化不得重路由已有 managed-bound Session。
- Resume、Fork、History、Usage 继续遵循对应 CLI 的原生语义。
- Provider 缺失或失效时 fail closed，不静默回退到 local/default。

Native Session 的价值是：

- 原生恢复；
- 原生工具链；
- 原生 Fork；
- Provider Runtime 隔离；
- 精确故障定位；
- 历史身份稳定。

### 4.2 Native Session 更换 Provider

Native Session 内不提供普通热切 Provider。

用户入口：

```text
使用其他 Provider 继续
```

执行语义：

```text
1. 用户选择新 Provider。
2. 系统冻结来源 Session 的 Target Snapshot。
3. 系统生成 Handoff Capsule。
4. 创建一个新的 Native Session。
5. 新 Session 绑定新 Provider。
6. 注入 Handoff Summary。
7. 新 Session 显示“供应商续接”标签。
8. 原 Session 保留，不删除、不改写、不自动归档。
```

这不是 Subagent，也不是普通 Fork：

- Subagent 是 Agent/runtime 自动派生的执行单元。
- User Fork 是用户从某个历史节点分叉。
- Provider Continuation 是用户为了更换 Provider 而创建的续接会话。

### 4.3 Shared Session

定义：

```text
Shared Session
  = Canonical Shared Thread
  + Selected Execution Target
  + Hidden Native Bindings
  + Handoff / Sync State
```

Shared Session 的 Conversation Type 创建后不可变。

每个 Turn 发送前允许选择：

```text
Execution Target
  = Engine
  + Provider Profile
  + Model
  + Reasoning
```

约束：

- 一个 Turn 只能绑定一个 Target。
- 正在运行的 Turn 不得中途换 Target。
- Picker 变化只影响 Next Turn。
- 不根据 Prompt 自动路由。
- Target 失败时不得静默 Fallback。
- 切回旧 Target 时复用旧 Hidden Binding。
- 所有用户和 Assistant 消息仍进入同一个 Canonical Shared Thread。

### 4.4 Shared Session 为什么不会污染 Sidebar

Shared Session 对用户只显示一条：

```text
跨模型实现登录                  Shared · Codex/OpenAI
```

内部可能有：

```text
Shared Session
├─ Claude / Official Binding
├─ Claude / OpenRouter Binding
├─ Codex / OpenAI Binding
└─ Codex / Azure Binding
```

这些 Binding：

- 属于 Shared Session Runtime Internal；
- 不进入 Native Session Sidebar；
- 不参与 Native Folder Assignment；
- 不作为独立用户会话打开；
- 只通过 Shared Session Identity 恢复。

---

## 五、核心领域模型

### 5.1 ExecutionTarget

```typescript
interface ExecutionTarget {
  engine: EngineType;
  providerProfileId?: string;
  model?: string;
  reasoning?: ReasoningSelection;
}
```

这是“下一 Turn 要发给谁”的可变选择。

它不是 Runtime Owner Key，也不是历史事实。发送时必须生成不可变 Snapshot。

### 5.2 TurnExecutionSnapshot

```typescript
interface TurnExecutionSnapshot {
  engine: EngineType;
  providerProfileId?: string;
  providerProfileNameSnapshot?: string;
  providerProfileSource?: ProviderProfileSource;
  model?: string;
  reasoning?: ReasoningSelection;
  nativeSessionId?: string;
}
```

规则：

- 每个 Turn 创建一次后不可变。
- Provider 显示名保存 Snapshot，避免 Provider 删除后历史不可解释。
- Usage、Error、Retry、Recovery 全部绑定 Snapshot。
- UI 不能用“当前 Picker 值”解释历史 Turn。

### 5.3 NativeSessionBinding

```typescript
interface NativeSessionBinding {
  engine: EngineType;
  providerProfileId?: string;
  nativeSessionId: string;
  ownerWorkspaceId: string;
  availability: "available" | "unavailable";
}
```

Native Session 的 Binding Identity：

```text
Engine + Provider Profile + Native Session ID
```

Native Session 不允许通过修改字段把 Binding A 变成 Binding B。

### 5.4 SharedTargetBinding

```typescript
interface SharedTargetBinding {
  bindingKey: string;
  sharedSessionId: string;
  engine: EngineType;
  providerProfileId?: string;
  nativeSessionId?: string;
  lastSyncedSharedEntryId?: string;
  availability: "ready" | "missing-provider" | "missing-runtime" | "degraded";
}
```

推荐 Binding Key：

```text
Engine + Provider Profile
```

Model 默认不进入 Binding Key。

原因：

- 同一 CLI + Provider 下换 Model 通常不要求创建新 Native Session。
- 若把 Model 加入 Key，每换一次 Model 都会制造新 Binding。
- 个别 CLI 如果要求换 Model 必须新 Session，应通过 Capability 特判。

### 5.5 SessionOrigin

```typescript
type SessionOrigin =
  | { kind: "root" }
  | {
      kind: "subagent";
      parentSessionId: string;
      agentRole?: string;
      spawnedByToolCallId?: string;
    }
  | {
      kind: "user-fork";
      sourceSessionId: string;
      sourceTurnId?: string;
    }
  | {
      kind: "provider-continuation";
      sourceSessionId: string;
      sourceProviderProfileId?: string;
    }
  | {
      kind: "shared-binding";
      sharedSessionId: string;
    };
```

关键边界：

```text
parentSessionId
  = Runtime ownership
  = Subagent Sidebar tree

sourceSessionId
  = User lineage
  = Fork / Provider Continuation audit
  = 不触发 Subagent tree

sharedSessionId
  = Hidden binding ownership
  = 不进入用户可见 Sidebar
```

### 5.6 HandoffCapsule

```typescript
interface HandoffCapsule {
  source: {
    sessionId: string;
    target: TurnExecutionSnapshot;
    lastEntryId?: string;
  };
  destination: {
    sessionId?: string;
    target: ExecutionTarget;
  };
  goal: string;
  constraints: string[];
  progress: string[];
  keyDecisions: string[];
  nextSteps: string[];
  criticalContext: string[];
  files: {
    read: string[];
    modified: string[];
    created: string[];
  };
  toolOutcomes: Array<{
    tool: string;
    outcome: string;
    isError: boolean;
  }>;
  attachments: Array<{
    name: string;
    reference: string;
  }>;
  omissions: string[];
}
```

Handoff Capsule 分成两层：

1. Structured Entry：完整结构化数据，不直接灌入 LLM Context。
2. Handoff Summary：确定性投影后的文本，进入目标 CLI Context。

---

## 六、Session Relationship 与现有子会话隔离

### 6.1 四种关系不是同一种“Child”

| 类型 | 创建者 | Sidebar | Parent 字段 | 主要用途 |
|---|---|---|---|---|
| Subagent | Engine/runtime | 嵌套在 Parent 下 | `parentSessionId` | Agent 协作执行 |
| User Fork | 用户 | 顶层 Session | `sourceSessionId` | 从历史节点分叉 |
| Provider Continuation | 用户 | 顶层 Session | `sourceSessionId` | 更换 Provider 后继续 |
| Shared Binding | Shared Runtime | 不可见 | `sharedSessionId` | Shared 内部执行 |

### 6.2 Subagent

现有行为保持不变：

- Claude/Codex runtime 提供 authoritative relationship。
- 子会话保留自己的 canonical identity。
- Sidebar 嵌套展示。
- 显示 `子代理` 标签与 Agent role。
- Parent Turn settlement 与 Child 状态分别处理。

禁止：

- 按相同标题合并 Subagent。
- 把 Child canonical id 改写成 Parent id。
- 把 User Fork 或 Provider Continuation 写入 Subagent relationship writer。

### 6.3 User Fork

现有行为保持不变：

- 用户主动创建。
- 顶层 Conversation。
- Parent 保留。
- Child 首次发送后迁移到 canonical identity。
- 不显示 `子代理` 标签。

建议增加 `Fork` Origin 标签，但不改变既有生命周期。

### 6.4 Provider Continuation

Provider Continuation：

- 用户主动创建。
- 顶层 Conversation。
- 使用新的 Provider Binding。
- 来源 Session 保留。
- 通过 `sourceSessionId` 和 Handoff Capsule 可追溯。
- 不获得 `parentThreadId`。
- 不触发 Parent/Child Sidebar Tree。

硬约束：

> `Provider Continuation` MUST NOT 写入 Subagent relationship writer，MUST NOT 使用 `parentThreadId` 触发子代理树投影。

### 6.5 Shared Binding

Shared Binding：

- 只由 Shared Session 创建。
- 第一次向 Target 发送时 Lazy Create。
- 切回相同 Target 时复用。
- Native Process 可释放，Binding Metadata 保留。
- 不进入 Native Catalog 可见投影。
- 不显示 Origin/Provider 标签。

---

## 七、Sidebar Projection 与标签系统

### 7.1 标签分层

Sidebar 标签分三类：

1. **Conversation Type**：`Shared`。
2. **Execution Identity**：CLI、Provider。
3. **Origin**：`子代理`、`Fork`、`供应商续接`。

示例：

```text
重构登录模块                    Claude · Official
验证边界条件                    子代理 · Explore
重构登录模块                    Fork · Claude · Official
重构登录模块                    供应商续接 · Claude · OpenRouter
跨模型实现登录                  Shared · Codex/OpenAI
```

### 7.2 标签优先级

Sidebar 空间有限时：

```text
Origin > Conversation Type > Engine > Provider > Model
```

解释：

- Origin 决定用户是否会误解关系。
- Shared 必须与 Native 明确区分。
- Engine 是执行主体。
- Provider 用于隔离与排错。
- Model 变化频率高，不建议默认占 Sidebar 空间。

推荐展示：

| Session | 主标签 | 次标签 |
|---|---|---|
| Native Root | Engine | Provider |
| Subagent | 子代理 + role | Engine |
| User Fork | Fork | Engine + Provider |
| Provider Continuation | 供应商续接 | Engine + Provider |
| Shared | Shared | 当前 Engine/Provider |

### 7.3 为什么第一阶段不做 Conversation Family

Provider Continuation 如果全部自动嵌套，容易与现有 Subagent Tree 冲突。

第一阶段采用：

- Provider Continuation 独立顶层展示。
- 用标签表达来源。
- 详情或 Context Menu 提供“查看来源会话”。
- 不复用 `parentThreadId`。

只有真实数据证明 Sidebar 出现大量 Continuation 后，再增加独立的：

```text
Conversation Family Projection
```

该 Projection 必须基于 `sourceSessionId` 单独计算，不能复用 Subagent Tree。

### 7.4 Shared Session 的动态标签

Shared Sidebar Row 可以显示当前 Next Turn Target：

```text
Shared · Claude/OpenRouter
```

但历史解释必须使用 Turn Snapshot：

```text
Turn 1 · Claude/Official
Turn 2 · Codex/OpenAI
Turn 3 · Claude/OpenRouter
```

当前 Picker 变化不得重写过去 Turn 的标签。

---

## 八、Shared Session 多 CLI × Provider 执行流程

### 8.1 Picker

建议 Picker 层级：

```text
CLI
└─ Provider
   └─ Model
      └─ Reasoning
```

用户选择只更新：

```text
selectedExecutionTarget
```

不创建 Binding，不发送消息。

### 8.2 Send

```text
1. 读取 selectedExecutionTarget。
2. 解析 Provider Availability。
3. 解析 Provider-scoped Model Catalog。
4. 固化 TurnExecutionSnapshot。
5. 查找 Engine + Provider 对应 Hidden Binding。
6. Binding 不存在则 Lazy Create。
7. 根据 lastSyncedSharedEntryId 生成 Handoff / Delta Context。
8. 向目标 Native Session 发送。
9. 统一事件总线写入 Canonical Shared Thread。
10. Terminal 后推进该 Binding 的同步游标。
```

### 8.3 Switch Back

场景：

```text
Claude/Official
→ Codex/OpenAI
→ Claude/Official
```

系统只持有两个 Hidden Binding：

```text
Binding A = Claude/Official
Binding B = Codex/OpenAI
```

第三个 Turn 恢复 Binding A，并把 Binding A 离开期间的 Shared Context 作为 Handoff 注入。

不会创建第三个 Native Binding。

### 8.4 失败语义

- Provider 不存在：阻止发送，保留 Picker 选择并显示 unavailable。
- Model 不属于 Provider Catalog：阻止发送，不改用默认 Model。
- Native Binding 恢复失败：显示 recoverable error，允许显式重建 Binding。
- Turn 失败：保留原 Target Snapshot，不自动重路由。
- Handoff 生成失败：不得假装同步成功；可允许用户确认后发送明确的 degraded context。

---

## 九、Context Ownership 与 Handoff Protocol

### 9.1 Canonical Shared Thread 是用户事实源

Shared Session 的用户可见事实源：

```text
Canonical Shared Thread
```

Hidden Native Session 只是执行 Backend，不是用户会话真相。

Canonical Thread 应保存：

- User Message；
- Assistant Message；
- Tool Activity Summary；
- TurnExecutionSnapshot；
- Handoff Reference；
- Error/Recovery Fact；
- Attachment Reference。

### 9.2 不灌完整异构历史

Claude、Codex、Kimi 的 Tool Message、Reasoning、System Prompt 与 Native State 不同。

直接把 A 的完整 Wire History 塞给 B 会导致：

- Context 爆炸；
- Tool Call/Result 配对失真；
- System Prompt 冲突；
- 不兼容的 Reasoning Block；
- Attachment 丢失；
- Provider Cache 失效。

因此跨 Target 使用：

```text
Structured Handoff Capsule
        ↓
Deterministic Summary Projection
        ↓
Target Native Session
```

### 9.3 Handoff Summary 固定结构

```markdown
## Goal

## Constraints & Preferences

## Progress

## Key Decisions

## Next Steps

## Critical Context

## Files

## Tool Outcomes

## Omissions
```

必须显式列出 `Omissions`，避免目标 CLI 误以为获得了完整上下文。

### 9.4 当前 8 Turn / 4000 字符同步的定位

现有 Shared Session 的 bounded delta sync 可以保留为过渡实现，但应标记为：

```text
Compatibility Handoff V0
```

它不是最终 Context Protocol，因为缺少：

- Tool outcome；
- File operations；
- Attachment；
- Key decisions；
- Omission diagnostics；
- Durable source reference；
- Structured checkpoint。

---

## 十、Provider Runtime 与 Model Catalog

### 10.1 Runtime Ownership

Provider-scoped Runtime Owner 至少包含：

```text
Workspace Owner + Engine + Provider Profile
```

必须隔离：

- Process；
- env；
- CLI Home；
- Active Turn；
- Pending User Input；
- Approval State；
- Interrupt Owner；
- Retry/Recovery。

### 10.2 Provider-scoped Model Catalog

Model 选择必须由当前 Target 的 Provider Catalog 提供：

```text
ExecutionTarget.providerProfileId
        ↓
Provider Catalog
        ↓
Available Models
```

禁止：

- 用默认 Provider Catalog 展示 managed Provider 的 Model；
- Provider Catalog 加载失败后静默显示 local/default；
- 仅凭 Model ID 反推 Provider；
- 把 Provider ID 与 API Protocol 混为同一个字段。

### 10.3 Credential Resolution

推荐优先级：

```text
Turn explicit managed binding
> Session persisted managed binding
> explicit local/default
```

Managed Binding 一旦存在，不允许 ambient env 或全局配置静默接管。

---

## 十一、统一事件流与消息投递

### 11.1 三档投递语义

借鉴 pi：

| 语义 | 使用场景 | 时机 |
|---|---|---|
| `steer` | 运行中纠偏 | 当前原子执行段结束、下一决策点前 |
| `followUp` | 接力继续 | 当前 Run settled 后 |
| `nextTurn` | 被动铺垫 | 下一次用户 Turn 前，不主动触发 |

跨 CLI Handoff 默认使用 `followUp`。

### 11.2 Capability-driven Degradation

并非所有 CLI 都支持真正 Mid-turn Injection。

能力示例：

```text
input.mid-turn = supported
input.mid-turn = compat-input
input.mid-turn = unsupported
```

降级规则：

- `supported`：原生注入。
- `compat-input`：interrupt/resume 封装，并明确展示。
- `unsupported`：降级到 `followUp`，不得伪装成原生 steer。

### 11.3 精确 Owner Routing

Interrupt、Approval、AskUserQuestion、Retry、Compact 必须携带完整 Owner：

```text
Logical Session
+ Engine
+ Provider Profile
+ Native Session
+ Run
+ Turn
```

只按 `workspace + engine` 查找 Owner，在同一 Engine 多 Provider 并行后必然串线。

---

## 十二、持久化与迁移

### 12.1 SharedSessionMeta 演进

当前概念：

```text
selectedEngine
bindingsByEngine
```

目标：

```typescript
interface SharedSessionMetaV2 {
  selectedTarget: ExecutionTarget;
  bindingsByTarget: Record<string, SharedTargetBinding>;
  schemaVersion: 2;
}
```

迁移：

```text
selectedEngine
→ selectedTarget.engine

bindingsByEngine[engine]
→ bindingsByTarget[key(engine, default-provider)]
```

旧 Session 继续按 local/default 语义恢复，不猜测 managed Provider。

### 12.2 Native Session Origin Metadata

新增 Origin 时应保持现有 Catalog Identity：

```text
stable key = Engine + Owner Workspace + Canonical Session ID
```

Origin 是 metadata，不得改变 canonical identity。

### 12.3 Provider 删除后的历史

删除 Provider Profile 后：

- 历史 Session 保留。
- `providerProfileId` 保留。
- `providerProfileNameSnapshot` 保留。
- availability 变为 unavailable。
- Resume/Send fail closed。
- 用户可以执行“使用其他 Provider 继续”创建新 Session。

---

## 十三、当前能力与缺口

### 13.1 已有资产

mossx 已具备：

- 多 CLI Native Runtime；
- Claude/Codex/Kimi Provider-scoped Runtime；
- Per-session Provider Binding；
- Provider-scoped Model Catalog；
- Workspace Session Catalog；
- Shared Session canonical thread；
- Claude/Codex Hidden Binding；
- Engine Provenance；
- Subagent Sidebar Tree；
- User Fork 独立顶层语义；
- Provider Profile unavailable/fail-closed 语义；
- App-server compatible frontend event contract。

### 13.2 P0 缺口

- `ExecutionTarget` 尚未成为 Shared Session 一等契约。
- Shared Send Payload 尚未贯通 `providerProfileId`。
- `bindingsByEngine` 不能表达同一 Engine 多 Provider。
- Shared Binding 同步游标不是 Target-scoped。
- Shared Model Picker 未完全绑定 Provider-scoped Catalog。
- Shared Turn 缺少完整 Provider/Model Snapshot。
- Pending Rebind 只按 workspace/engine 时存在歧义。
- Interrupt/Recovery/Approval Owner 尚未全部 Target-aware。
- Provider Continuation 缺少独立 Origin 类型与标签。

### 13.3 P1 缺口

- 当前 Handoff 只有 bounded text delta。
- 缺少 Structured Handoff Capsule。
- 缺少 Tool/File/Attachment 摘要。
- 缺少 Omission Diagnostics。
- 缺少 Shared Checkpoint/Compaction。
- 缺少统一 `run:settled`。
- Rust 侧事件汇聚仍未完全收敛为单一 Event Bus。

### 13.4 P2 缺口

- 外部 RPC/SDK。
- Plugin Agent Hook。
- Pipeline/DAG Orchestrator。
- Conversation Family Projection。
- 自动 Handoff 策略与可插拔 Summarizer。

---

## 十四、分阶段路线

### Phase 0：冻结产品与数据契约

交付：

- `ExecutionTarget`
- `TurnExecutionSnapshot`
- `SessionOrigin`
- Binding Key 规则
- Sidebar 标签规则
- Hidden Binding 可见性规则
- Failure Matrix

验收：

- Native/Shared/Subagent/Fork/Continuation 五类对象不会互相误投影。
- Provider 删除后历史仍可解释。
- Model 不进入默认 Binding Key。

### Phase 1：Shared Session 支持 CLI × Provider

交付：

- `selectedEngine` 升级为 `selectedTarget`。
- `bindingsByEngine` 升级为 `bindingsByTarget`。
- Shared Send 全链路贯通 `providerProfileId`。
- Provider-scoped Model Picker。
- Turn Provider/Model Provenance。
- Target-aware Pending Rebind、Interrupt、Recovery。

验收矩阵：

```text
Claude/Official
→ Claude/OpenRouter
→ Codex/OpenAI
→ Claude/Official
```

必须满足：

- 一个 Shared Sidebar Row；
- 三个 Hidden Binding；
- 切回 Claude/Official 复用原 Binding；
- 每个 Turn Provenance 正确；
- 任一 Provider 失败不重路由。

### Phase 2：Native Provider Continuation

交付：

- “使用其他 Provider 继续”入口。
- Handoff V0。
- 新 Native Session 创建与 Binding。
- `provider-continuation` Origin。
- `供应商续接` 标签。
- “查看来源会话”导航。

验收：

- 原 Session 不变。
- 新 Session 顶层显示。
- 不写 `parentThreadId`。
- 不显示 `子代理` 标签。
- Provider Profile 不同。
- 删除来源 Session 不级联删除 Continuation。

### Phase 3：Handoff Capsule V1

交付：

- Structured Handoff Entry。
- Deterministic Summary Projection。
- File/Tool/Attachment/Omission。
- Target-scoped Sync Cursor。
- Shared Checkpoint。

验收：

- 长会话切换不依赖固定 8 Turn。
- Tool Call/Result 不被错误拆散。
- Handoff 可审计、可重放。
- 失败不会推进同步游标。

### Phase 4：统一 Event Bus 与 Orchestration Foundation

交付：

- `MossxAgentEvent`
- `run:settled`
- 统一 Run/Turn/Item ID
- Event Bus 多 Sink
- `steer/followUp/nextTurn`
- Runtime Capability Matrix

验收：

- 所有启用 Engine 从同一 Bus 输出。
- Frontend Contract 不回退。
- Shared 调度不依赖轮询。
- Provider-scoped 并行不会串 Owner。

### Phase 5：Plugin / Pipeline

在前四阶段稳定后再开放：

- Agent Event Hooks；
- Provider/Engine Registration；
- Handoff Summarizer Extension；
- Pipeline single/parallel/chain；
- 后续 DAG；
- 外部 RPC/SDK。

禁止 Plugin Market 反向定义 Execution Core。

---

## 十五、OpenSpec Change 切分建议

不要把全部能力塞进一个巨型 Change。

建议拆分：

### Change A：compose-shared-session-execution-target

范围：

- Shared `ExecutionTarget`
- Provider-aware Binding
- Provider-scoped Picker/Catalog
- Turn Snapshot
- Target-aware Routing

### Change B：add-native-provider-continuation

范围：

- Continuation 创建
- SessionOrigin
- Sidebar 标签
- 来源导航
- 与 Subagent/User Fork 隔离

### Change C：add-shared-handoff-capsule

范围：

- Structured Handoff
- Summary Projection
- Sync Cursor
- Checkpoint/Compaction

### Change D：converge-engine-event-runtime

范围：

- Unified Event Bus
- `run:settled`
- Runtime Capability
- Owner Routing

Change 依赖：

```text
A ──→ C
B ──→ C
A ──→ D
C ──→ Future Orchestration
D ──→ Future Plugin Hooks / RPC
```

---

## 十六、验证矩阵

### 16.1 Session Projection

| 场景 | 预期 |
|---|---|
| Runtime 创建 Subagent | 嵌套显示，带 `子代理` 标签 |
| 用户创建 Fork | 顶层显示，带 `Fork` 标签 |
| 用户换 Provider 继续 | 顶层显示，带 `供应商续接` 标签 |
| Shared 创建 Hidden Binding | Sidebar 不显示 |
| Provider Continuation 带 sourceSessionId | 可查看来源，但不嵌套 |

### 16.2 Provider Isolation

| 场景 | 预期 |
|---|---|
| 同 Workspace 两个 Claude Provider 并行 | Process/env/approval/interrupt 互不影响 |
| Shared 在同一 Engine 切 Provider | 使用两个 Hidden Binding |
| 删除 Provider | 历史保留，Resume fail closed |
| 全局切换 Provider | 不影响 managed-bound Session |

### 16.3 Context

| 场景 | 预期 |
|---|---|
| 切到新 Target | 注入 Handoff |
| 切回旧 Target | 只同步离开期间新增事实 |
| Handoff 失败 | 不推进 Cursor |
| Context 被裁剪 | `Omissions` 可见 |
| Tool Result 很长 | 保留结构化引用，Summary 有界 |

### 16.4 Recovery

| 场景 | 预期 |
|---|---|
| App 重启 | 恢复 Shared selectedTarget 与 bindingsByTarget |
| Hidden Native ID 延迟确定 | Target-aware Pending Rebind |
| Provider Profile 不可用 | 保留 unavailable Target，不回退 |
| Continuation 来源被归档 | Continuation 仍可独立恢复 |
| Subagent metadata 延迟到达 | 不闪现为顶层 Provider Continuation |

---

## 十七、Non-goals

第一阶段不做：

- Native Session 原地热切 Provider；
- Mid-turn 切换 CLI/Provider；
- Prompt 自动路由；
- Provider 失败自动 Fallback；
- 把所有 Native History 转成统一 Wire Message；
- Conversation Family 折叠；
- 自动删除旧 Provider Session；
- 自动迁移 Tool State；
- 完整 DAG；
- 先开放 Plugin API 再补 Runtime Contract。

---

## 十八、设计红线

1. Native managed Provider Binding 创建后不可变。
2. Shared Picker 只影响 Next Turn。
3. 一个 Turn 只允许一个 Execution Target。
4. Provider 失败不得静默回退。
5. Historical Turn 必须使用 Snapshot 解释，不能读取当前 Picker。
6. `Provider Continuation` 不得写入 Subagent relationship writer。
7. `User Fork` 与 `Provider Continuation` 不得显示 `子代理` 标签。
8. Shared Hidden Binding 不得进入用户可见 Native Sidebar。
9. Binding Identity 默认不包含 Model。
10. Interrupt/Approval/Recovery 必须精确绑定 Target Owner。
11. 跨 CLI 交接走 Structured Summary，不灌原始 Wire History。
12. Handoff 失败不得推进 Sync Cursor。
13. 旧 Session 不自动删除、不自动归档。
14. Plugin/Orchestrator 必须建立在稳定 Event 与 Session Contract 上。

---

## 十九、最终决策

mossx 采用以下长期产品边界：

```text
Native Session
  = 原生 CLI 会话
  = 创建时选择 Provider
  = Provider Binding 不可变
  = 换 Provider 时创建 Provider Continuation

Shared Session
  = 一个用户可见的 Canonical Conversation
  = 每个 Next Turn 可切换 CLI + Provider + Model
  = 多个隐藏 Native Binding
  = Handoff Capsule 负责跨 Target 连续性

Subagent
  = Runtime-owned Child
  = 唯一使用 Parent-Child Sidebar Tree 的执行关系

User Fork / Provider Continuation
  = User-owned Lineage
  = 顶层 Conversation
  = 通过 Origin 标签与 sourceSessionId 区分
```

这条路线保留 mossx 相比 API Agent 客户端最有价值的能力：

- 真正的多 CLI Runtime；
- Native Session 恢复；
- Provider Runtime 隔离；
- Provider-scoped Model Catalog；
- 可审计的跨 CLI 协作；
- 未来 Plugin 与 Orchestration 的稳定地基。

---

## 二十、参考材料

- [`mossx-plugin-market-and-cli-foundation-design.md`](./mossx-plugin-market-and-cli-foundation-design.md)
- [`pi-architecture-plugin-marketplace-analysis.md`](./pi-architecture-plugin-marketplace-analysis.md)
- [`pi-chat-orchestration-research.md`](./pi-chat-orchestration-research.md)
- [`shared-session-thread` spec](../../openspec/specs/shared-session-thread/spec.md)
- [`shared-session-engine-selection` spec](../../openspec/specs/shared-session-engine-selection/spec.md)
- [`engine-per-session-provider-binding` spec](../../openspec/specs/engine-per-session-provider-binding/spec.md)
- [`subagent-session-tree-navigation` spec](../../openspec/specs/subagent-session-tree-navigation/spec.md)
- [`claude-fork-session-support` spec](../../openspec/specs/claude-fork-session-support/spec.md)
- [`Workspace Session Catalog Contract`](../../.trellis/spec/guides/workspace-session-catalog-contract.md)

