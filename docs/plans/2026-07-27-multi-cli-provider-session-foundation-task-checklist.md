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

| # | 任务 | 并行 | 前置 | 验收 | 体量 | 状态 |
|---|---|---|---|---|---|---|
| T0.1 | Canonical Fact JSON Schema 落 OpenSpec：`turnRequested` / `context.deliveryPrepared` / `context.deliveryAccepted` / `turnAccepted` / `turnCommitted` / `usageRecorded` / `usageAggregateRecorded` / `controlFact` | ⫽ | 无 | Schema 文件 + `openspec validate` 通过 | M | ✅ 已完成 |
| T0.2 | 领域契约 artifacts：ExecutionTarget / TurnExecutionSnapshot / SessionOrigin / ConversationFamilyRef / BindingKey 规则 / BindingContextCursor / BindingProvisioningState / NativeHistoryReader / NativeHistoryMaterialization / Legacy fidelity | ⫽ | 无 | 设计文档 §Phase 0 验收 6 条 | M | ✅ 已完成 |
| T0.3 | **S1 Spike**：Codex `thread/inject_items`——支持 Item 类型、持久化、read-back、duplicate 行为、`clientUserMessageId` 关联 | ⫽ | 无 | 实测 capability matrix 落档 | M | ✅ 已完成 |
| T0.4 | **S2 Spike**：Claude `--replay-user-messages`——echo 格式、checksum 关联、`result` 与 process-exit 冲突定性 | ⫽ | 无 | 实测 ACK contract 落档 | S | ✅ 已完成 |
| T0.5 | **S3 Spike**：Kimi ACP——initialize capability、`session/load` replay、prompt lifecycle、Provider config 边界 | ⫽ | 无 | 实测 matrix + ACP go/no-go 结论 | M | ✅ 已完成 |
| T0.6 | Native golden fixtures：Claude/Codex 代表性 History + Live Event fixtures | ⫽ | 无 | fixtures 入库、可重复加载 | M | ✅ 已完成 |

**⛔ Gate 0**（2026-07-27 完成，commit `d807d8e9e`，见 `openspec/changes/establish-session-foundation-contracts/`）
- [x] 三个 Spike 产出实测 matrix，后续 Adapter contract 不以 CLI 文案或假设为依据（结论与降级约束见该 change design.md §5.1）
- [x] Phase 0 全部契约 artifact 通过评审（proposal/design/specs/schemas + validate.mjs 14/14 PASS + fixtures loader 6/6 passed + `openspec validate --strict` valid）

---

## Wave 1：Change A1 — establish-shared-event-storage

| # | 任务 | 顺序 | 前置 | 验收 | 体量 | 状态 |
|---|---|---|---|---|---|---|
| A1.1 | SQLite WAL schema + migration 框架（`shared_sessions_v2` / `shared_event_log` / `shared_binding_state` / `shared_projection_checkpoint` / `shared_legacy_import` / `provider_usage_aggregate_log`） | → | Gate 0（T0.1） | schema 契约 7 条保留项 | M | ✅ 已完成 |
| A1.2 | `SharedEventWriter`：单 Writer Actor、唯一 sequence allocator、event insert + `next_sequence` 同一 transaction | → | A1.1 | 并发写不冲突、重放幂等 | M | ✅ 已完成 |
| A1.3 | Unique constraints + `dedupe_key`（usage 例外路径） | ⫽ | A1.2 | 100 次重复写同一 event/attempt 不产生重复 Fact | S | ✅ 已完成 |
| A1.4 | Provider Usage Ledger writer（Provider+Window+subject+revision 幂等） | ⫽ | A1.2 | supersede 链正确；不伪造 `session_id` | S | ✅ 已完成 |
| A1.5 | Crash/power-loss 测试台：每个 Tx 边界强杀 + fsync 前后注入 | → | A1.3、A1.4 | all-or-nothing；重启结果正确 | L | ✅ 已完成 |
| A1.6 | 启动恢复：bounded `quick_check`、integrity failure → read-only recovery、不建空库覆盖 | ⫽ | A1.5 | §14.4.8 验收全量 | M | ✅ 已完成 |

**⛔ Gate 1（A1 独立验收）**（2026-07-27 完成，commit `dca0882fe`）
- [x] 无 UI、无 Runtime Adapter 条件下证明：sequence 单调、事务 all-or-nothing、重启正确、Ledger 幂等
- [x] OpenSpec Change A1 `openspec validate --strict` 通过

---

## Wave 2：Change A2 — assemble-shared-canonical-facts

> 2026-07-27 收口：依据上游设计 §Phase 1，A2 仅消费 synthetic fixtures 与
> V0 authoritative final-evidence read-only mirror。真实 Runtime ingress/ACK 属于 Change B。

| # | 任务 | 顺序 | 前置 | 验收 | 体量 | 状态 |
|---|---|---|---|---|---|---|
| A2.1 | Canonical Fact 类型 + payload 校验（对接 T0.1 Schema） | → | Gate 1 | 非法 payload 拒绝落盘 | M | ✅ 已完成 |
| A2.2 | run identity → Snapshot/Binding durable 关联 | → | A2.1 | Change A 固化 contract；真实关联由 Change B 接入 | M | ✅ contract 完成 |
| A2.3 | Run/Turn Assembler：从 authoritative final snapshot contract 组装 | → | A2.2 + S1/S2 结论 | synthetic normal/delta lane 全丢仍产出完整 Final | L | ✅ 已完成 |
| A2.4 | Critical Commit Sink contract + 幂等 ACK | → | A2.3 | synthetic duplicate Terminal 幂等 | M | ✅ 已完成 |
| A2.5 | Atomic Tool Exchange 配对验证（incomplete/error 显式结算） | ⫽ | A2.3 | 未配对 Tool Call 不落盘为成功 | M | ✅ 已完成 |
| A2.6 | Usage normalization：revision/supersedes 校验、Turn Fact 与 Aggregate Ledger 分流 | ⫽ | A2.4 | 重放不重复计费；aggregate-only 不猜分摊 | M | ✅ 已完成 |
| A2.7 | V0 final-evidence read-only mirror → 隔离 Shadow Canonical Log | ⫽ | A2.4 | 不回写产品状态 | M | ✅ 已完成 |
| A2.8 | （可选）read-only Event Log Inspector，feature flag / dev build 隔离 | ⫽ | A2.1 | 写操作与生产默认入口不可达 | S | ⏭️ 推迟到 Wave 3 |

**⛔ Gate 2（A2 独立验收，已完成）**
- [x] synthetic authoritative final snapshot：duplicate Terminal、dropped delta、failed/cancelled/replaced、Usage 分流正确
- [x] V0 authoritative final evidence 只读镜像到隔离 Shadow Log；不改变真实 Send/V0 产品状态

---

## Wave 3：Change A3 — project-shared-canonical-conversation

> 2026-07-27 收口：Shadow Log read commands、feature-flagged DataSource、Legacy fallback
> 与 render regression gates 已接入；flag 默认关闭，Shared 产品行为仍保持 V0。

| # | 任务 | 顺序 | 前置 | 验收 | 体量 | 状态 |
|---|---|---|---|---|---|---|
| A3.1 | UI Projection：Canonical Fact → 幕布兼容 `ConversationItem`（单向，不回写） | → | Gate 2 | Shared/Native 双 DataSource 隔离成立 | L | ✅ 已完成 |
| A3.2 | Projection checkpoint + rebuild（`projectionVersion + throughSequence`） | ⫽ | A3.1 | 删除 Projection 后重建，item count/order/type/checksum 一致 | M | ✅ 已完成 |
| A3.3 | Legacy snapshot dual-read reader（`fidelity = "presentation-only"`，不伪造 Tool ID/Signature/Target） | ⫽ | A3.1 | 旧 Shared 会话可读、可继续，旧文件不改写 | M | ✅ 已完成 |
| A3.4 | Shadow Projection vs Legacy dual-read 对比器（只记录 mismatch，不反向写） | → | A3.2、A3.3 | 对比报告产出 | M | ✅ 已完成 |
| A3.5 | Canvas 防回归门禁：Native/Shared Projection 隔离 + golden fixtures 回归 | → | A3.4 + T0.6 | §17.6 定向门禁通过 | L | ✅ 已完成 |

**⛔ Gate 3（A3 独立验收 + dark launch 闭环，已完成）**
- [x] Shadow 链路仅镜像 terminal V0 evidence；Projection 不作为 ingress
- [x] Native golden regression 保持通过，Shared flag 关闭不查询 V2
- [x] 同一 Shared session 切换 target 不 remount/flicker
- [x] Shared 后台 Binding 更新不命中 Canvas selector，无持续 render storm

---

## Wave 4：Change B — compose-shared-session-execution-target

> **当前状态：已准入，尚未实施。** Change B 从真实 Execution Target、Binding 与
> V0→V2 Send 写路径开始，继续保持 feature flag 可回滚。

| # | 任务 | 顺序 | 前置 | 验收 | 体量 |
|---|---|---|---|---|---|
| B.1 | `selectedNextTarget` / `activeTurnTarget` Store 分离 + 四级 Picker（CLI→Provider→Model→Reasoning） | ⫽ | Gate 3 | Picker 变化不改写历史 Turn Badge | M |
| B.2 | `bindingsByEngine` → `bindingsByTarget` 迁移（旧 Binding 归 default-provider，不猜 managed Provider） | ⫽ | Gate 3 | 旧会话按 local/default 语义恢复 | M |
| B.3 | Send 全链路：`providerProfileId` 贯通 + Tx1 snapshot 固化 + **V0→V2 真实写路径切换** | → | B.1、B.2 | dark launch 结束；Shared 真实流量跑 V2 | L |
| B.4 | Durable Binding Provisioning + duplicate-create recovery（ACK 不确定 → recovery-required，禁止盲建） | → | B.3 + S1/S2/S3 结论 | 强杀不产生第二个同 Target Binding | L |
| B.5 | Target-aware owner routing：Interrupt / Approval / Pending Rebind / Recovery 携带完整 Owner | ⫽ | B.3 | 同 Engine 双 Provider 并行不串线 | L |
| B.6 | UI 状态机落地：9 状态 + `CancelPending` + degraded-context 用户确认 | ⫽ | B.3 | §14.5.6 UX 验收全量 | M |

**⛔ Gate 4（Phase 2 验收矩阵）**
- [ ] `Claude/Official → Claude/OpenRouter → Codex/OpenAI → Claude/Official`：一个 Sidebar Row、三个 Hidden Binding、切回复用原 Binding、Turn Provenance 正确、任一 Provider 失败不重路由

---

## Wave 5：Change C — add-shared-context-compiler

| # | 任务 | 顺序 | 前置 | 验收 | 体量 |
|---|---|---|---|---|---|
| C.1 | Versioned ContextPackage + ProjectionManifest（`cursorSemantics` / `disposition`） | → | Gate 4 | Manifest 记录全部 transformation/omission/checksum | M |
| C.2 | ContextCompiler 核心：五 mode + capability predicate + 固定优先级链（native-delta > import > clone > transcript > checkpoint） | → | C.1 | 不按 Engine 名硬编码假设 | L |
| C.3 | pi-ai 式 Compatibility Transformer（thinking / tool-id / tool-result / image / aborted 清理） | → | C.2 | source×target matrix 自动化 | XL |
| C.4 | Codex `native-history-import` Adapter（按 S1 实测） | ⫽ | C.3 | JSON-RPC success 才推进 context accepted | L |
| C.5 | Claude echo ACK + transcript/checkpoint 投影（按 S2 实测） | ⫽ | C.3 | echo checksum 匹配才记 `turnAccepted` | M |
| C.6 | Kimi ACP Adapter 或 `ackFidelity = weak` 显式标记（按 S3 实测） | ⫽ | C.3 | 不假装 exactly-once | M |
| C.7 | Two-phase cursor + pendingDelivery recovery（accepted/committed 分离推进；native-delta 排除目标 Binding 原生 Entries） | → | C.4–C.6 至少其一 | compile/accept/commit 三类失败边界幂等 | L |
| C.8 | Artifact Store（临时文件 + 原子 rename + GC 识别）+ Progressive Retrieval Host Tool | ⫽ | C.7 | 悬空引用可识别；检索结果标记 reference context | L |
| C.9 | Structured Checkpoint 增量编译 + Omissions 可见 + 用户确认降级 | ⫽ | C.7 | 未经确认不发送降级 Context | M |

**⛔ Gate 5（Phase 3 验收）**
- [ ] 长会话切换不依赖固定 8 Turn；Tool Call/Result 成对保留或成对省略
- [ ] 同一 Binding 不重复注入其已有历史；checkpoint 遗漏只按 `retrievableRef` 检索，不自动补发
- [ ] §17.5 source×target 验收矩阵通过

---

## Wave 6：Change D — add-native-provider-continuation

| # | 任务 | 顺序 | 前置 | 验收 | 体量 |
|---|---|---|---|---|---|
| D.1 | NativeHistoryReader × 3：Claude session JSONL / Codex rollout / Kimi 公开 surface | ⫽ | Gate 5（可与 C 后期重叠启动，只依赖 T0.2 contract） | `stableCursor=false` 时 typed unsupported、fail closed | L |
| D.2 | NativeHistoryMaterialization 持久化：fingerprint/cursor/checksum，Retry 复用不重读漂移来源 | → | D.1 | materialization 后可审计、可重放 | M |
| D.3 | Continuation 创建流：入口 → package 编译 → 新 Native Session + 新 Provider Binding | → | D.2 + C.2 | 原 Session 不变、不改写、不自动归档 | M |
| D.4 | `provider-continuation` Origin + Conversation Family 继承 + `供应商续接` 标签 + 查看来源导航 | → | D.3 | §17.1 矩阵；不写 `parentThreadId`、不显示 `子代理` | M |

**⛔ Gate 6（Phase 4 验收）**
- [ ] 新 Session 顶层显示、Provider Profile 不同、`familyId` 继承、`lineageParentSessionId` 指向来源
- [ ] 删除来源 Session 不级联删除 Continuation；来源 Native History 不写入 Shared Event Log

---

## 远期（Wave 5 稳定后再细化，当前不展开）

- [ ] Phase 5 Orchestration Foundation：Orchestrator Projection 只消费 A2 Canonical Fact，不建第二条 authoritative Sink；`steer / followUp / nextTurn`
- [ ] Phase 6 Plugin / Pipeline：Agent Event Hooks、Provider/Engine Registration、Pipeline、外部 RPC/SDK

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
