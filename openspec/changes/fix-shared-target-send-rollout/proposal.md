## Why

Shared Session 已暴露 CLI → Provider → Model → Reasoning Picker，但生产发送入口在未配置 flag 时仍默认走 V0，丢弃 `providerProfileId`。这使 UI 显示的 Target 与真实 Runtime Target 分裂，并可能把 managed Provider 的 Model 发送给 Codex 默认 ChatGPT Runtime。

该行为违反基石设计 Phase 2、已归档 Change B 的完成口径，以及 `shared-send-pipeline` 的“不静默回退”契约，需要补齐 rollout 和重启恢复闭环。

实现后的手工验证又暴露第二个 contract 漂移：Provider catalog 使用
`providerProfileSource = "disk" | "managed"`，Foundation canonical schema 使用
`"local" | "managed"`，但 Shared Target/IPC 把两者都声明成裸 `string` 并原样透传。
结果是 local/default 新 Turn 把 `"disk"` 写入 `conversation.turnRequested`，直到
canonical validator 才被拒绝。该问题必须通过分域类型和唯一转换边界修复，不能通过
放宽 validator 或 backend 临时兼容掩盖。

后续真实 App 验收证明此前“V2 Runtime dispatch 已完成”的判断不成立：
`sendSharedSessionTurnV2` 只把 `ExecutionTarget` 写入 canonical facts，真实 side effect
仍调用接受第二套 `engine/model/effort/providerProfileId` 的 V0 command。因而 canonical
可以记录 `Codex/gpt-5.3-codex-spark`，Runtime 却实际收到 stale
`Codex/kimi-for-coding`。现有 tests 只断言 mocked RPC 字段或直接调用 begin/commit core，
没有观测真实 fake Runtime 的 Provider process key 与 `turn/start.model`，属于错误绿灯。

同一验收还暴露 canonical terminal 与 projection 缺口：frontend terminal observer 只提交
assistant text，Reasoning/Tool/Artifact 未进入 `turnCommitted`；V2 Send default-on，
canonical projection 却 default-off，导致实时与重载后的逐轮 CLI/Provider/Model label
缺失。上述问题同属 Foundation 的 Snapshot Authority 与 Canonical Commit 闭环，必须在
本 Change 内一起修复。

## 目标与边界

- Shared V2 Send 成为默认正常路径，完整透传 CLI、Provider、Model、Reasoning。
- 保留显式 V0 rollback；已提交的 V2 facts 不删除。
- Shared Session 在一次发送冻结 Target 后，重载应恢复完整 `selectedNextTarget`，不能只恢复 Engine/Provider。
- 新 Shared Session 必须从第一笔 meta 开始持有完整 `initialTarget`；Shared UI 不再暴露
  Engine-only selector，selection persistence 失败不得造成 memory/disk drift。
- Target/Model 不匹配在 Runtime side effect 前 fail closed。
- 每个 attempt 已落盘的 `conversation.turnRequested.target` 是 Runtime、Binding、
  Context Delivery、terminal commit 的唯一执行权威；frontend 不得再传第二套 Target。
- `modelCatalogEntryId` 与 runtime `model` 全链路分域保存，并按同一 Provider catalog
  entry 精确校验；CLI 只消费 runtime `model`。
- Picker 只更新 `selectedNextTarget`，不得创建或改写 Runtime Binding。
- Shared V2 Runtime 使用 canonical V2 binding state；legacy JSON binding 只作兼容读取/
  投影，不得成为 V2 routing authority。
- Runtime lifecycle owner 在 fan-out/drop 前组装 canonical terminal blocks，保留
  assistant、Reasoning、Tool、Artifact 与 structured outcome。
- Runtime identity bind 前后的 early/live ingress 通过 Rust atomic replay barrier
  保序；Context echo ACK 不得与 barrier 形成死锁。
- Interrupt 以 attempt-owned cancel intent 定性；Rebuild Target 从 durable Binding row
  派生，二者都不得回退当前 Picker。
- 新 V2 Turn 默认由 canonical projection 展示；legacy history 通过 dual-read 保留，
  不得因 rollout 丢失历史。
- 每轮 CLI、Provider、Model label 来自 immutable Turn snapshot，不读取当前 Picker。
- Provider catalog source 与 canonical Provider source 使用不同强类型；只允许在
  `freezeTurnSnapshot` 边界执行 `disk → local` 转换。
- Shared 非 idle 状态阻止新 Turn 提交，但 normal running / settling 不得通过全局
  `disabled` 关闭文本编辑；ambiguous recovery 状态仍锁定整个 Composer。
- Terminal owner 必须以稳定 Runtime Run identity 为主，不能因 Binding 的
  pending/native/shared Thread identity rebind 丢失合法 settlement。
- Restore 的异步 evidence 必须带 mutation revision，不能在完整 send cycle 后用旧
  in-flight snapshot 重新锁住已 `idle` 的 Composer。
- Shared programmatic send 必须在 optimistic/activity/processing mutation 前原子取得一次性
  admission revision；只读 idle preflight 不能作为并发锁。
- Recovery Probe 必须真实查询 durable Attempt/Binding owner；未知或 RPC 失败保持锁定并
  显示错误。
- 只改变 Shared Session 行为；Native Provider Continuation 仅增加 canonical/native source
  显式 adapter，不改变 History、Send 或 Runtime ownership 语义。

## 非目标

- 不在 V0 路径继续追加 Provider/Model 补丁。
- 不删除 Legacy V0 reader 或历史 snapshot。
- 不新增自动 Provider failover、自动 Model 替换或 Prompt 路由。
- 不修改 Context Compiler 五模式和 Native Session 行为。
- 不新增自动 Provider failover、Model fallback 或静默 V0 fallback。
- 不在本 Change 新增产品级 Retry/Regenerate 入口。当前必须禁止 ambiguous blind retry；
  未来若新增，需独立 OpenSpec，并按 `logicalTurnId + new attemptId + retryOfAttemptId`
  建模，禁止复用原 Attempt。

## What Changes

- 将 `mossx.sharedV2Send` 从“显式开启”调整为“默认开启、显式关闭回滚”的三态策略。
- Shared send router 在默认配置下只走 V2；仅显式 negative override/build flag 才走 V0。
- 在发送冻结边界持久化并恢复完整 `ExecutionTarget`，覆盖 Engine、Provider、Model、Reasoning 和可读 Provider Snapshot。
- 将 selection source `"disk" | "managed"` 与 canonical source
  `"local" | "managed"` 分域建模；Rust canonical DTO 使用 enum，禁止裸字符串漂移。
- 增加发送边界回归测试，证明 managed `providerProfileId` 与 Model 原样到达 V2 Runtime dispatch。
- 增加 local/default 回归测试，证明 V2 payload 产生 `"local"`，而 `"disk"` 和未知
  canonical source 继续 fail closed。
- 增加 reload 与 fail-closed 增量测试。
- 拆分 Shared Composer 的 Input / Submit / Picker gate，避免 V2 default-on 后把
  “禁止并发发送”错误扩大为“禁止输入草稿”。
- 修复 Terminal owner matching 与 stale restore race，并用生产响应形状覆盖
  “第一轮 durable commit 后第二轮可发送”。
- 删除 V2 的 V0 actual-send wrapper，新增 attempt-owned Rust Runtime dispatch；backend
  只从 durable `turnRequested` 读取 effective Target。
- 完整贯通 `modelCatalogEntryId + runtime model`，复用 Native Provider Continuation
  已有 pair validation 语义。
- 将 Picker 与 Binding provisioning 分离，统一 V2 binding authority。
- 将 canonical terminal assembly 移入 Rust runtime lifecycle owner；frontend observer
  仅等待 UI terminal，不再负责 canonical truth。
- 默认启用 Shared canonical projection，并以 dual-read 保留 legacy history。
- 增加逐轮 provenance sidecar/snapshot 投影，确保 live、failed、reload 后均显示冻结的
  CLI/Provider/Model label。
- 新建 Session 强制完整 Target；移除 Shared Engine-only production action；Picker
  `persist-first → publish store`。
- 增加 coordinator replay barrier、cancel intent 与 binding-derived rebuild contract。
- 严格隐藏 Shared Runtime prompt echo，同时保留 assistant/reasoning/tool 与
  reasoning/tool-only provenance anchor。
- 补齐 Composer atomic admission race 与 Recovery Attempt/Binding Probe 真调用。

## 技术方案取舍

- 方案 A：让 V2 成为默认路径，V0 仅作显式 rollback。复用既有 Change B 管线，身份与 durable-first 契约唯一，采用。
- 方案 B：给 V0 增加 `providerProfileId` 和 Model 校验。改动表面较小，但继续维护两套生产身份链路，并绕过 V2 snapshot/provisioning contract，否决。
- 方案 C：V2 未开启时禁用 Picker。行为诚实但撤回已交付能力，不能满足 Phase 2，否决。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-send-pipeline`: V2 Send 从 opt-in 灰度升级为默认路径，V0 仅由显式 rollback 选择。
- `shared-execution-target`: 完整 `selectedNextTarget` 必须跨 Shared Session 重载持久化恢复。
- `shared-execution-target`: Picker selection source 必须在 freeze boundary 转换为
  Foundation canonical source；canonical snapshot 不得包含 `"disk"`。

## Impact

- Frontend：`src/features/shared-session/runtime/`、Shared target state/load boundary、相关 Vitest。
- Backend：`src-tauri/src/shared_sessions.rs` 的 Shared metadata target schema、
  canonical source enum、Native Continuation source adapter 与相关 Rust tests。
- Specs：`shared-send-pipeline`、`shared-execution-target`。
- 依赖：零新增。

## 验收标准

- 未设置任何 rollout override 时，Shared Send 调用 V2，managed `providerProfileId` 不丢失。
- 显式设置 rollback off 后，V0 仍可调用；清除 override 后恢复 V2。
- `Claude/Provider A → Codex/Provider B → Claude/Provider A` 不重路由，切回复用正确 Binding。
- 重开 Shared Session 后，Picker 恢复完整 Provider、Model、Reasoning。
- 新建 Shared Session 缺失/partial `initialTarget` 时，在写目录/meta 前 fail closed；
  Shared surface 不可触发 Engine-only selection。
- Picker selection 持久化失败时，UI 与下一次发送继续使用旧 durable Target。
- local/default Shared 新 Turn 的 canonical snapshot 使用
  `providerProfileSource = "local"`；managed 保持 `"managed"`。
- canonical IPC/event 收到 `"disk"` 或未知 source 时 fail closed。
- Shared Turn 运行或落账期间输入框仍可编辑并保留草稿，但 Enter、发送按钮和
  programmatic submit 不得创建第二个 Turn。
- 两个 caller 同时通过早期 idle preflight 时，只允许一个 caller 创建 optimistic user
  message、processing mutation 与 Runtime RPC。
- `cancel-pending` / `recovery-required` 仍锁定整个 Composer。
- exact `runtimeTurnId` 在 Thread rebind 前后仍能完成 terminal settle；durable commit
  ACK 后状态回到 `idle`。
- restore RPC 跨越完整 send cycle 返回时不得用 stale evidence 把 `idle` 改回
  `running`。
- 生产响应不依赖 synthetic `delivery.terminal`，连续两轮发送增量测试通过。
- Provider/Model 不匹配在 Runtime 调用前返回 `target-unavailable`。
- 构造 durable Snapshot=`Codex/default/gpt-*`、legacy flat fields=`kimi-for-coding`
  的 poisoned request 时，fake Runtime MUST 只收到 durable Snapshot，或在 side effect
  前 fail closed。
- 同 Engine 不同 Provider 切换时命中不同 Provider process/binding；切回原 Target 复用
  原 Binding，不回退 default Provider。
- `modelCatalogEntryId != model` 时 canonical 同时保存两者，CLI 请求只包含 runtime
  `model`。
- terminal fixture 同时含 assistant、Reasoning、Tool、Artifact、structured failure 时，
  SQLite reload 后内容、顺序与 Turn Target 完整。
- pre-bind early event 与 replay 期间新 event 顺序稳定；duplicate terminal 只提交一次；
  Claude exact Context echo 不阻塞 ACK wait。
- Interrupt 同步 `TurnError` 在 cancel intent 下结算为 cancelled；interrupt side effect
  失败后普通 Runtime error 仍为 failed。
- Rebuild 只凭 durable `bindingKey` 派生 Engine/Provider，caller 不能借恢复改 Target。
- Probe 必须调用 durable Attempt/Binding query；unknown/ambiguous/error 不能解锁。
- 不设置 projection localStorage flag 时，新 V2 Turn 的 live/history label 仍来自
  immutable canonical snapshot；切换当前 Picker 不改变旧 Turn。
- exact Shared Runtime prompt echo 只隐藏重复 user transport item；后续
  assistant/reasoning/tool 保留，普通 `MOSSX` 文本不误杀。
- 只跑相关 Vitest、Rust 定向测试、typecheck 与本 Change strict validation；不跑全量测试。
