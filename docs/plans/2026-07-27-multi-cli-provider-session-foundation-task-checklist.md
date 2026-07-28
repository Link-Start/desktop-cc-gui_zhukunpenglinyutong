# 多 CLI × 多 Provider 会话基石：实施任务清单

> 日期：2026-07-27
> 上游设计：[`docs/research/mossx-multi-cli-provider-session-foundation-design.md`](../research/mossx-multi-cli-provider-session-foundation-design.md)（Implementation-ready）
> 用途：照着执行的 Checklist。完成一项勾一项；每个 Wave 收尾必须过对应的 Gate，不过 Gate 不进下一 Wave。

## Change A 当前结论（2026-07-27 校准）

Change A 是 Phase 1 dark launch 的验证链路：

```text
synthetic Runtime fixtures + V0 authoritative final evidence mirror
  → isolated Shadow Canonical Log
  → Shadow Projection / Legacy dual-read comparison
```

| Wave | OpenSpec change | 任务进度 | Gate | 结论 |
|---|---|---:|---|---|
| Wave 1 / A1 | `establish-shared-event-storage` | 12/12 | Gate 1 ✅ | 已完成，可作为 durable storage 基座 |
| Wave 2 / A2 | `assemble-shared-canonical-facts` | 17/17 | Gate 2 ✅ | synthetic fixtures + V0 final-evidence Shadow ingress 已闭环 |
| Wave 3 / A3 | `project-shared-canonical-conversation` | 27/27 | Gate 3 ✅ | Shadow Projection、V0 fallback 与 render gate 已闭环 |
| **Change A 总计** | 三个 change | **56/56** | **已通过** | **Change A 完成** |

OpenSpec 已归档至 `openspec/changes/archive/2026-07-27-{establish-shared-event-storage,assemble-shared-canonical-facts,project-shared-canonical-conversation}/`，主 specs 已同步。

### Change B 准入决策

- **允许进入 Change B**。Phase 1 Gate 1–3 已完成，下一步可创建
  `compose-shared-session-execution-target` implementation task。
- **真实流量边界**：run identity durable association、真实 `run.settled` ACK gate 与
  V0→V2 Send 写路径切换从现在起在 Change B 实现，不回填到已关闭的 dark-launch Change A。

### Change A 收口顺序

1. **A2 evidence closure**：V0 final-evidence mirror、Usage precedence、synthetic fault tests。
2. **A3 read-path closure**：Tauri IPC、feature-flagged Shared DataSource、V0 fallback。
3. **A3 render closure**：Native golden、target switch no-remount、后台 Binding no-render-storm。
4. **Change B kickoff**：创建 proposal/design/task，承接真实 Runtime/Send/Binding 状态机。

## 图例

| 标记 | 含义 |
|---|---|
| `⫽` | 可与同 Wave 内其他 `⫽` 任务并行 |
| `→` | 严格串行，必须等上一项完成 |
| `⛔ Gate` | 阶段门禁：全部满足才能进入下一 Wave |
| 体量 | S < 1 天；M = 数天；L ≈ 1 周；XL = 跨周 |

体量只是相对风险参考，不是排期承诺。

---

## Wave 0：契约与调研（全部可并行，无产品代码）

| # | 任务 | 大白话说明 | 改变点 | UI 变化 | 并行 | 前置 | 验收 | 体量 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| T0.1 | Canonical Fact JSON Schema 落 OpenSpec：`turnRequested` / `context.deliveryPrepared` / `context.deliveryAccepted` / `turnAccepted` / `turnCommitted` / `usageRecorded` / `usageAggregateRecorded` / `controlFact` | 先规定所有 CLI 都要说同一种“会话事实语言”。 | 从各家事件各说各话，变成一套可校验的统一字段。 | 无；只有规范变化。 | ⫽ | 无 | Schema 文件 + `openspec validate` 通过 | M | ✅ 已完成 |
| T0.2 | 领域契约 artifacts：ExecutionTarget / TurnExecutionSnapshot / SessionOrigin / ConversationFamilyRef / BindingKey 规则 / BindingContextCursor / BindingProvisioningState / NativeHistoryReader / NativeHistoryMaterialization / Legacy fidelity | 把“这轮发给谁、绑定谁、历史从哪来”这些概念先定义清楚。 | 从隐含约定变成可检查的领域 contract。 | 无；为后续 UI 和 backend 打底。 | ⫽ | 无 | 设计文档 §Phase 0 验收 6 条 | M | ✅ 已完成 |
| T0.3 | **S1 Spike**：Codex `thread/inject_items`——支持 Item 类型、持久化、read-back、duplicate 行为、`clientUserMessageId` 关联 | 实测 Codex 能不能安全接收外部历史，避免凭文档猜。 | 得到 Codex history import 的真实能力和限制。 | 无；仅调研证据。 | ⫽ | 无 | 实测 capability matrix 落档 | M | ✅ 已完成 |
| T0.4 | **S2 Spike**：Claude `--replay-user-messages`——echo 格式、checksum 关联、`result` 与 process-exit 冲突定性 | 实测 Claude 收到历史后怎样确认，失败时信谁。 | 得到可用的 ACK 判断规则。 | 无；仅调研证据。 | ⫽ | 无 | 实测 ACK contract 落档 | S | ✅ 已完成 |
| T0.5 | **S3 Spike**：Kimi ACP——initialize capability、`session/load` replay、prompt lifecycle、Provider config 边界 | 实测 Kimi 是否能加载旧会话、怎样结束一轮。 | 得到 Kimi ACP 的 go/no-go 与降级边界。 | 无；仅调研证据。 | ⫽ | 无 | 实测 matrix + ACP go/no-go 结论 | M | ✅ 已完成 |
| T0.6 | Native golden fixtures：Claude/Codex 代表性 History + Live Event fixtures | 保存一批标准样本，后续改代码就拿它们做对照。 | 从人工印象回归变成固定 fixture 回归。 | 无；测试资产。 | ⫽ | 无 | fixtures 入库、可重复加载 | M | ✅ 已完成 |

**⛔ Gate 0**（2026-07-27 完成，commit `d807d8e9e`，见 `openspec/changes/establish-session-foundation-contracts/`）
- [x] 三个 Spike 产出实测 matrix，后续 Adapter contract 不以 CLI 文案或假设为依据（结论与降级约束见该 change design.md §5.1）
- [x] Phase 0 全部契约 artifact 通过评审（proposal/design/specs/schemas + validate.mjs 14/14 PASS + fixtures loader 6/6 passed + `openspec validate --strict` valid）

---

## Wave 1：Change A1 — establish-shared-event-storage

| # | 任务 | 大白话说明 | 改变点 | UI 变化 | 顺序 | 前置 | 验收 | 体量 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| A1.1 | SQLite WAL schema + migration 框架（`shared_sessions_v2` / `shared_event_log` / `shared_binding_state` / `shared_projection_checkpoint` / `shared_legacy_import` / `provider_usage_aggregate_log`） | 给 Shared Session V2 建一个可靠数据库地基。 | 从 V0 文件快照扩展为事件、绑定、投影、旧数据和 Usage 六类持久化表。 | 无；dark launch backend。 | → | Gate 0（T0.1） | schema 契约 7 条保留项 | M | ✅ 已完成 |
| A1.2 | `SharedEventWriter`：单 Writer Actor、唯一 sequence allocator、event insert + `next_sequence` 同一 transaction | 所有事件排一个队写，避免并发抢号和半写入。 | 从多入口写入风险变成单 Writer + transaction。 | 无；dark launch backend。 | → | A1.1 | 并发写不冲突、重放幂等 | M | ✅ 已完成 |
| A1.3 | Unique constraints + `dedupe_key`（usage 例外路径） | 同一件事来 100 次也只记一次。 | 增加数据库唯一约束和业务去重键。 | 无；dark launch backend。 | ⫽ | A1.2 | 100 次重复写同一 event/attempt 不产生重复 Fact | S | ✅ 已完成 |
| A1.4 | Provider Usage Ledger writer（Provider+Window+subject+revision 幂等） | Provider 总用量单独记账，不硬塞给某个 Session。 | 新增可修订、可 supersede 的独立 Usage Ledger。 | 无；以后 Usage UI 可间接受益。 | ⫽ | A1.2 | supersede 链正确；不伪造 `session_id` | S | ✅ 已完成 |
| A1.5 | Crash/power-loss 测试台：每个 Tx 边界强杀 + fsync 前后注入 | 故意在写库中途杀进程，证明不会留下半条数据。 | 从“理论安全”变成 fault-injection 实证。 | 无；测试门禁。 | → | A1.3、A1.4 | all-or-nothing；重启结果正确 | L | ✅ 已完成 |
| A1.6 | 启动恢复：bounded `quick_check`、integrity failure → read-only recovery、不建空库覆盖 | 启动时发现库坏了就保护现场，不拿空库覆盖。 | 增加 bounded 检查和只读恢复模式。 | 间接影响；故障时产品保住旧数据，暂无专用 UI。 | ⫽ | A1.5 | §14.4.8 验收全量 | M | ✅ 已完成 |

**⛔ Gate 1（A1 独立验收）**（2026-07-27 完成，commit `dca0882fe`）
- [x] 无 UI、无 Runtime Adapter 条件下证明：sequence 单调、事务 all-or-nothing、重启正确、Ledger 幂等
- [x] OpenSpec Change A1 `openspec validate --strict` 通过

---

## Wave 2：Change A2 — assemble-shared-canonical-facts

> 2026-07-27 收口：依据上游设计 §Phase 1，A2 仅消费 synthetic fixtures 与
> V0 authoritative final-evidence read-only mirror。真实 Runtime ingress/ACK 属于 Change B。

| # | 任务 | 大白话说明 | 改变点 | UI 变化 | 顺序 | 前置 | 验收 | 体量 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| A2.1 | Canonical Fact 类型 + payload 校验（对接 T0.1 Schema） | 真正实现统一事实类型，脏数据不许进库。 | 从纸面 Schema 变成 Rust type + validator。 | 无；dark launch backend。 | → | Gate 1 | 非法 payload 拒绝落盘 | M | ✅ 已完成 |
| A2.2 | run identity → Snapshot/Binding durable 关联 | 规定一轮运行怎样认领自己的快照和 Binding。 | contract 已固定；真实 runtime 关联留给 Change B。 | 无；当前只完成 contract。 | → | A2.1 | Change A 固化 contract；真实关联由 Change B 接入 | M | ✅ contract 完成 |
| A2.3 | Run/Turn Assembler：从 authoritative final snapshot contract 组装 | streaming 中间包丢了，也能靠最终快照拼出完整一轮。 | 从依赖 delta 变成以 authoritative final snapshot 为准。 | 无；dark launch backend。 | → | A2.2 + S1/S2 结论 | synthetic normal/delta lane 全丢仍产出完整 Final | L | ✅ 已完成 |
| A2.4 | Critical Commit Sink contract + 幂等 ACK | 最终结果只有安全落盘后才算提交成功。 | 增加 critical sink 和重复 Terminal 去重规则。 | 无；Change A 仅 synthetic 验证。 | → | A2.3 | synthetic duplicate Terminal 幂等 | M | ✅ 已完成 |
| A2.5 | Atomic Tool Exchange 配对验证（incomplete/error 显式结算） | Tool Call 没有 Result 时不能假装成功。 | Tool Call/Result 必须配对，残缺项明确标 incomplete/error。 | 间接影响；未来 UI 能正确显示失败工具，当前无产品变化。 | ⫽ | A2.3 | 未配对 Tool Call 不落盘为成功 | M | ✅ 已完成 |
| A2.6 | Usage normalization：revision/supersedes 校验、Turn Fact 与 Aggregate Ledger 分流 | Token 用量去重、修订，并分清单轮用量和 Provider 总量。 | provider-report 优先于 runtime-final，二者不相加。 | 间接影响；未来 Usage 展示更准，当前无产品变化。 | ⫽ | A2.4 | 重放不重复计费；aggregate-only 不猜分摊 | M | ✅ 已完成 |
| A2.7 | V0 final-evidence read-only mirror → 隔离 Shadow Canonical Log | 真实产品仍走 V0，但最终结果偷偷复制到新链路验算。 | 新增只读 mirror；不回写 V0、不接管 Send。 | 无；dark launch，仅后台 Shadow 数据。 | ⫽ | A2.4 | 不回写产品状态 | M | ✅ 已完成 |
| A2.8 | （可选）read-only Event Log Inspector，feature flag / dev build 隔离 | 原计划做开发者事件查看器，方便直接检查 Shadow Log。 | 未做独立 Inspector；Wave 3 只补了 read command 和测试开关。 | 仅开发者可见；独立面板仍未实现。 | ⫽ | A2.1 | 写操作与生产默认入口不可达 | S | ⏭️ 推迟到 Wave 3 |

**⛔ Gate 2（A2 独立验收，已完成）**
- [x] synthetic authoritative final snapshot：duplicate Terminal、dropped delta、failed/cancelled/replaced、Usage 分流正确
- [x] V0 authoritative final evidence 只读镜像到隔离 Shadow Log；不改变真实 Send/V0 产品状态

---

## Wave 3：Change A3 — project-shared-canonical-conversation

> 2026-07-27 收口：Shadow Log read commands、feature-flagged DataSource、Legacy fallback
> 与 render regression gates 已接入；flag 默认关闭，Shared 产品行为仍保持 V0。

| # | 任务 | 大白话说明 | 改变点 | UI 变化 | 顺序 | 前置 | 验收 | 体量 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| A3.1 | UI Projection：Canonical Fact → 幕布兼容 `ConversationItem`（单向，不回写） | 把统一事实翻译成现有聊天幕布看得懂的数据。 | 新增 Shared 专用 DataSource，和 Native 路径隔离。 | 仅测试开关开启时可见；正常显示应与 V0 一致。 | → | Gate 2 | Shared/Native 双 DataSource 隔离成立 | L | ✅ 已完成 |
| A3.2 | Projection checkpoint + rebuild（`projectionVersion + throughSequence`） | 不必每次从头算；缓存坏了又能完整重建。 | 新增增量 checkpoint 和 deterministic rebuild。 | 无直接变化；影响加载速度和恢复可靠性。 | ⫽ | A3.1 | 删除 Projection 后重建，item count/order/type/checksum 一致 | M | ✅ 已完成 |
| A3.3 | Legacy snapshot dual-read reader（`fidelity = "presentation-only"`，不伪造 Tool ID/Signature/Target） | 老 Shared 会话照样能看，但缺什么就承认缺什么。 | 新链路可读取 V0 snapshot，且不伪造协议字段。 | 间接影响；旧会话继续正常显示。 | ⫽ | A3.1 | 旧 Shared 会话可读、可继续，旧文件不改写 | M | ✅ 已完成 |
| A3.4 | Shadow Projection vs Legacy dual-read 对比器（只记录 mismatch，不反向写） | 同一会话用新旧两套读法算一遍，找出差异。 | 新增 mismatch 分类报告，不自动修数据。 | 仅开发者可见；产品 UI 不展示报告。 | → | A3.2、A3.3 | 对比报告产出 | M | ✅ 已完成 |
| A3.5 | Canvas 防回归门禁：Native/Shared Projection 隔离 + golden fixtures 回归 | 证明切新数据源不会把聊天界面弄闪、弄空或拖慢。 | 增加 Native golden、Shared render、no-remount、no-render-storm 门禁。 | 无设计变化；保证现有 UI 行为不回退。 | → | A3.4 + T0.6 | §17.6 定向门禁通过 | L | ✅ 已完成 |

**⛔ Gate 3（A3 独立验收 + dark launch 闭环，已完成）**
- [x] Shadow 链路仅镜像 terminal V0 evidence；Projection 不作为 ingress
- [x] Native golden regression 保持通过，Shared flag 关闭不查询 V2
- [x] 同一 Shared session 切换 target 不 remount/flicker
- [x] Shared 后台 Binding 更新不命中 Canvas selector，无持续 render storm

---

## Wave 4：Change B — compose-shared-session-execution-target

> **当前状态：已完成（2026-07-28），Gate 4 已恢复。** review 识别出的生产接线缺口
> 已补齐：Composer 四级选择即时写 `selectedNextTarget`；历史 Badge 只读 immutable
> snapshot；schemaVersion 2、managed Provider/Model availability、typed prompt ACK、
> Claude/Codex 真实 terminal、native Probe、provider-scoped Interrupt、真实 degraded
> context 与 capability-driven Cancel 均已接线。Gate 4 由 UI/runtime/storage 增量测试
> 分层闭环；Desktop 人工点击矩阵保留为发布前 smoke，不阻塞 Change C 开工。

| # | 任务 | 大白话说明 | 改变点 | UI 变化 | 顺序 | 前置 | 验收 | 体量 |
|---|---|---|---|---|---|---|---|---|
| B.1 | `selectedNextTarget` / `activeTurnTarget` Store 分离 + 四级 Picker（CLI→Provider→Model→Reasoning） | 让用户选择“下一轮发给哪个 CLI、Provider、Model、Reasoning”。 | 复用现有 Composer 四级控件；选择只改下一轮 Target，历史/进行中 Badge 只读快照。 | **有**：消息上方显示真实执行 Target Badge。 | ⫽ | Gate 3 | Picker 变化不改写历史 Turn Badge | M |
| B.2 | `bindingsByEngine` → `bindingsByTarget` 迁移（旧 Binding 归 default-provider，不猜 managed Provider） | 同一个 CLI 下不同 Provider 各自保存自己的隐藏会话绑定。 | 显式写入 `schemaVersion: 2`；旧 binding 只迁为 local/default，新 Provider 不靠猜。 | 间接影响：用户仍看一个 Shared Row，切 Provider 时复用对应会话。 | ⫽ | Gate 3 | 旧会话按 local/default 语义恢复 | M |
| B.3 | Send 全链路：`providerProfileId` 贯通 + Tx1 snapshot 固化 + **V0→V2 真实写路径切换** | 真正把用户发送的消息接入 V2 事件链路。 | typed prompt ACK 后写 accepted；Claude 阻塞 settled、Codex realtime terminal 后才写 committed；失败不换 Provider。 | **有**：V2 flag 开启后状态条和 Badge 可见；仍可关 flag 回滚。 | → | B.1、B.2 | dark launch 结束；Shared 真实流量跑 V2 | L |
| B.4 | Durable Binding Provisioning + duplicate-create recovery（ACK 不确定 → recovery-required，禁止盲建） | 创建 Provider 会话时即使崩溃，也不能偷偷多建一个。 | prepared→creating→ready/recovery 全程落盘；Probe 查询真实 Claude/Codex runtime；强杀测试守住 duplicate-create。 | 异常时可见：展示恢复中/需要处理，而不是创建重复会话。 | → | B.3 + S1/S2/S3 结论 | 强杀不产生第二个同 Target Binding | L |
| B.5 | Target-aware owner routing：Interrupt / Approval / Pending Rebind / Recovery 携带完整 Owner | 停止、审批和恢复操作必须发给真正执行这一轮的 Provider。 | Shared Claude Interrupt 现在携带 active provider；Desktop/daemon 都按 provider session 精确路由。 | 间接影响：按钮外观不变，但不会停错 Provider。 | ⫽ | B.3 | 同 Engine 双 Provider 并行不串线 | L |
| B.6 | UI 状态机落地：9 状态 + `CancelPending` + degraded-context 用户确认 | 把准备、发送、取消、恢复、上下文降级等状态明确告诉用户。 | 真实 bounded-delta omissions 进入确认 UI；Cancel 由 adapter capability 决定，当前不支持时明确禁用。 | **有**：降级详情、确认/取消、recovery 与 unavailable 状态可见。 | ⫽ | B.3 | §14.5.6 UX 验收全量 | M |

**⛔ Gate 4（Phase 2 验收矩阵）**
- [x] `Claude/Official → Claude/OpenRouter → Codex/OpenAI → Claude/Official`：一个 Sidebar Row、三个 Hidden Binding、切回复用原 Binding、Turn Provenance 正确、任一 Provider 失败不重路由。Rust matrix、Composer/Badge component tests、Codex realtime terminal owner test 与失败语义测试共同提供 Gate 4 证据。

---

## Wave 5：Change C — add-shared-context-compiler

| # | 任务 | 大白话说明 | 改变点 | UI 变化 | 顺序 | 前置 | 验收 | 体量 |
|---|---|---|---|---|---|---|---|---|
| C.1 | Versioned ContextPackage + ProjectionManifest（`cursorSemantics` / `disposition` / `ContextCompressionReport`） | 给跨 Provider 搬运的上下文做一个带清单、版本和校验码的包。 | 从临时拼文本变成可审计 ContextPackage + Manifest。 | 无直接变化；为后续上下文状态 UI 提供事实。 | → | Gate 4 | Manifest 记录全部 transformation/omission/checksum；Package 携带实测 compression report（sourceTokens/packageTokens/perType） | M |
| C.2 | ContextCompiler 核心：五 mode + capability predicate + 固定优先级链（native-delta > import > clone > transcript > checkpoint） | 根据目标 Provider 真正支持什么，选择最可靠的历史交付方式。 | 从按 Engine 猜策略变成 capability-driven 五模式编译。 | 间接影响：切 Provider 时上下文连续性更可靠。 | → | C.1 | 不按 Engine 名硬编码假设 | L |
| C.3 | pi-ai 式 Compatibility Transformer（thinking / tool-id / tool-result / image / aborted 清理） | 把来源 Provider 的消息格式安全翻译成目标 Provider 能接受的格式。 | 统一清理 thinking、tool、image、aborted 等不兼容内容。 | 间接影响：减少切 Provider 后的乱码、断链和工具错误。 | → | C.2 | source×target matrix 自动化 | XL |
| C.4 | Codex `native-history-import` Adapter（按 S1 实测） | 按实测协议把编译后的历史交给 Codex。 | 新增 Codex native import，并以 JSON-RPC success 作为接受证据。 | 状态可见：导入失败时不能伪装成功。 | ⫽ | C.3 | JSON-RPC success 才推进 context accepted | L |
| C.5 | Claude echo ACK + transcript/checkpoint 投影（按 S2 实测） | 只有 Claude 回显的校验码对得上，才认为上下文送到了。 | 新增 echo checksum ACK 与 transcript/checkpoint 降级投影。 | 状态可见：上下文接受/失败/降级提示。 | ⫽ | C.3 | echo checksum 匹配才记 `turnAccepted` | M |
| C.6 | Kimi ACP Adapter 或 `ackFidelity = weak` 显式标记（按 S3 实测） | Kimi 能强确认就强确认，不能就老实标成弱确认。 | 新增 ACP adapter 或 weak ACK fidelity，不假装 exactly-once。 | 状态可见：弱确认/不确定状态需要明确提示。 | ⫽ | C.3 | 不假装 exactly-once | M |
| C.7 | Two-phase cursor + pendingDelivery recovery（accepted/committed 分离推进；native-delta 排除目标 Binding 原生 Entries） | 分开记录“目标已收到”和“本轮已完成”，崩溃后从正确位置继续。 | cursor 从单阶段升级为 accepted/committed 两阶段，并持久化 pending delivery。 | 异常时可见：恢复进度准确，不重复灌历史。 | → | C.4–C.6 至少其一 | compile/accept/commit 三类失败边界幂等 | L |
| C.8 | Artifact Store（临时文件 + 原子 rename + GC 识别）+ Progressive Retrieval Host Tool | 大上下文先存成安全 artifact，需要时再逐步取，不全塞进 prompt。 | 新增原子 artifact store、垃圾识别和检索工具。 | **有**：可能显示可检索引用；普通短会话无变化。 | ⫽ | C.7 | 悬空引用可识别；检索结果标记 reference context；检索仅由目标经 Host Tool 显式发起，不自动回填 omitted 内容 | L |
| C.9 | Structured Checkpoint 增量编译 + Omissions 可见 + 用户确认降级 | 上下文太大时生成结构化 checkpoint，并告诉用户省略了什么。 | 新增增量 checkpoint、omission 清单和降级确认 gate。 | **有**：展示省略项；未经确认不发送降级 Context。 | ⫽ | C.7 | 未经确认不发送降级 Context | M |
| C.10 | 分类型确定性压缩 + Context Package 前缀稳定性（模式参考 Headroom，不引入其 ML 模型） | 不再按字符数平切上下文：按内容类型折叠，且增量包不重写已稳定的头部。 | 压缩从 4000 字符平切升级为按类型确定性折叠；同一 Binding 连续 handoff 前缀字节级稳定，只尾部追加 delta。 | **有**：degraded-context 详情可展示 before/after token 与省略明细。 | → | C.1 + C.9 | 前缀稳定性有测试；折叠全部计入 `ProjectionManifest.omitted` | M |

**⛔ Gate 5（Phase 3 验收）**
- [ ] 长会话切换不依赖固定 8 Turn；Tool Call/Result 成对保留或成对省略
- [ ] 同一 Binding 不重复注入其已有历史；checkpoint 遗漏只按 `retrievableRef` 检索，不自动补发
- [ ] 同一 Binding 连续 handoff 的 Package 前缀字节级稳定；分类型折叠全部计入 `ProjectionManifest.omitted`
- [ ] §17.5 source×target 验收矩阵通过

---

## Wave 6：Change D — add-native-provider-continuation

| # | 任务 | 大白话说明 | 改变点 | UI 变化 | 顺序 | 前置 | 验收 | 体量 |
|---|---|---|---|---|---|---|---|---|
| D.1 | NativeHistoryReader × 3：Claude session JSONL / Codex rollout / Kimi 公开 surface | 安全读取三家 CLI 自己保存的原生历史。 | 为 Claude/Codex/Kimi 建统一 reader contract；游标不稳定就拒绝续接。 | 无直接变化；失败时需要可解释 unsupported。 | ⫽ | Gate 5（可与 C 后期重叠启动，只依赖 T0.2 contract） | `stableCursor=false` 时 typed unsupported、fail closed | L |
| D.2 | NativeHistoryMaterialization 持久化：fingerprint/cursor/checksum，Retry 复用不重读漂移来源 | 第一次读取后冻结一份可校验材料，重试不再读取可能变化的源文件。 | 新增 fingerprint/cursor/checksum materialization。 | 无直接变化；提高续接重试一致性。 | → | D.1 | materialization 后可审计、可重放 | M |
| D.3 | Continuation 创建流：入口 → package 编译 → 新 Native Session + 新 Provider Binding | 从旧 Native Session 的历史创建一个新 Provider 会话继续聊。 | 新增 Continuation 流程；来源 Session 保持不变。 | **有**：新增“用其他 Provider 续接”入口和创建反馈。 | → | D.2 + C.2 | 原 Session 不变、不改写、不自动归档 | M |
| D.4 | `provider-continuation` Origin + Conversation Family 继承 + `供应商续接` 标签 + 查看来源导航 | 让新会话明确显示自己从哪续过来，但不要冒充子代理。 | 新会话继承 family，记录 lineage parent 和 continuation origin。 | **有**：顶层 Session 显示“供应商续接”标签和来源导航。 | → | D.3 | §17.1 矩阵；不写 `parentThreadId`、不显示 `子代理` | M |

**⛔ Gate 6（Phase 4 验收）**
- [ ] 新 Session 顶层显示、Provider Profile 不同、`familyId` 继承、`lineageParentSessionId` 指向来源
- [ ] 删除来源 Session 不级联删除 Continuation；来源 Native History 不写入 Shared Event Log

---

## 远期（Wave 5 稳定后再细化，当前不展开）

| 阶段 | 任务 | 大白话说明 | 改变点 | UI 变化 | 状态 |
|---|---|---|---|---|---|
| Phase 5 | Orchestration Foundation：Orchestrator Projection 只消费 A2 Canonical Fact，不建第二条 authoritative Sink；`steer / followUp / nextTurn` | 让多个 Agent 能围绕同一份会话事实协作，不再复制第二套真相。 | 在 Canonical Fact 之上增加编排投影和 steer/followUp/nextTurn 控制。 | 预计有：多 Agent 编排状态和控制入口；尚未设计。 | ⏳ Wave 5 稳定后再细化 |
| Phase 6 | Plugin / Pipeline：Agent Event Hooks、Provider/Engine Registration、Pipeline、外部 RPC/SDK | 让外部 Provider、Engine 和自动化流程通过正式扩展点接入。 | 从内置集成扩展为 registration、hooks、pipeline 与外部 API。 | 预计有：插件/流程管理入口；尚未设计。 | ⏳ 远期，不进入当前承诺 |

---

## 关键路径与风险提示

```text
关键路径:
T0.1 → A1.1 → A1.2 → A1.5 → A2.1 → A2.2 → A2.3 → A2.4
     → A3.1 → A3.5 → B.3 → B.4 → C.1 → C.2 → C.3 → C.7
```

| 风险模块 | 原因 | 策略 |
|---|---|---|
| A2.3 Run/Turn Assembler | 全文档最难：要在 fan-out/drop 前拿到 authoritative final state | 主线亲自做，不派并行 agent |
| C.3 Compatibility Transformer | 唯一 XL：source×target 组合爆炸 | 先做 Claude↔Codex 两向，Kimi 后置 |
| C.7 Cursor Recovery | 三类失败边界幂等，错一处全盘失真 | 主线亲自做；每边界配 fault-injection 测试 |
| B.4 Provisioning Recovery | 外部 side effect + 崩溃窗口 | 与 A1.5 测试台复用同一套强杀注入 |

**执行纪律**

- 每个 Wave 开始于对应 OpenSpec Change 的 proposal（`openspec-new-change`），结束于 `openspec-verify-change` + Gate 勾选。
- Spike（T0.3–T0.5）是纯调研：只产出文档，不写产品代码。
- dark launch 期间（Wave 1–3）Shared 产品行为不变；任何"顺手接入真实流量"的冲动都违反设计红线。
