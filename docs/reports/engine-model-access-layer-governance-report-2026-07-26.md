# 引擎与模型接入层摸底排查报告

> - 范围：`engine / codex / claude / gemini / kimi / opencode / models / vendors`
> - 排查日期：2026-07-26
> - 基线分支：`feature/v-0710`
> - 基线提交：`680f8a71b`
> - 二次梳理依据：PI architecture、plugin marketplace、chat orchestration 三份研究文档
> - 文档性质：现状审计、CLI foundation 任务规划与治理建议，不代表已完成代码整改

## 1. 结论先行

这批问题不是 8 个互不相关的局部坏味道，而是同一个架构缺口在不同层面的表现：

> 引擎身份、能力、模型目录、供应商元数据和配置持久化没有形成跨 TypeScript / Rust / daemon / CLI 的统一 contract。

当前系统已经存在若干正确的局部机制，例如：

- Codex 主模型选择链路已采用 app-server `model/list`，不是纯静态目录。
- OpenCode 已能通过 `opencode models` 获取已配置的 `provider/model`。
- `engine-capability-matrix` 已有 OpenSpec single source of truth 和一致性检查脚本。
- Claude 模型列表会合并 builtin、settings/env 和用户 custom models。
- realtime adapter 已有集中式 registry。

但这些机制没有收敛成同一套接入契约，导致同一个事实在多个模块重复表达：

- “有哪些引擎”同时写在 TypeScript union、前端数组、Rust enum、daemon mirror 和多个 switch/map 中。
- “引擎支持什么能力”同时存在 OpenSpec matrix、Rust `EngineFeatures` 和缩水后的 TypeScript `EngineFeatures`。
- “有哪些模型”同时来自 runtime discovery、前端 fallback、Rust fallback、供应商 preset 和 localStorage。
- “模型属于哪个 provider”后端已经知道，但 `ModelInfo.provider` 被禁止序列化，前端只能再次猜测。
- “thread 属于哪个 engine”大量通过字符串前缀重复推断，而不是优先消费显式字段。

### 1.1 原问题核验结果

| 问题                                      | 核验结论                              | 当前判断                                                                                                    | 建议优先级              |
| ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- |
| `useEngineController` 1008 行 god hook    | **确认，但原证据需修正**              | 文件确为 1008 行；不是“约 20 个子 hook 聚合”，而是大量状态、effect、helper 和 orchestration 集中在一个 hook | P2，foundation 后置     |
| 引擎枚举 3 处硬编码                       | **确认，实际范围更大**                | 不止 3 处；跨 TypeScript、Rust、daemon、execution policy、UI label 和 thread adapter                        | P1                      |
| capability matrix 三项永远 `unknown`      | **确认，并发现更严重的跨层错位**      | 三项确实固定为 `unknown`；另外 3 个 legacy 字段与 Rust serde payload 名称不一致，可能被误判为 `unsupported` | P0 contract correctness |
| 模型/供应商全靠硬编码                     | **部分成立**                          | Codex/OpenCode 已有 runtime discovery；静态 fallback 仍多处重复且互相冲突                                   | P1                      |
| Claude mapping 使用 3 个 localStorage key | **确认，但属于 legacy compatibility** | 一个 canonical key 加两个 legacy alias；当前仍持续 triple-write，迁移没有结束                               | P1                      |
| `isValidModelId` 双源不一致               | **已修**                              | 本轮不再处理，仅保留回归哨兵                                                                                | 已完成                  |
| Claude 错误大面积静默吞掉                 | **确认**                              | load/save/switch/delete 多条失败路径无可观察错误，测试只覆盖 reorder                                        | P1                      |
| OpenCode 面板 1011 行启发式               | **确认，但已 soft-retired**           | 问题存在，但面板已不可达；当前应清理 retirement boundary，不应继续拆面板                                    | P1 清理；面板重构不做   |
| engine/thread 前缀推断散布                | **确认，原始计数仍准确**              | `threadId.startsWith("claude:")` 为 36 处、25 个 `src` 文件；其他引擎前缀同样扩散                           | P0-P2，分阶段治理       |

### 1.2 新发现的高价值问题

1. **Capability transport contract 被截断且字段错位。** Rust 已提供 `reasoningEffort`、`collaborationMode`、`mcp` 等序列化字段，但 TypeScript `EngineFeatures` 没有接住；`reasoning`、`toolUse`、`sessionContinuation` 也分别无法直接匹配 Rust 的 `reasoningEffort`、`toolsControl`、`sessionResume`。结果不只是固定 `unknown`，还可能把已支持能力误判为 `unsupported`。

2. **Codex fallback 目录存在双重事实源且内容不同。** 前端 `codexModelCatalog.ts` 与 Rust `status.rs` 的 Codex builtin roster 不一致。正常链路可能被 runtime catalog 遮住，但 degraded mode 会出现不同结果。

3. **OpenCode provider 元数据在序列化边界被主动丢弃。** Rust `ModelInfo.provider` 已被解析和保存，却标记为 `#[serde(skip_serializing)]`。前端随后用模型名前缀再次推断 provider，形成“后端知道、传输丢掉、前端重猜”的反向数据流。

4. **OpenCode 并非所有输出都只能 screen scraping。** `session list` 和 `run` 已有官方 JSON 输出能力；`models` 当前官方文档只保证 `provider/model` 文本格式。治理应按命令能力分层，不能假设所有命令都有 JSON。

5. **Gemini preview 模型“未发布”的描述已过时。** `gemini-3-flash-preview`、`gemini-3.1-pro-preview` 是官方 preview ID。真正问题是静态 preset 缺少来源、更新时间、生命周期和淘汰策略。

6. **Kimi CLI 是完整第五引擎，不是普通 preset。** 当前已具备 runtime、realtime、history、CLI lifecycle 和 provider management。它复用了 shared realtime adapter，provider error 也比 Claude 更显式；但 Kimi 尚未纳入 engine branch scanner，model/config parse 与 provider cleanup 存在静默降级，main OpenSpec 也只完整描述了 canonical session convergence。

### 1.3 面向 CLI 串线基石的二次判断

结合以下三份后续架构研究：

- `docs/research/mossx-plugin-market-and-cli-foundation-design.md`
- `docs/research/pi-architecture-plugin-marketplace-analysis.md`
- `docs/research/pi-chat-orchestration-research.md`

原任务清单需要调整。原清单大多正确，但偏向修复局部硬编码、DTO 和大文件，尚未形成未来 plugin runtime、marketplace、handoff 和 pipeline 可以复用的底座。

本轮治理应只建设 **L1 CLI foundation**，不直接实现 plugin runtime、marketplace 或 orchestration：

```text
CLI process / persistent app-server
              │
              ▼
EngineProtocol ── spawn / parse / input / lifecycle
              │
              ▼
EngineAdapter  ── identity / capabilities / session / delivery
              │
              ▼
MossxAgentEvent Bus ── runId / turnId / itemId / run:settled
       │              │               │
       ▼              ▼               ▼
frontend bridge   persistence    future plugin/orchestrator
```

关键调整：

1. `Engine registry` 不能只统一枚举和 label，应升级为 `EngineAdapter × EngineProtocol` registry。
2. `Thread prefix` 治理不能只做 parser，应建立 logical session、native session、pending alias 和 run/turn/item identity。
3. capability matrix 不能只补三个 `unknown`，应成为 runtime-queryable contract，并覆盖 `input.midTurn`、session control 和 RPC readiness。
4. 新增统一 Rust-side `MossxAgentEvent` bus 和 `run:settled`。这是未来 plugin event、handoff 和 pipeline 的硬前置。
5. 新增 runtime/session handle lifecycle 与消息投递语义。否则 persistent Codex app-server、one-shot CLI 和 Kimi pending promotion 仍会各自生长。
6. model/provider 治理采用 `provider × protocol` 正交模型，以及 `runtime > configured > cached > generated fallback` 分层。
7. OpenCode 已 soft-retired，不再投入面板重构；只收紧隐藏边界、清理残余 root hook/CSS，并保留最小 compatibility adapter 或完成 hard-delete 决策。
8. `useEngineController` 拆分降为迁移结果，不作为 foundation 的独立前置任务。

---

## 2. 当前接入链路

```text
                           ┌─────────────────────────────┐
                           │ OpenSpec capability matrix  │
                           └──────────────┬──────────────┘
                                          │ direct import
                                          ▼
TypeScript EngineType ──► useEngineController ──► AppShell / Composer / Panels
       │                       │
       │                       ├─ runtime models
       │                       ├─ static presets
       │                       ├─ localStorage
       │                       └─ engine status
       │
       ├─ UI maps / execution policy / thread prefix inference
       │
       ▼
Rust EngineType ──► EngineStatus + EngineFeatures ──► Tauri DTO ──► TypeScript
       │                                                       │
       ├─ Codex / Claude / Gemini / Kimi / OpenCode runtime     └─ legacy feature shape
       │
       └─ daemon mirror

OpenCode CLI ──► ANSI/text/table parsers ──► ModelInfo(provider known)
                                               │
                                               └─ provider skipped during serialization
                                                                    │
                                                                    ▼
                                                         frontend prefix heuristics
```

核心反模式不是“存在静态配置”，而是静态 fallback、runtime fact 和 transport DTO 没有明确所有权。

---

## 3. 分项排查

### 3.1 `useEngineController`：1008 行 orchestration god hook

#### 现状证据

- 文件：`src/features/engine/hooks/useEngineController.ts`
- 当前行数：1008
- 单一主要调用方：`src/app-shell.tsx`
- 主要职责包含：
  - engine display metadata
  - engine list 和持久化 selection
  - Gemini preset / builtin / custom model merge
  - Claude custom model merge 和 default preservation
  - engine detection、status、active engine
  - model loading 和 refresh
  - engine switching
  - catalog / display derived state
  - storage listener、workspace refresh 和多个 effect
  - runtime notice emission

原描述中的“约 20 个子 hook 聚合”与当前源码不符。当前问题更准确的描述是：

> 一个 hook 同时承担 domain state、I/O orchestration、migration、catalog merge、UI projection 和 side effects。

#### 影响

- 改模型合并逻辑时，容易误伤引擎切换或 storage listener。
- effect 的依赖关系难以局部推理，测试被迫覆盖超大返回面。
- 未来直接拆成多个 hook，如果 contract 没先统一，只会把重复事实搬到更多文件。

#### 建议边界

保留 `useEngineController` 作为 AppShell facade，内部按稳定能力域提取：

1. `useEngineSelection`：选择、持久化、切换。
2. `useEngineAvailability`：检测、status、refresh。
3. `useEngineModelCatalogs`：runtime/custom/fallback merge。
4. `useEngineRuntimeNotices`：notice projection。

先统一 registry、capability DTO 和 model catalog ownership，再拆 hook。否则属于移动债务，不是消除债务。

---

### 3.2 Engine registry：问题远大于“三处数组”

#### 已确认的事实源

| 层               | 当前事实源                                                                |
| ---------------- | ------------------------------------------------------------------------- |
| TypeScript 类型  | `src/types/engine.ts` 的 `EngineType` union                               |
| Controller       | `useEngineController.ts` 的 engine list、display map、type guard          |
| Availability     | `src/features/engine/utils/engineAvailability.ts`                         |
| Execution policy | `src/utils/engineExecutionPolicy.ts`                                      |
| Runtime policy   | `src-tauri/src/engine_policy.rs`                                          |
| Rust domain      | `src-tauri/src/engine/mod.rs` 的 `EngineType` enum、display/icon/features |
| Daemon           | `src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs` 的 mirror enum/DTO     |
| UI 与业务模块    | 多个 label map、switch、literal union 和 engine-specific branch           |

Gemini 还是一个特殊例子：

- TypeScript `EngineType` 包含 Gemini。
- 部分 UI 和模型配置支持 Gemini。
- frontend execution policy 排除 Gemini。
- Rust policy 中 `GEMINI_RUNTIME_ENABLED = false`。

因此 registry 不能只做一个“引擎 ID 数组”。至少要区分：

- `known`：代码认识该 engine。
- `implemented`：存在接入实现。
- `runtimeEnabled`：当前平台/构建允许执行。
- `adapterAvailable`：对应 realtime/runtime adapter 可用。
- `displayMetadata`：标准名称、短名称、icon。

#### 不建议的方案

不要试图用一个 runtime JSON 动态生成 Rust enum。Rust 侧仍需要编译期 exhaustive match 和类型安全。

#### 调整后的建议方案

建立 `EngineAdapter × EngineProtocol` layered registry：

1. `EngineProtocol`：process spawn、stdin、stdout/stderr parsing、termination。
2. `EngineAdapter`：identity、capability、session semantics、message delivery、protocol binding。
3. built-in engine：Rust enum 保留 exhaustive match 和编译期安全。
4. external/plugin engine：通过稳定 string `EngineId` 和 registration contract 接入，不要求改 built-in enum。
5. TypeScript projection：只消费 registry DTO，提供 display/policy/UI projection。
6. CI parity check：验证 built-in TypeScript / Rust / daemon 集合；external registration 单独验证 schema 和 provenance。

已有 `realtimeAdapterRegistry` 可作为迁移起点，但不能继续只解决前端 realtime 分发。registry 的价值是建立可扩展执行边界，不是只把 ID 数组搬到一个文件。

---

### 3.3 Capability matrix：不是 fixture 先坏，而是 DTO 先丢

#### 已确认

`src/features/engine/engineCapabilityMatrix.ts` 中以下三项固定为 `unknown`：

- `reasoning.effort`
- `collaboration.mode`
- `tool.mcp`

#### 根因链

Rust `EngineFeatures` 已包含：

- `reasoning_effort`
- `collaboration_mode`
- `mcp`
- `tools_control`
- `session_resume`
- `image_input`
- `streaming`

TypeScript `EngineFeatures` 只包含：

- `streaming`
- `reasoning`
- `toolUse`
- `imageInput`
- `sessionContinuation`

因此问题发生在 transport contract：

```text
Rust rich EngineFeatures
        │
        ▼
serialized EngineStatus
        │
        ▼
TypeScript legacy EngineFeatures
        │
        └─ missing fields projected as "unknown"
```

其中只有 `streaming`、`imageInput` 能按当前 serde naming 直接对上；`reasoning` / `reasoningEffort`、`toolUse` / `toolsControl`、`sessionContinuation` / `sessionResume` 还存在语义和字段名错位。由于 projection 用 truthy check，缺失字段会落为 `unsupported`，并让 `resolveEngineCapabilityRuntimeStatus(...).available` 返回 `false`。

这不是单纯增加 capability probe 就能解决的问题。对于静态声明能力，优先应修正 DTO；对确实依赖安装版本或 runtime 状态的能力，再做 probe。

#### 关于 OpenSpec fixture 依赖

当前生产 TypeScript 直接 import：

`openspec/specs/engine-capability-matrix/fixtures/matrix.json`

原判断“规范归档会破坏构建”不完全准确：

- 当前引用的是 main spec，不是 `openspec/changes/<change-id>`。
- 历史归档已把 change fixture 收敛到 main spec fixture。
- 当前 `npm run check:engine-capability-matrix` 通过。

真实风险是：

- production bundle 直接依赖 governance directory。
- fixture schema 变更会直接影响生产构建。
- OpenSpec SSOT、Rust features 和 TypeScript projection 仍需人工维持三方一致。

#### 建议

1. 补齐 TypeScript transport DTO，保持与 Rust 字段对齐。
2. 区分 `declared capability` 与 `runtime availability`。
3. 从 OpenSpec matrix 生成 `src` 下的 runtime artifact，生产代码不直接 import `openspec/**`。
4. 保留 OpenSpec 为 authoritative input，CI 校验 generated artifact、Rust 和 daemon parity。
5. 将 `input.midTurn`、session fork/switch/tree、RPC readiness 等 foundation capability 纳入可扩展 schema。
6. 为当前 capability key 增加 table-driven contract test，禁止再用固定 `unknown` 代替可探测事实。

---

### 3.4 Model catalog：已有 runtime-first，但 fallback ownership 混乱

#### Codex

主链路不是纯硬编码：

- `useModels.ts` 调用 app-server `model/list`。
- runtime catalog、custom models 和 builtin fallback 会合并。
- AppShell 对 Codex 优先采用该 hydrated catalog。

但存在两个互相冲突的 fallback：

- TypeScript：`src/features/models/codexModelCatalog.ts`
- Rust：`src-tauri/src/engine/status.rs`

两边 builtin roster 不一致。正常情况下 runtime catalog 会覆盖问题，但在 app-server 不可用、初始化失败或 fallback-only 路径中，用户可能看到不同模型。

#### Gemini

`useEngineController.ts` 同时合并：

- frontend presets
- backend builtins
- configured/custom models

`gemini-3-flash-preview` 和 `gemini-3.1-pro-preview` 是已发布的 official preview IDs，不应标记为“抄了未发布模型”。问题在于：

- 静态列表没有 provenance。
- 没有 `lastVerifiedAt`。
- 没有 lifecycle/deprecation 信息。
- frontend 与 Rust builtin roster 不一致。

#### Claude

Claude CLI 当前提供 `--model`，但没有与 Codex app-server 同级的完整 model-list RPC。现有 builtin + settings/env + custom merge 是合理降级策略。

因此 Claude 的硬编码不能简单删除。需要明确标记它是 curated fallback，不是 runtime-discovered fact。

#### OpenCode

`opencode models` 已能返回已配置的 `provider/model`，runtime discovery 存在。当前治理重点应是保留 provider metadata，而不是再扩充模型名前缀表。

#### 建议的 catalog 分层

```text
runtime discovered facts
        │ highest priority
configured / custom models
        │
curated fallback metadata
        │ lowest priority
        ▼
merged UI catalog
```

每个条目至少保留：

- `id`
- `provider`
- `source`
- `displayName`
- `capabilities`（仅在来源可信时）
- `lifecycle`
- `lastVerifiedAt`（仅 curated fallback）

不要建立一个“囊括所有厂商模型的巨型静态表”。这会把发布节奏问题从多个文件集中到一个更大的过期文件。

---

### 3.5 Claude localStorage：迁移兼容变成永久 triple-write

#### 当前结构

Claude model mapping 存在：

- canonical：`claude-model-mapping`
- legacy：`mossx-claude-model-mapping`
- legacy：`codemoss-claude-model-mapping`

读路径会探测三个 key；写路径仍同时写三个 key。

重复实现分布在：

- `src/features/models/constants.ts`
- `src/features/vendors/hooks/useProviderManagement.ts`
- `src/features/vendors/components/VendorSettingsPanel.tsx`

此外 models、vendors、composer 各自维护相似的 `STORAGE_KEYS`。

#### 风险

- 任意一次部分写失败都会产生版本分叉。
- 多处迁移逻辑难以保证同样的 precedence。
- legacy key 永远被继续写入，迁移窗口无法结束。
- storage event 会被多次触发，增加无效刷新和调试噪音。

#### 建议

1. 建立唯一 `STORAGE_KEYS` owner。
2. 只写 canonical key。
3. 首次读取时按明确 precedence 读取 legacy key。
4. 成功迁移后写 canonical，并 best-effort 删除 legacy key。
5. 迁移必须 idempotent。
6. 保留一个 release window 的兼容读取，再删除 legacy read。
7. 增加“canonical 存在、legacy 冲突、JSON 损坏、storage 不可用”测试。

---

### 3.6 Claude provider management：失败被压成 `null` / `false`

#### 已确认的静默路径

`src/features/vendors/hooks/useProviderManagement.ts` 中：

- mapping remove/write：`catch` 后忽略。
- provider load：失败后静默。
- current config load：失败后只设置 `null`。
- JSON parse / save：返回 `false`，不带原因。
- switch：失败后忽略。
- delete：失败后忽略。
- reorder：有 optimistic rollback，但没有可展示错误。

现有测试只覆盖 reorder success/failure，未覆盖 load/save/switch/delete。

#### 影响

大白话：用户点了保存或切换，界面可能看起来没变化，但系统也不告诉他哪里失败。开发者只能从最终状态反推，无法定位是 JSON、localStorage、Tauri command 还是 provider config 出错。

#### 建议

沿用 Gemini/Kimi/Codex 管理 hook 已存在的显式 error pattern：

- hook 暴露 `error` 和 `clearError`。
- imperative action 失败时抛出或返回 typed result。
- UI 使用 inline error 或 toast。
- error 至少带 `operation`、`code`、`message`。
- localStorage 不可用可降级，但必须留下 diagnostics，不能无痕。

最小测试矩阵：

| 操作    | 成功 | backend 失败 | malformed data |
| ------- | ---: | -----------: | -------------: |
| load    |   ✅ |           ✅ |             ✅ |
| save    |   ✅ |           ✅ |             ✅ |
| switch  |   ✅ |           ✅ |            N/A |
| delete  |   ✅ |           ✅ |            N/A |
| reorder | 已有 |         已有 |            N/A |

---

### 3.7 OpenCode：已 soft-retired，不应继续按活跃产品重构

#### 当前状态

- `OpenCodeControlPanel.tsx`：1011 行
- `useOpenCodeControlPanel.ts`：333 行
- frontend/backend feature default 均为关闭，settings UI 已无正常启用入口。
- `OpenCodeControlPanel` 没有 production import，属于不可达 UI。
- legacy config 仍可能保留 enable 状态。
- `AppShell` 仍挂载 OpenCode selection hook，全局 OpenCode CSS 仍被加载。
- Rust runtime、status 和 parser 仍保留 compatibility implementation。

原 provider/data 问题仍然存在：Rust `ModelInfo.provider` 已知但被 `#[serde(skip_serializing)]` 丢弃，panel 与 hook 各有一套 prefix inference；部分命令仍解析 CLI 文本。但在 soft-retirement 前提下，这些不再构成“重构面板”的理由。

#### 调整后的建议

1. 先明确 OpenCode 是继续 soft-retire 还是进入独立 hard-delete change。
2. soft-retire 下确保默认不可达，legacy config 不能绕过产品入口策略。
3. 从 `AppShell` 移除无效 selection hook，停止加载退休功能全局 CSS。
4. 删除或隔离不可达 panel，不拆成更多长期维护模块。
5. 仅保留 foundation migration 必需的 compatibility adapter。
6. 只有产品正式恢复 OpenCode 时，才执行 provider DTO、JSON command 和 `models` line parser modernize。

---

### 3.8 Thread engine identity：前缀已成为隐形数据库 schema

#### 当前生产代码计数

以下统计只扫描 `src/**`，排除测试和 spec：

| 表达式                           | 出现次数 | 文件数 |
| -------------------------------- | -------: | -----: |
| `threadId.startsWith("claude:")` |       36 |     25 |
| `startsWith("claude:")`          |       57 |     40 |
| `startsWith("codex:")`           |       10 |     10 |
| `startsWith("opencode:")`        |       46 |     36 |
| `startsWith("gemini:")`          |       48 |     36 |
| `startsWith("kimi:")`            |       44 |     33 |

已发现多套本地 inference helper，分布在：

- realtime adapter
- thread turn/item events
- thread actions
- replay / debug correlation
- UI display 和 operation routing

#### 本质

前缀并非完全错误。它可以继续作为：

- legacy persisted ID 的 compatibility encoding。
- transport boundary 的 fallback。
- human-readable diagnostics。

错误在于业务层把它当作 engine identity 的首选事实源。

#### 建议迁移顺序

1. 定义 `logicalSessionId`、`nativeSessionId`、`pendingAlias`，不再让一个 thread ID 同时承担三种语义。
2. event bus 在入口分配 `runId`、`turnId`、`itemId`，后续 sink 不自行重建。
3. domain object 优先使用显式 `engineSource` / `engineType`。
4. 建立唯一 legacy prefix boundary helper；只有字段缺失时解析。
5. Kimi alias/promotion 独立建模，不塞进无状态 parser。
6. adapter、events、actions 和 UI 逐批迁移，并统计 fallback 命中率。
7. 命中率和兼容窗口满足条件后，再评估 persisted ID migration。

不要一次性改写所有 thread ID。当前 ID 很可能参与缓存、持久化、IPC 和恢复链路，直接改 schema 风险高。

---

### 3.9 Kimi CLI：完整接入已落地，但治理契约未完全跟上

#### 当前接入范围

Kimi 不是只在 `EngineType` 中增加了一个枚举值。当前已经接入：

- `src-tauri/src/engine/kimi.rs`：CLI 检测、spawn-per-turn、stream-json、interrupt 和 runtime event。
- `src/features/threads/adapters/kimiRealtimeAdapter.ts`：复用 `mapCommonRealtimeEvent` 接入统一 realtime contract。
- `src-tauri/src/engine/kimi_history.rs` 与 frontend loader/parser：历史会话列表、加载和删除。
- `kimi-pending-*` → `kimi:<session_*>`：pending alias 到 canonical session identity 的提升。
- CLI lifecycle：安装、升级、卸载和 doctor。
- `src-tauri/src/vendors/kimi_providers.rs`：provider CRUD、模型探测和 `~/.kimi-code/config.toml` 物化。
- `useKimiProviderManagement.ts`：provider UI state 和显式错误展示。

因此 Kimi 必须参与本报告的 capability、registry、model catalog、provider metadata 和 thread identity 治理，不能只作为通用 union 中的一个成员带过。

#### 已有正确做法

- Realtime adapter 复用 shared adapter，没有复制一套 Kimi-only event mapping。
- Kimi 模型目录采用 `config.toml > env > builtin fallback`，方向上符合 runtime/config-first。
- Provider hook 暴露 `kimiProviderError`，save/switch/delete 失败不会像 Claude 一样完全无痕。
- Provider 写入采用 namespaced entry、backup、temp file 和 rename，降低覆盖用户配置的风险。
- OpenSpec 已对 pending alias、canonical promotion、迟到 delta 和 terminal settlement 建立行为 contract。

这些能力应保留，不应在 registry/thread identity 重构中被“统一”掉。

#### 已确认的治理缺口

1. **Engine branch scanner 未覆盖 Kimi。** `scripts/scan-engine-name-branches.mjs` 的 literal branch 正则只包含 `claude|codex|gemini|opencode`。Kimi proposal 也曾明确把“不纳入 scanner”列为非目标。结果是新增 Kimi-specific 分支不会触发现有治理 gate。

2. **Capability DTO 错位同样影响 Kimi。** Kimi Rust feature 声明会经过同一套 Rust → TypeScript transport；`toolsControl`、`sessionResume` 等字段无法被当前 TypeScript projection 正确消费。

3. **Kimi provider metadata 同样在 transport 丢失。** `get_kimi_models` 能从 `config.toml` 读取 provider，builtin/env model 也会设置 provider，但共享 `ModelInfo.provider` 使用 `#[serde(skip_serializing)]`，前端收不到该事实。

4. **配置损坏会静默伪装成 builtin fallback。** `read_kimi_models_from_config` 对 file read 和 TOML parse 使用 `.ok()?`。文件缺失、权限失败、格式损坏最终都可能变成空列表并回退 builtin，用户无法区分“未配置”和“配置已损坏”。

5. **Provider 删除可能留下无提示残留。** `cleanup_provider_from_kimi_config` 明确采用 best-effort；read、parse、serialize、write、rename 失败均被吞掉。ccgui provider 可能已删除，但 `~/.kimi-code/config.toml` 中的 `ccgui:` provider/model entry 仍存在。

6. **OpenSpec main spec 覆盖不足。** `openspec/specs/kimi-engine-runtime/spec.md` 的 `Purpose` 仍是 TBD，requirements 主要覆盖 canonical session identity。原 proposal 中的 history、CLI lifecycle、provider materialization 等长期 contract 没有完整沉淀到 main specs。

#### 对消息幕布与渲染的特殊影响

Kimi canonical identity 不是普通字符串解析，而是一段有状态迁移：

```text
kimi-pending-*
      │ session.resume_hint
      ▼
kimi:<session_*>
```

promotion 必须同步迁移：

- realtime items
- processing / active turn
- selection
- title mapping
- `liveAssistantTextChannel`
- queued delta 的最终目标

Thread identity 治理若只实现 `split(":")` 或统一 prefix parser，而没有保留 alias/promotion contract，会导致：

- pending row 与 history canonical row 同时出现。
- 迟到 delta 重建已退休的 pending thread。
- terminal event 只结束其中一个 row。
- 消息幕布留下重复消息或永久 processing 状态。

因此 Kimi identity regression guard 属于 P0 防回退项；它不要求重写现有 promotion，但任何 registry、thread resolver、reducer 或 live-text channel 改动都必须跑完整时序测试。

#### 建议

1. engine registry 和 branch scanner 从同一 engine ID 集合生成，立即纳入 Kimi。
2. capability transport 修复覆盖 `EngineFeatures::kimi()`。
3. model DTO 保留 Kimi provider/source，不让前端重新推断。
4. Kimi config 读取返回 `missing / malformed / io-error / loaded` 结构化状态；只有 `missing` 才静默使用 builtin。
5. provider 删除允许主记录删除成功，但 cleanup 失败必须返回 warning 并在 UI 显示。
6. 补齐 Kimi runtime/history/lifecycle/provider main specs。
7. 为 pending promotion、history-first、queued-delta-late、terminal-after-promotion 保留 focused regression tests。

---

## 4. 调整后的实施顺序

### Foundation Gate：先修两个 P0 contract

建议拆成两个 OpenSpec changes：

- `align-engine-runtime-capability-contract`
- `establish-logical-session-runtime-identity`

范围：

- 对齐 Rust / daemon / TypeScript capability DTO。
- 区分 `supported`、`policy-enabled`、`runtime-available` 和 `compat-input`。
- capability matrix 可在 production runtime 查询，不再 import archived fixture。
- 定义 `logicalSessionId`、`nativeSessionId`、`pendingAlias`、`runId`、`turnId`、`itemId`。
- Kimi `pending -> canonical` promotion 保持独立 state machine。

原因：后续 bus、adapter、plugin 和 orchestration 都依赖能力与身份不说谎。

### Foundation Stage 1：建立统一事件与执行边界

建议拆成三个协调推进的 OpenSpec changes：

- `establish-unified-engine-event-bus`
- `define-engine-adapter-protocol-registry`
- `define-engine-runtime-lifecycle`

范围：

- 在 Rust runtime 内统一为 `MossxAgentEvent`，再分发到 frontend、persistence 和未来 extension/orchestrator sink。
- bus 统一分配 run/turn/item identity，并提供唯一完成信号 `run:settled`。
- `EngineProtocol` 负责 process spawn、stdout/stderr parse、input 和 termination。
- `EngineAdapter` 负责 identity、capabilities、session semantics、message delivery 和 protocol binding。
- registry 保存 built-in/plugin provenance；built-in 保持 typed enum，外部 engine 通过稳定 string `EngineId` 注册，不能要求重编译 Rust enum。
- runtime manager 负责 session handle 创建、替换、rebind 和 teardown；旧 handle 替换后立即失效。

这一步是未来 L2 extension event surface、L3 plugin runtime 和 L5 orchestration 的真正基石。

### Foundation Stage 2：统一投递、session 与模型目录

建议拆成三个 OpenSpec changes：

- `define-engine-message-delivery-semantics`
- `establish-executable-session-registry`
- `converge-model-provider-catalog-runtime`

范围：

- 统一 `prompt / steer / followUp / nextTurn` 语义。
- capability 不支持 mid-turn input 时显式降级或拒绝，不能伪装成功；Kimi 当前应声明 `input.midTurn = unsupported`。
- session catalog 从 read-only projection 演进为可执行 registry，并记录 durable cursor。
- session control API 与 event handler 分离，避免 handler 内等待控制命令形成 deadlock。
- model/provider 采用 `provider × protocol` 正交建模。
- catalog precedence 固定为 `runtime > configured > cached > generated fallback`。
- refresh 失败保留最后成功 cache，并返回 stale/error metadata。
- provider/source/provenance 完整穿过 DTO，前端 inference 仅作 legacy fallback。

### Compatibility Stage：处理现有引擎债务

拆成独立 changes，避免污染 foundation：

- Kimi：branch scanner、config diagnostics、provider cleanup warning、main specs 和 canonical regression。
- Claude：canonical storage migration、typed error propagation。
- OpenCode：确认 soft-retirement boundary；清理不可达 panel、root hook 和全局 CSS。仅当产品重新启用 OpenCode 时，才投入 CLI parser/provider modernize。

### Cleanup Stage：最后迁移 facade

- 按 bus、registry、catalog 和 lifecycle 的 owner 拆 `useEngineController`。
- 暂时保留 facade，避免一次性改写 `AppShell`。
- 不再拆 `OpenCodeControlPanel`；隐藏功能的千行面板应优先删除或隔离，而不是精装修。

---

## 5. 范围边界与 change 拆分原则

本专项建设的是未来 CLI 串线的 **L1 foundation**，明确不包含：

- plugin manifest、安装、签名和 marketplace UI。
- plugin worker/sandbox、host API 白名单。
- handoff UI、pipeline editor 和后台 task scheduler。
- 外部 JSONL RPC server 的完整实现。

但 L1 必须预留稳定 consumer contract：

- `MossxAgentEvent` 有 provenance、run/turn/item identity。
- `run:settled` 是唯一完成边界；不能用 `response accepted` 或某个 delta 结束代替。
- session state 可 replay；未来 orchestration 使用 append-only log 和 durable cursor，不依赖轮询。
- handoff 只传 summary + full-history reference，不复制无限原始历史。
- 高频 delta 不进入 React root state。

不能把全部任务合成一个 change：

- capability/identity 是 P0 correctness。
- event bus 是 runtime data plane。
- adapter/protocol 是 engine extension boundary。
- lifecycle/delivery 是 control plane。
- catalog 是 model/provider ownership。
- Kimi/Claude/OpenCode 是 compatibility debt。

每个 change 必须声明兼容层、回滚边界和删除条件。

---

## 6. 验收门禁

### 6.1 Capability / identity

- capability key 在 TypeScript、Rust、daemon 和 production artifact 中有显式 contract。
- `supported`、`policy-enabled`、`runtime-available`、`compat-input` 不混为一个 boolean。
- `input.midTurn`、session resume/fork/switch/tree、RPC readiness 可查询。
- 业务模块不再新增 `startsWith("<engine>:")`。
- Kimi promotion 后只有 canonical identity；迟到 delta 不会复活 pending identity。

### 6.2 Unified event bus

- 各引擎先翻译为 `MossxAgentEvent`，frontend bridge 不再直接承担跨引擎归一化。
- 每个事件带 engine provenance，以及稳定 `runId / turnId / itemId`。
- 每个 run 恰好产生一个幂等 `run:settled`。
- frontend、persistence 和未来 extension sink 可独立订阅；一个 sink 失败不阻塞其他 sink。
- 保留现有 frontend app-server contract 的兼容 bridge。

### 6.3 Adapter / protocol / lifecycle

- process parsing 与 engine semantics 分属 `EngineProtocol`、`EngineAdapter`。
- Codex persistent app-server 和 one-shot CLI 都能通过同一 adapter contract 接入。
- session 替换后旧 handle 不可调用；跨边界只传 plain data。
- cleanup/abort/rebind 有 focused tests，无 orphan process 和重复 listener。
- plugin engine registration 带 source/provenance，不要求修改 built-in Rust enum。

### 6.4 Message delivery / session

- `prompt / steer / followUp / nextTurn` 有统一状态机和 fallback policy。
- unsupported mid-turn input 显式返回 capability error，不静默丢消息。
- `run:settled` 后才 drain follow-up；steering 只在 active run 投递。
- session control API 不在 event handler 内同步等待自身事件。
- durable cursor 可恢复，后台 drain 事件驱动，不增加秒级 polling。

### 6.5 Model / provider catalog

- catalog precedence 为 `runtime > configured > cached > generated fallback`。
- refresh 失败保留上次成功 cache，并标明 stale/error。
- provider 与 protocol 正交；provider/source/provenance 经 DTO 完整传递。
- 同一 engine 只有一个 generated fallback owner，且带 freshness policy。

### 6.6 Compatibility reliability

- Claude mapping 只写 canonical key；失败用户可见。
- Kimi config 区分 missing、malformed 和 I/O error；cleanup failure 返回 warning。
- scanner 覆盖 Kimi；Kimi main specs 覆盖 runtime/history/lifecycle/provider。
- history-first 与 terminal-after-promotion 时序均有 regression test。
- Kimi runtime/history/lifecycle/provider 的 main spec 不再保留 TBD contract。
- OpenCode 默认关闭且没有意外启用路径；retired UI 不挂 AppShell root hook、不加载无用全局 CSS。

### 6.7 Rendering regression

- `MossxAgentEvent` bus 不逐 delta 写入 AppShell root state。
- 流式正文继续走 `liveAssistantTextChannel`；不恢复逐 delta reducer dispatch。
- frontend bridge 保留 batching 和 critical event bypass。
- extension/orchestration consumer 使用外部 store 或细粒度订阅，不新增 root 高频 hook。

### 6.8 Regression

- 已修复的 `isValidModelId` 继续保持单一 contract。
- targeted tests、typecheck、Rust tests 和 OpenSpec verify 均通过。
- degraded mode（CLI 不可用、runtime list 失败、localStorage 不可用）有专门验证。

---

## 7. 已执行的摸底验证

```bash
npm run check:engine-capability-matrix
```

结果：通过。

```bash
npm exec -- vitest run \
  src/features/engine/engineCapabilityMatrix.test.ts \
  src/features/engine/utils/engineAvailability.test.ts \
  src/features/opencode/store/modelMetadata.test.ts \
  src/features/vendors/hooks/useProviderManagement.test.tsx
```

结果：4 个 test files、11 个 tests 全部通过。

```bash
npm exec -- vitest run \
  src/features/vendors/hooks/useKimiProviderManagement.test.tsx \
  src/features/threads/loaders/kimiHistoryParser.test.ts
```

结果：2 个 Kimi test files、11 个 tests 全部通过。

这只能证明现有测试基线稳定，不能证明上述治理问题不存在。尤其：

- `useProviderManagement` 的失败传播测试仍明显不足。
- Kimi provider tests 没有覆盖 `config.toml` cleanup warning，因为当前 backend 会吞掉该错误。
- Kimi history parser tests 不等于 pending → canonical realtime promotion 的完整时序验证。

---

## 8. 证据索引

### Engine / capability

- `src/types/engine.ts`
- `src/features/engine/hooks/useEngineController.ts`
- `src/features/engine/engineCapabilityMatrix.ts`
- `src/features/engine/utils/engineAvailability.ts`
- `src/utils/engineExecutionPolicy.ts`
- `src-tauri/src/engine/mod.rs`
- `src-tauri/src/engine/capability_matrix.rs`
- `src-tauri/src/engine_policy.rs`
- `src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs`
- `openspec/specs/engine-capability-matrix/spec.md`

### Models / vendors

- `src/features/models/codexModelCatalog.ts`
- `src/features/models/hooks/useModels.ts`
- `src/features/models/constants.ts`
- `src/features/vendors/hooks/useProviderManagement.ts`
- `src/features/vendors/components/VendorSettingsPanel.tsx`
- `src-tauri/src/engine/status.rs`
- `openspec/specs/codex-model-catalog-coverage/spec.md`
- `openspec/specs/claude-dynamic-model-discovery/spec.md`
- `openspec/specs/claude-provider-management/spec.md`

### OpenCode / thread identity

- `src/features/opencode/components/OpenCodeControlPanel.tsx`
- `src/features/opencode/hooks/useOpenCodeControlPanel.ts`
- `src-tauri/src/commands_opencode.rs`
- `src-tauri/src/commands_opencode_helpers.rs`
- `src-tauri/src/commands_parse_helpers.rs`
- `src/features/threads/adapters/realtimeAdapterRegistry.ts`
- `src/features/threads/adapters/sharedRealtimeAdapter.ts`
- `src/features/threads/hooks/useThreadTurnEvents.ts`
- `src/features/threads/hooks/useThreadItemEvents.ts`
- `src/features/threads/hooks/useThreadActions.helpers.ts`

### Kimi CLI

- `src-tauri/src/engine/kimi.rs`
- `src-tauri/src/engine/kimi_history.rs`
- `src-tauri/src/engine/status.rs`
- `src-tauri/src/vendors/kimi_providers.rs`
- `src/features/threads/adapters/kimiRealtimeAdapter.ts`
- `src/features/threads/loaders/kimiHistoryLoader.ts`
- `src/features/threads/loaders/kimiHistoryParser.ts`
- `src/features/vendors/hooks/useKimiProviderManagement.ts`
- `src/features/vendors/components/KimiProviderDialog.tsx`
- `scripts/scan-engine-name-branches.mjs`
- `openspec/specs/kimi-engine-runtime/spec.md`
- `openspec/changes/archive/2026-07-24-add-kimi-engine/proposal.md`
- `openspec/changes/archive/2026-07-24-add-kimi-engine/design.md`

### CLI foundation / PI research

- `docs/research/mossx-plugin-market-and-cli-foundation-design.md`
- `docs/research/pi-architecture-plugin-marketplace-analysis.md`
- `docs/research/pi-chat-orchestration-research.md`

### 外部事实校验

- [OpenAI Models](https://developers.openai.com/api/docs/models/all)
- [Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini Deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
- [OpenCode CLI](https://dev.opencode.ai/docs/cli/)
- [OpenCode Providers](https://opencode.ai/docs/providers)

---

## 9. 最终判断

原任务需要调整，不是推倒重来。

保留的任务：

- capability DTO、engine identity、model/provider catalog、Kimi canonical guard、Claude error/storage。

升级的任务：

- registry 升级为 `EngineAdapter × EngineProtocol` registry。
- thread identity 升级为 logical/native/pending/run/turn/item identity。
- capability matrix 升级为 runtime-queryable contract。

新增的 foundation 任务：

- Rust-side `MossxAgentEvent` bus。
- `run:settled` 与统一事件 identity。
- runtime/session handle lifecycle。
- `prompt / steer / followUp / nextTurn` delivery semantics。
- executable session registry 与 durable cursor。

降级或删除的任务：

- `useEngineController` 拆分后置为迁移结果。
- OpenCode 面板不再重构；按 soft-retirement 清理残余接入。

> 🛠 **深度推演**：真正的根因不是“硬编码很多”，而是 data plane、control plane 与 identity contract 没有稳定边界。只统一枚举会得到更整齐的硬编码；先建立 event、adapter、lifecycle、delivery 四个 contract，未来 plugin marketplace 和 orchestration 才不会再造第二套 runtime。

---

## 10. 必须修复任务清单

> 判断标准：能否保证当前消息正确、能否形成未来 CLI/plugin/orchestration 共用 contract。文件长度本身不构成 P0/P1。

| 任务                                           | 必须性                            | 当前表现                                                                        | 影响与用户表现                                                       | 建议                                                                                             | 优先级 |
| ---------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| 对齐 runtime capability contract               | **必须**                          | DTO 字段错位、三项固定 `unknown`，matrix 依赖 archived fixture                  | 能力入口误开/误关；后续 adapter 无法安全选择 steer、resume 等行为    | 统一 production DTO；区分 supported/policy/runtime/compat；增加 parity tests                     | **P0** |
| 建立统一 runtime/session identity              | **必须**                          | thread prefix 被当 schema；logical/native/pending/run/turn/item 混在一起        | 消息串错、重复 row、永久 processing；Kimi promotion 最敏感           | 明确定义六类 identity 和映射 owner；保留 Kimi alias state machine                                | **P0** |
| 建立 Rust-side `MossxAgentEvent` bus           | **必须，foundation blocker**      | 各 runtime/forwarder 直接翻译或分发，Codex 仍有独立路径                         | plugin、持久化和 orchestration 会各造一套事件；消息语义继续分叉      | 先归一化再 fan-out；统一 provenance 与 IDs；兼容现有 frontend bridge                             | **P0** |
| 定义唯一 `run:settled` 完成边界                | **必须，foundation blocker**      | completion 依赖引擎特定 terminal event，缺少统一 run 语义                       | follow-up 过早执行、后台任务假完成、pipeline 卡住或重复推进          | bus 产生幂等 `run:settled`；accepted/response/delta 均不得视为完成                               | **P0** |
| 建立 `EngineAdapter × EngineProtocol` registry | **必须**                          | registry 诉求仍停留在 ID/label；process parsing 与 engine 语义耦合              | 接新 CLI 仍要复制 runtime；未来 plugin engine 无稳定注册点           | protocol 管进程与解析，adapter 管语义；built-in enum + extensible `EngineId`；记录 provenance    | **P1** |
| 统一 runtime/session handle lifecycle          | **必须**                          | persistent app-server 与 one-shot CLI 生命周期分裂，session 替换规则不统一      | orphan process、重复 listener、旧 session 收到新消息                 | runtime manager 统一 create/replace/rebind/abort/teardown；旧 handle fail-fast                   | **P1** |
| 定义消息投递语义                               | **必须**                          | 各引擎对 active turn 中的新输入处理不同；Kimi stdin 为 null                     | 用户以为消息已发送，实际被丢弃或时序错乱                             | 统一 prompt/steer/followUp/nextTurn；按 capability 拒绝或降级；禁止静默成功                      | **P1** |
| 建立 executable session registry               | **必须**                          | shared session/catalog 偏 read-only projection，缺少统一控制与 cursor           | 恢复、handoff、后台 drain 难以可靠续跑                               | session control 与 event handler 分离；append-only state + durable cursor；事件驱动 drain        | **P1** |
| 收敛 model/provider catalog runtime            | **必须**                          | runtime/config/static fallback 多 owner；provider 在 DTO 丢失后前端重猜         | degraded mode 列表变化；模型/provider 标错；refresh 失败清空可用列表 | `runtime > configured > cached > generated fallback`；provider×protocol；cache 保留与 provenance | **P1** |
| 保护 Kimi canonical convergence                | **必须，防回退**                  | `kimi-pending-*` promotion 与 history/delta/terminal 存在竞态                   | 重复消息、迟到 delta 复活 pending row、幕布永久 loading              | 把现有 promotion 纳入 identity/bus contract；覆盖乱序时序 tests                                  | **P0** |
| 补齐 Kimi scanner、diagnostics 与 specs        | **必须**                          | scanner 漏 Kimi；config/cleanup 静默失败；main spec 不完整                      | Kimi 债务逃过 gate；损坏配置伪装正常；重构无验收依据                 | scanner 读取 registry；typed diagnostics/warning；补 runtime/history/lifecycle/provider specs    | **P1** |
| 完成 Claude storage/error 治理                 | **必须，但非 foundation blocker** | triple-write；load/save/switch/delete 错误被压成 null/false                     | 配置不同步，失败无感知                                               | canonical-only storage migration；typed result/error；失败路径 tests                             | **P1** |
| 收紧 OpenCode soft-retirement boundary         | **必须**                          | 默认隐藏，但 legacy config、root selection hook、全局 CSS 和不可达 panel 仍残留 | 隐藏功能继续占根链和维护面；可能被旧配置意外启用                     | 明确 compatibility adapter 或 hard-delete 二选一；默认不可达；移除 root hook/CSS/panel 残余      | **P1** |
| 拆分 `useEngineController` facade              | **后置必须**                      | 1008 行混合多个 owner                                                           | 维护成本高，但先拆会把旧 contract 扩散到更多文件                     | foundation owner 稳定后迁移职责，保留兼容 facade，最后缩薄/删除                                  | **P2** |
| 重构 `OpenCodeControlPanel`                    | **不做**                          | 面板 1011 行但已不可达/soft-retired                                             | 投入无产品收益，还会固化退休实现                                     | 删除或隔离；只有正式恢复 OpenCode 产品入口时重新评估                                             | —      |

### 10.1 优先级解释

- **P0：消息正确性或 foundation blocker。** 不完成就不应启动 plugin/orchestration 实现。
- **P1：foundation 完整性与现有兼容可靠性。** 可拆 change 推进，但应在 marketplace 前完成。
- **P2：结构清理。** 不阻塞 contract；在 owner 稳定后执行。

### 10.2 推荐执行批次

| 批次    | 任务                                   | 完成标志                                                                                 |
| ------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Batch 0 | Capability + identity P0 gate          | capability 不说谎；logical/native/pending/run/turn/item contract 明确；Kimi 时序回归通过 |
| Batch 1 | Event bus + `run:settled`              | 全部 engine 事件先进入统一 bus；现有幕布兼容；无 root render regression                  |
| Batch 2 | Adapter/protocol registry + lifecycle  | built-in CLI 接入统一 contract；session replace/abort/cleanup 可验证                     |
| Batch 3 | Delivery + executable session registry | steer/followUp fallback 明确；durable cursor 可恢复；无 polling/deadlock                 |
| Batch 4 | Model/provider catalog                 | precedence、cache、provider/provenance 完整；refresh failure 不清空最后可用目录          |
| Batch 5 | Kimi/Claude/OpenCode compatibility     | Kimi diagnostics/spec 完整；Claude 错误可见；OpenCode retired boundary 无根链残余        |
| Batch 6 | Controller facade cleanup              | 只做 owner 迁移与删除；不改变消息、模型和 engine 行为                                    |

### 10.3 与后续 PI/plugin/orchestration 的关系

| 后续能力                   | 依赖本专项输出                                        | 本专项是否实现                                        |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Plugin event hooks         | `MossxAgentEvent`、provenance、run/turn/item IDs      | 否，只提供 contract                                   |
| Plugin engine registration | `EngineAdapter` registry、extensible `EngineId`       | 否，只提供 registration boundary                      |
| Marketplace                | plugin provenance、capability declaration             | 否                                                    |
| Handoff                    | session registry、append-only state、`run:settled`    | 否                                                    |
| Steering/follow-up queue   | delivery semantics、runtime capability                | 仅实现 engine-level contract，不实现完整 orchestrator |
| Background pipeline        | durable cursor、event-driven drain、settled semantics | 否                                                    |

### 10.4 OpenSpec change 落盘映射

以下 change 已完成实现、验证、spec sync 与 archive：

| 批次    | OpenSpec change                              | 任务数 | 状态                    | 依赖/执行说明                       |
| ------- | -------------------------------------------- | -----: | ----------------------- | ----------------------------------- |
| Batch 0 | `align-engine-runtime-capability-contract`   |      8 | ✅ 已归档（2026-07-26） | 首个 P0 gate                        |
| Batch 0 | `establish-logical-session-runtime-identity` |      8 | ✅ 已归档（2026-07-26） | 依赖 capability contract            |
| Batch 1 | `establish-unified-engine-event-bus`         |      9 | ✅ 已归档（2026-07-26） | 依赖 runtime identity               |
| Batch 2 | `define-engine-adapter-protocol-registry`    |      9 | ✅ 已归档（2026-07-26） | 依赖 capability contract            |
| Batch 3 | `define-engine-message-delivery-semantics`   |      8 | ✅ 已归档（2026-07-26） | 依赖 capability + event bus         |
| Batch 3 | `establish-executable-session-registry`      |      9 | ✅ 已归档（2026-07-26） | 依赖 identity + adapter registry    |
| Batch 4 | `converge-model-provider-catalog-runtime`    |     10 | ✅ 已归档（2026-07-26） | 依赖 capability contract            |
| Batch 5 | `harden-kimi-engine-governance`              |      8 | ✅ 已归档（2026-07-26） | canonical regression 为 P0；其余 P1 |
| Batch 5 | `harden-claude-provider-management`          |      8 | ✅ 已归档（2026-07-26） | 可在 foundation 外并行              |
| Batch 5 | `enforce-opencode-soft-retirement-boundary`  |      9 | ✅ 已归档（2026-07-26） | 可在 foundation 外并行              |
| Batch 6 | `migrate-engine-controller-facade`           |     10 | ✅ 已归档（2026-07-26） | 前序 owner 稳定后执行               |

共 96 个小任务，完成率 96/96。每个 change 均保留 `implementation-evidence.md`，主 specs 已同步；OpenCode 的旧 `opencode-engine` active spec 已被 soft-retirement contract 替代。
