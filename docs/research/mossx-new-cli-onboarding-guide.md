# 新 CLI 接入指南（Engine Onboarding Guide）

> 日期：2026-07-27
> 上游契约：[`mossx-multi-cli-provider-session-foundation-design.md`](./mossx-multi-cli-provider-session-foundation-design.md)（下称**基石设计**）
> 适用读者：要为 mossx 接入新 Agent CLI（如 Grok CLI、Auggie、未来任意 CLI）的工程师
> 核心结论：接入一个新 CLI = **一次 Capability Spike + 一个新 RuntimeDeliveryAdapter + 注册点**，不是改动内核。对存量 CLI 与存量 Shared 会话零影响。

---

## 一、这份文档解决什么问题

基石设计把 mossx 的会话系统建成 capability-driven 架构：内核（Canonical Event Log、ContextCompiler、Cursor、Provisioning）不感知具体 CLI，所有 CLI 差异收敛到三个扩展点：

```text
扩展点 1: RuntimeDeliveryAdapter   —— 投递与 ACK 语义（基石设计 §14.3.1）
扩展点 2: RuntimeCapabilities      —— 运行期 Probe 得到的能力画像（§14.3.1/§14.3.2）
扩展点 3: NativeHistoryReader      —— 只读 History 源端（§9.1.1，可后置）
```

新 CLI 接入就是按固定流程填充这三个扩展点。**先读基石设计的 §3.2、§9.2、§14.3 三节**，再回来按本指南执行。

### 1.1 接入前必须建立的心智模型

| 概念 | 一句话 | 基石设计 |
|---|---|---|
| Engine ≠ Provider ≠ Model | CLI 是执行者，Provider 是通信配置，Model 是本 Turn 的选择，三者正交 | §2.1 |
| Capability 不靠猜 | 一切能力由运行期 Probe 得到，禁止按 Engine 名字硬编码假设 | 红线 20/26 |
| ACK 分级 | Process Spawn、stdin write、first token 都不是 ACK；每个 Adapter 用自己的协议证据 | §14.3.1 |
| Intent Before Side Effect | 调用外部 CLI 之前，对应 Intent 必须先 Durable | §14.2.2、红线 25 |
| 降级是合法的 | 能力弱的 CLI 走 `portable-transcript`/`checkpoint` + `ackFidelity = weak`，不假装 exactly-once | §9.2、§14.3.5 |

### 1.2 接入形态分级：先想清楚做到哪一档

不是每个 CLI 都要一次做满。按基石设计的 capability 语义，接入分四档，**每档都是合法的终点**：

| 档位 | 能力 | 对应现状参照 | 工作量 |
|---|---|---|---|
| **L0 Minimal** | prompt wrapper + weak ACK（`inputAck: "first-event"` 或 `"none"`） | 当前 Kimi prompt adapter | M |
| **L1 Standard** | 明确 Input ACK（request-response 或 echo）+ 可靠 Terminal + Pending Probe | Claude（S2 Spike 后） | L |
| **L2 Full** | L1 + structured history import 或 native clone | Codex（S1 Spike 后） | L+ |
| **L3 Continuation** | L1/L2 + NativeHistoryReader，解锁 Provider Continuation | Claude/Codex/Kimi（Change D） | 独立追加 |

**决策建议**：新 CLI 一律从 L0/L1 切入，用真实流量验证 ACK 语义后再评估 L2。L3 永远后置，它不阻塞 Shared Session 的任何能力。

---

## 二、Phase S：Capability Spike（纯调研，不写产品代码）

这是整个接入流程的第一步，也是纪律性最强的一步：**Spike 结论落档之前，禁止写 Adapter contract**。基石设计把这条列为 Phase 0 验收项（"Adapter contract 不以 CLI 文案或假设为依据"）。

### 2.1 Spike 任务模板

复制以下清单，把 `<NEW_CLI>` 替换为目标 CLI，逐项实测并记录证据（命令、输出片段、版本号）：

#### A. 二进制与协议身份

- [ ] Binary identity：可执行文件名、`--version` 输出格式、安装渠道
- [ ] 协议形态：stream-json / JSON-RPC / ACP / 私有 stdio / HTTP？
- [ ] 协议版本获取方式：`--help`、握手响应、schema 文件？
- [ ] Schema fingerprint 可计算吗（用于 §14.3.1 的 Capability Cache Key）

#### B. Session 生命周期

- [ ] 如何创建 Session：显式命令（如 `thread/start`、`session/new`）还是首个 prompt 隐式创建？
- [ ] Session Identity 以什么形式、在哪个事件/响应中返回？
- [ ] 如何 Resume：`--resume` / `session/load` / 其他？Resume 后历史如何呈现？
- [ ] 支持 Fork/Clone 吗（`--fork-session` 类能力）？→ 决定 §9.2 的 `native-history-clone` 可用性

#### C. Input / Output 通道

- [ ] User input 投递方式：stdin prompt、JSON-RPC method、文件？
- [ ] 支持 image/attachment 输入吗？格式？
- [ ] Output event 流格式：NDJSON event 类型清单、thinking/tool/error 各如何表达？

#### D. ACK 语义（最重要，逐条实测）

- [ ] **Input ACK**：投递后有 request-response 确认吗？有 echo 吗（如 Claude `--replay-user-messages`）？还是只能等第一个合法 event（弱 ACK）？
- [ ] **Run Started**：有显式 started 事件，还是只能从第一个 assistant/tool event 推断？
- [ ] **Terminal**：有显式 completed/result 事件吗？Process Exit 与 Terminal 冲突时哪个为准？
- [ ] **Pending Probe**：投递后 ACK 丢失时，能按 client-supplied id 或 native history 查询"刚才的输入到底进没进去"吗？
- [ ] **Cancel**：能取消一个已投递但未确认的 delivery 吗？取消有 ACK 吗？（→ `pendingCancel` 枚举）

#### E. History 能力

- [ ] 支持 arbitrary history import 吗（如 Codex `thread/inject_items`）？支持哪些 item 类型？可 read-back 验证吗？重复注入行为？
- [ ] History 存储在哪：vendor file 路径、格式（JSONL/SQLite/其他）、append-only 吗？→ 决定 L3 的 NativeHistoryReader 可行性
- [ ] History 里有 stable cursor 吗（byte offset / line number / entry id）？

#### F. Provider / Model / 配置

- [ ] Provider 配置机制：env、config file、CLI flag？支持多套并行配置吗（同一 CLI 两个 Provider 进程隔离）？
- [ ] Model 列表获取方式：CLI 命令、API、静态？
- [ ] Reasoning/thinking 配置入口？
- [ ] MCP / tools 支持矩阵

#### G. Usage 报告

- [ ] 有 usage/token 统计输出吗？per-turn 还是累计？有稳定 subject id 吗？（→ 基石设计 §14.2.1 Usage Fact 的 `reportSubjectId` 来源）

### 2.2 Spike 产出物

一份落档到 `docs/research/` 的 capability matrix（参照基石设计 §14.3.2 的表格格式），必须包含：

```text
| 维度 | 实测结论 | 证据 | 对应 RuntimeCapabilities 字段 |
```

外加一个明确的分档结论：**本 CLI 首期目标档位（L0/L1/L2）+ 理由**。这份文档是后续 Adapter 的唯一事实来源——Adapter 里出现的每一个能力假设，都必须能指回 Spike 证据。

---

## 三、接入实施：七步落地

以下步骤按依赖排序。每一步都标注了"不做什么"——接入新 CLI 的常见错误大多是做了不该做的事。

### Step 1：注册 EngineType（TS + Rust 双侧）

触碰点：

- `src/types/engine.ts`：新增 Engine variant
- `src-tauri/src/engine/mod.rs`：新增对应枚举 variant

注意事项：

- Rust 的 exhaustive match 会强制编译器列出所有集成点——**这是免费的接入点清单**，逐个过一遍，每一处决定"新 CLI 在此处的行为"，不要随手 `_ => unreachable!()`。
- 序列化兼容：Engine 在 DB/JSONL 中以字符串存储。新增 variant 后，用存量 fixture 跑一次反序列化回归（老数据不含新值，但必须确认 forward compatibility：旧版本 mossx 读到新 engine 字符串时的行为是 typed unknown，不是 panic）。
- **不做**：不为新 CLI 修改任何存量 variant 的行为。

### Step 2：Provider Profile 与 Runtime 隔离

按基石设计 §10：

- 新 CLI 的 Provider Profile 是**配置数据**（endpoint/auth/model catalog），不是代码。
- Runtime Owner key = `Workspace Owner + Engine + Provider Profile`。同一 CLI 两个 Provider 必须有独立的 Process/env/CLI Home——接入时用两个 Provider 并行各发一个 Turn 验证隔离（§17.2 矩阵）。
- Credential resolution 遵守 `Turn explicit managed binding > Session persisted managed binding > explicit local/default`（§10.3），managed binding 存在时禁止 ambient env 静默接管。

### Step 3：实现 RuntimeDeliveryAdapter（核心工作）

实现基石设计 §14.3.1 的统一接口。逐方法说明：

```typescript
interface RuntimeDeliveryAdapter {
  probeCapabilities(runtime: RuntimeIdentity): Promise<RuntimeCapabilities>;
  importContext?(request: ContextImportRequest): Promise<ContextImportAck>;      // L2 才实现
  sendTurn(request: NativeTurnRequest): Promise<NativeTurnAck>;
  cancelPendingDelivery?(request: PendingDeliveryCancelRequest): Promise<PendingDeliveryCancelAck>; // 有真实取消能力才实现
  probePendingDelivery(request: PendingDeliveryProbe): Promise<DeliveryProbeResult>;
}
```

**`probeCapabilities`**：返回 Spike 实测的能力画像。Cache Key 必须含 `Engine + binary identity + binary version + protocol/schema fingerprint`；CLI 升级后重新 Probe。诚实地填——`"none"` 和 `"weak"` 是合法答案，填高了会导致内核给出用户看不到的虚假保证。

**`sendTurn`**：投递 user input，返回该 CLI 协议下最强证据的 ACK：

| Spike 结论 | `inputAck` 填法 | ACK 实现 |
|---|---|---|
| 有 request-response（如 JSON-RPC 200 + turn id） | `"request-response"` | response 成功 + 拿到 native turn identity 才算 ACK |
| 有 echo（如 Claude replay） | `"echo"` | echo 内容与 `clientTurnId`/checksum 匹配才算 ACK |
| 只有第一个合法 event | `"first-event"` | 明确标记弱语义，文档与 UI 不假装 exactly-once |
| 什么都没有 | `"none"` | 只能配合强 `pendingProbe` 使用，否则该 CLI 不进 Shared V2 |

**`probePendingDelivery`**：ACK 丢失/不确定时的定性手段。按 Spike 的 D-Pending 项实现：能按 client id 查就 `by-client-id`，只能翻 native history 就 `by-native-history`，都不行就 `"none"`——`"none"` 意味着 ACK ambiguous 时只能进 `recovery-required` 等人工，**这是合法但要在接入文档里写明的降级**。

**`importContext`（可选，L2）**：仅当 Spike 证明有官方 history import（非手改 vendor file——红线 21）时实现。调用前做 item validation；成功后必须能 read-back 或依赖协议 response 语义。

**`cancelPendingDelivery`（可选）**：有真实取消语义才实现；没有就不要实现该方法，`pendingCancel: "none"` 会让 UI 自动禁用 Cancel 并解释原因（§14.5.2）。

**禁止事项**（对应红线 26）：

- 不得把 process spawned、stdin write success、first token 当作 ACK 返回；
- 不得为了让 matrix 好看而上报未实测的能力；
- 不得在 Adapter 内做自动重试/自动 failover（重试决策属于内核 + 用户，§8.4、§14.5.5）。

### Step 4：事件归一（MossxAgentEvent Ingress）

新 CLI 的 native event 流要归一到 mossx 事件面（基石设计 §3.5）：

- 映射到 `run:start / turn:start / message:delta / tool:start|update|end / turn:end / run:settled` 最小事件面；
- **不改** `MossxAgentEvent` 的既有 event meaning（红线 32）——新事件类型用 additive envelope 扩展；
- 关键义务：保证 **Terminal 边界可判定**。Assembler（A2.3）依赖 authoritative final snapshot 组装 `turnCommitted`；如果新 CLI 的 Terminal 只能靠 process-exit 推断，要在 capability 里如实标 `terminal: "process-exit"`，并确保 exit 前的 final state 可完整读取；
- streaming delta 走既有 `liveAssistantTextChannel` 外部化通道（红线 35），不为新 CLI 开第二条 delta 路径。

### Step 5：ContextCompiler 对接（通常零代码）

这是 capability-driven 设计的红利：**新 CLI 接入时 ContextCompiler 原则上不改代码**。

- Compiler 按 Spike 的能力谓词自动选择 Projection Mode（§9.2）：
  - 无 import 能力 → 新 Binding 自动走 `portable-transcript` 或 `checkpoint`；
  - 有 import/clone → 走 `native-history-import` / `native-history-clone`；
  - 恢复旧 Binding → 永远 `native-delta`。
- 要做的只有两件事：
  1. **Compatibility Matrix 加行列**：在 source×target 自动化测试矩阵中把新 CLI 加为新 source 和新 target（§17.5），覆盖 thinking / tool-id / image / aborted turn / control message 五类事实；
  2. **确认 transcript 序列化安全**：如果新 CLI 的 prompt 通道对特殊字符/长度有限制，在 Compatibility Transformer 的目标侧加对应 transformation 规则，并在 `ProjectionManifest` 记录。

### Step 6：UI 注册（数据驱动，改动极小）

- Engine 显示名、图标、Picker 选项：按现有 Engine registry 增加配置项；
- Shared Target Picker：注册 Provider Profile loader 与
  `getEngineModels(engine, { providerProfileId })` catalog；选择必须一次性产出完整
  `engine + providerProfileId + model`，禁止按 Model ID 反推 Provider；
- 未通过 target acceptance 的新 CLI 仍应出现在 Picker 中，但必须 disabled 并显示
  capability reason；不能静默隐藏或 fallback；
- local/disk profile sentinel 只用于读取配置，进入 Shared `ExecutionTarget` 前归一为
  `providerProfileId = null`；
- Sidebar 标签、Turn Badge：自动从新 Engine 的 `TurnExecutionSnapshot` 派生，无需专门开发；
- i18n：新 Engine 名称加入 locale registry；
- **不做**：不为新 CLI 加任何"特殊 UI 逻辑"。如果觉得需要，先停下来检查是不是 capability 建模错了——UI 只读 capability 和 snapshot。

### Step 7：NativeHistoryReader（可选，L3，随时后置）

仅当需要为该 CLI 解锁 Provider Continuation 时做（Change D 范围）：

- 实现 §9.1.1 的只读接口：`probe` 报告 `readable / stableCursor / currentThroughCursor / supportedEntryTypes`；`read` 输出 canonical-shaped `ContextSourceEntry`；
- 硬约束：不修改 vendor history file（红线 21/37）；无 stable cursor 时 `stableCursor = false` → Continuation 对该 CLI typed unsupported、fail closed，**这是合法终点**；
- 在分配完整 buffer 前检查 file byte limit；blocking file read 必须移出 async runtime worker；
- portable block 必须 allowlist。private reasoning/signature、encrypted/redacted、unknown
  block 不透传；Tool Call/Result 必须成对保留或成对 omission；
- Reader 输出不进 Shared Event Log，只供 ContextCompiler。

---

## 四、测试要求（不可裁剪）

新 Adapter 必须通过基石设计 §14.3.5 的统一 Contract Test Suite，一项都不能少：

| # | 测试 | 验证什么 |
|---|---|---|
| 1 | request accepted / rejected | 基本投递语义 |
| 2 | accepted 后 connection drop | ACK 与现实的裂缝 → ambiguous 路径 |
| 3 | first event 前 crash | 弱 ACK CLI 的恢复定性 |
| 4 | duplicate Terminal | `turnCommitted` 幂等 |
| 5 | Resume 后 Probe | pendingDelivery 恢复 |
| 6 | Provider A/B 相同 Engine 并行 | Runtime 隔离不串线 |
| 7 | unsupported capability 降级 | transcript/checkpoint 自动兜底 |
| 8 | schema/version 变化 | 重新 Probe，不用旧能力解释新 binary |

另外两项接入级验收：

- **Fault injection**：复用 A1.5 的强杀测试台，在 Tx 2a（provisioning）/ Tx 3（delivery）/ Tx 4（ACK）/ Tx 5（commit）四个边界各杀一次，验证新 CLI 路径不丢输入、不重复投递、不盲建第二 Binding；
- **存量 fixture 回归**：跑 Claude/Codex/Kimi 的 golden fixtures 与 §17.6 矩阵，证明新 CLI 的接入对存量引擎零影响。

---

## 五、对存量系统的影响清单（预期：全零）

接入完成后，用这张表自证"零影响"：

- [ ] 存量 Engine 的事件含义、顺序、Terminal settlement 未变（红线 32）
- [ ] 存量 Shared 会话的 Canonical Entry、Cursor、Binding 状态未被触碰（新 CLI 只产生新 `bindingKey`）
- [ ] 存量 Native Session 不经过任何新代码路径（additive routing）
- [ ] `ConversationItem` / `threadItems.ts` / `liveAssistantTextChannel` 无改动（红线 31/34/35）
- [ ] 老 Shared 会话切到新 CLI Target 时：新 Binding lazy create，老 Binding 保留；切回时 `native-delta` 复用（§8.3）
- [ ] 新 CLI 的 weak ACK 没有污染全局 exactly-once 语义（降级显式可见）

---

## 六、完整示例：假设接入 Grok CLI

一个端到端的推演，展示各决策点如何使用本指南：

```text
Phase S Spike 实测（假想结论）:
  - 协议: stream-json over stdio，无 handshake 版本 → schema fingerprint 用 binary version 兜底
  - Session: 首个 prompt 隐式创建，session id 在 system init event 返回
  - Resume: --resume <id> 支持；无 fork/clone
  - Input ACK: 无 response、无 echo；第一个 assistant event 是唯一信号
  - Terminal: result event 存在；process exit 可兜底
  - Pending Probe: 无 client id 机制；可读 ~/.grok/sessions/*.jsonl（append-only）
  - History Import: 无
  - Usage: result event 含 per-turn tokens，有 turn id

→ 分档结论: L0+（prompt wrapper + first-event 弱 ACK + by-native-history probe）

落地:
  Step 1  EngineType += "grok"（编译器列出 14 处集成点，逐一处理）
  Step 2  provider profile: endpoint + api key env + model list command
  Step 3  GrokDeliveryAdapter:
            inputAck: "first-event"（弱，UI 不显示"已确认接收"强语义）
            pendingProbe: "by-native-history"（翻 jsonl 找 clientTurnId 水印）
            terminal: "explicit"（result event）
            historyImport: "none" → 不实现 importContext
            pendingCancel: "none" → 不实现 cancelPendingDelivery
  Step 4  event 映射: system init → run identity；assistant delta → message:delta；
          result → turn:end + run:settled
  Step 5  Compiler 零改动：新 Binding 自动 portable-transcript/checkpoint；
          Compatibility Matrix +grok 行列
  Step 6  registry + i18n + 图标
  Step 7  后置：grok 的 jsonl 有 line-number cursor → NativeHistoryReader 可做 L3

验收:
  - 8 项 Contract Tests 全过（其中 #2/#3 是 grok 这种弱 ACK 的重点）
  - Shared 会话 Claude → Grok → Claude：grok 走 checkpoint 降级（用户可见确认），
    切回 Claude 时 native-delta 只补增量
  - 存量 fixtures 全绿
```

---

## 七、常见反模式（接入时自我检查）

1. **"先接上跑起来，ACK 以后再说"** → 违反 Intent-before-side-effect；弱 ACK 可以，但没有 Probe 手段的 CLI 不能进 Shared V2。
2. **"它文档说支持 X"** → 文档不是证据，Spike 实测才是。填 capability 时引用 Spike 证据编号。
3. **"给它的 transcript 里塞多角色历史就当 history import"** → 那是 `portable-transcript`，user-channel transport，不宣称 lossless replay（§9.2 表格）。词不准会导致后续恢复语义全错。
4. **"手改它的 session 文件注入历史"** → 红线 21 禁止；只接受官方 import/fork/clone 协议。
5. **"为新 CLI 在内核加 if engine == 'grok'"** → 所有 Engine 特判必须收敛到 Adapter 或 capability predicate；内核出现 engine 分支即设计腐化信号。
6. **"顺便优化一下存量 Adapter"** → 接入 PR 只做 additive；存量行为变更独立成 Change。

---

## 八、索引

- 基石设计（契约与红线）：[`mossx-multi-cli-provider-session-foundation-design.md`](./mossx-multi-cli-provider-session-foundation-design.md)
  - §3.2 Provider/Protocol 正交 · §9.1.1 NativeHistoryReader · §9.2 五种 Projection Mode · §14.2 Canonical Turn Contract · §14.3 Capability/ACK Matrix · §19 设计红线
- 实施任务清单（Wave 0 Spike 模板来源）：[`../plans/2026-07-27-multi-cli-provider-session-foundation-task-checklist.md`](../plans/2026-07-27-multi-cli-provider-session-foundation-task-checklist.md)
- 现有 Adapter 参照实现：`src-tauri/src/engine/claude.rs`、`src-tauri/src/engine/kimi.rs`、`src-tauri/src/shared/codex_core.rs`
