# codex-model-catalog-coverage Specification

## Purpose

定义内置 Codex model families 在 catalog、selector 与 fallback 场景中的覆盖一致性。
## Requirements

### Requirement: Codex Provider Discovery MUST Use The Scoped Runtime Model List

Codex `Discover Models` MUST 通过目标 Provider binding 对应的 app-server session 执行
`model/list`，并与 configured/custom/fallback catalog 合并。

#### Scenario: Discover managed Provider models

- **WHEN** 用户为 Codex managed Provider B 执行 discovery
- **THEN** backend MUST acquire/reuse Provider B 的 app-server session
- **AND** MUST 向 Provider B session 发送 `model/list`
- **AND** MUST NOT 使用 legacy/default Codex session 的响应

#### Scenario: Discover local Codex models

- **WHEN** 用户为 Codex disk profile 执行 discovery
- **THEN** backend MUST 使用 canonical local Codex session identity
- **AND** MUST 返回 runtime model metadata

#### Scenario: Runtime unavailable

- **WHEN** Provider-scoped Codex app-server 无法启动或 `model/list` 失败
- **THEN** discovery MUST fail with binding-scoped diagnostics
- **AND** selector MUST 保留 last-good/configured/custom catalog

#### Scenario: Daemon does not support a managed runtime

- **WHEN** daemon mode 收到 managed Provider 的 discovery request
- **AND** daemon 尚未支持该 Provider runtime
- **THEN** command MUST 返回明确的 unsupported diagnostic
- **AND** MUST NOT 回退 disk/global Codex session

### Requirement: Built-in Codex model families remain selectable

内置 Codex model catalog MUST 为产品声明支持的 model family 提供稳定 id、display label 与经过版本化校准的 model-specific degraded reasoning fallback，Composer selector MUST 优先采用 runtime `model/list` 为每个模型返回的 reasoning metadata。

#### Scenario: Render a newly supported model family

- **WHEN** built-in catalog 增加 5.6 series model
- **THEN** Composer model selector MUST 展示对应选项，且 selection type MUST 接受该 model id

#### Scenario: Use model-specific catalog metadata without runtime hydration

- **WHEN** dynamic model hydration 暂不可用，或某个 runtime reasoning metadata 字段缺失
- **THEN** built-in supported models MUST 继续作为可选择 fallback，且不得伪造 provider origin
- **AND** 系统 MUST 只为缺失字段补充该 built-in model 对应的 versioned reasoning fallback
- **AND** 系统 MUST NOT 把同一组通用 options/default 无差别注入 capability 不同的 models

#### Scenario: Runtime model metadata overrides model-specific fallback

- **WHEN** runtime `model/list` 为模型返回非空 `supportedReasoningEfforts` 或 `defaultReasoningEffort`
- **THEN** Composer MUST 使用该模型的 runtime options/default
- **AND** model-specific fallback MUST NOT 覆盖、裁剪或重排 runtime 返回值

#### Scenario: Hydrate degraded startup catalog after runtime connects

- **WHEN** cold startup 的首次 `model/list` 在 Codex runtime ready 前返回 degraded empty catalog
- **AND** 当前 workspace 随后收到 `codex/connected`
- **THEN** 系统 MUST 为当前 workspace 重新请求 `model/list`
- **AND** Composer MUST 用重拉得到的模型专属 options/default 替换临时 fallback
- **AND** 非当前 workspace 的连接事件 MUST NOT 刷新当前 selector

#### Scenario: Different models expose different reasoning capabilities

- **WHEN** runtime 或 versioned fallback 为 Sol、Terra、Luna 等模型提供不同的 reasoning option set 或 default
- **THEN** Composer MUST 按当前 selected model 展示对应值
- **AND** 切换模型时 selection MUST 按目标模型 capability 收敛

#### Scenario: Known ultra effort reaches the selector

- **WHEN** runtime model metadata 或对应 built-in fallback 包含 `ultra`
- **THEN** typed Composer reasoning selector MUST 展示并允许选择 `ultra`
- **AND** 选择结果 MUST 沿既有 Codex effort payload 发送

#### Scenario: Unknown model remains capability-neutral in Native single-session

- **WHEN** custom 或 runtime-only model 没有返回 reasoning metadata，且不存在 exact built-in catalog identity
- **THEN** 系统 MUST NOT 根据 model family prefix、substring 或其他 heuristic 注入 reasoning capability
- **AND** Composer MUST 显示“默认”语义并保持 `selectedEffort = null`
- **AND** Native frontend MUST 通过 `send_user_message` 发送原始 custom model identity 与 `effort = null`，不得误走 Shared route
- **AND** 现有 Codex backend compatibility boundary MUST 保持 top-level `effort = null`，并在 `turn/start.reasoning.effort` 使用 `low`
- **AND** backend compatibility fallback MUST NOT 被反向投影为该 model 的 selectable capability

#### Scenario: Unknown model remains capability-neutral in Shared session

- **WHEN** Shared Codex target 的 custom 或 runtime-only model 没有 reasoning metadata，且不存在 exact built-in catalog identity
- **THEN** Shared Composer MUST 显示“默认”语义，target reasoning MUST 保持 `null`
- **AND** 系统 MUST NOT 根据 model family prefix、substring 或其他 heuristic 注入 reasoning capability
- **AND** Codex owner route MUST 复用与 Native 相同的 backend compatibility boundary，不得建立第二套 default mapping

### Requirement: Kanban Codex Selector MUST Reuse The Hydrated Catalog

Kanban 任务创建与编辑 selector 在 engine 为 Codex 时，MUST 使用 Composer catalog owner 已 hydrate 的 Codex model facts，而不得以 engine detection status 中的硬编码 fallback list 覆盖该 catalog。非 Codex engine MUST 保持其既有 model source。

#### Scenario: Kanban shows the same Codex catalog facts

- **WHEN** 同一 workspace 的 Composer catalog owner 已组合 runtime、config、custom 或 built-in Codex models
- **AND** 用户在 Kanban 创建或编辑任务时选择 Codex
- **THEN** Kanban model selector MUST 按共享 catalog 的顺序展示相同 model ids 与 display labels
- **AND** engine detection status 中独有的 stale fallback model MUST NOT 额外出现

#### Scenario: Valid selection survives catalog refresh

- **WHEN** Kanban 当前选择的 Codex model 在 refreshed catalog 中仍然存在
- **THEN** selector MUST 保留当前 model id
- **AND** catalog refresh MUST NOT 无条件重置 draft 或 edit selection

#### Scenario: Missing selection falls back deterministically

- **WHEN** 当前 Codex model 不存在于 refreshed catalog
- **THEN** selector MUST 选择 catalog default model
- **AND** 若无 default model，则 MUST 选择首个 model
- **AND** 若 catalog 为空，则 MUST 将 selection 设为 empty

#### Scenario: Selected model reaches task payload

- **WHEN** 用户从共享 Codex catalog 选择 model 并创建或更新 Kanban task
- **THEN** task payload MUST 保留所选 model id
- **AND** 现有 `KanbanTask.modelId` storage 与 execution contract MUST 保持兼容

### Requirement: Codex Catalog MUST Use Shared Source Precedence And Last-Good Cache

Codex model discovery MUST participate in the shared `runtime > configured > cached > generated fallback` contract and MUST NOT maintain divergent frontend/backend fallback rosters.

#### Scenario: Codex model/list succeeds

- **WHEN** runtime `model/list` returns a valid catalog
- **THEN** runtime facts MUST override generated fallback metadata
- **AND** the validated result MUST become last-good cache

#### Scenario: Codex model/list fails

- **WHEN** runtime refresh fails after a successful catalog
- **THEN** last-good catalog MUST remain available with stale/error metadata

### Requirement: User-Managed Custom Codex Models MUST Expose Mainstream Reasoning Options

用户通过「自定义模型」管理器写入 localStorage 的 Codex 自定义模型（`source: custom`）在缺少 reasoning metadata 时，MUST 暴露公共默认档位 `low/medium/high/xhigh` 且默认档为 `medium`，使 reasoning selector 可用、effort 选择不丢失。该默认档 MUST NOT 覆盖 runtime `model/list` 或 authoritative catalog 的 identity 匹配 metadata；MUST NOT 应用于 CLI runtime 发现的 unknown model（`source` 非 custom 的未登记模型保持 capability-neutral）。

#### Scenario: Custom codex model without metadata

- **WHEN** 用户添加自定义 Codex 模型且无 reasoning metadata
- **THEN** reasoning selector MUST 展示 low/medium/high/xhigh 四档
- **AND** 默认档 MUST 为 medium

#### Scenario: Custom model matches authoritative identity

- **WHEN** 自定义模型 runtime identity 命中 authoritative catalog
- **THEN** authoritative metadata MUST 覆盖公共默认档
- **AND** 公共默认档 MUST NOT 覆盖 runtime 返回

#### Scenario: Custom model selection preserves effort

- **WHEN** 用户在 Atomic picker 选择自定义 Codex 模型且 target reasoning 为空
- **THEN** 生成的 ExecutionTarget MUST 播种 `reasoning = { effort: "medium" }`
- **AND** 用户已选 effort MUST 不被覆盖

#### Scenario: Unknown runtime model stays neutral

- **WHEN** CLI discovery 返回的 unknown model 无 reasoning metadata
- **THEN** selector MUST 保持“默认”展示与 `selectedEffort = null`
- **AND** 不因本 requirement 获得伪造 capability

### Requirement: Codex Runtime Health Probes MUST NOT Refresh The Model Catalog

Codex runtime health/readiness probes MUST use a supported non-model RPC and MUST NOT call `model/list`. Explicit catalog loading MUST remain owned by the existing model catalog owner, which preserves its in-flight dedupe and last-good or built-in fallback behavior.

#### Scenario: an existing workspace runtime is ensured

- **WHEN** the client checks whether an existing Codex app-server is healthy before reuse
- **THEN** the probe MUST use `collaborationMode/list` or an equivalent supported non-model static RPC
- **AND** it MUST NOT send `model/list`.

#### Scenario: the user or startup owner requests the catalog

- **WHEN** an explicit model catalog load is required
- **THEN** it MUST continue through the existing model catalog owner
- **AND** concurrent consumers MUST reuse that owner's existing in-flight operation
- **AND** failure MUST preserve the last-good catalog or built-in supported fallback.

#### Scenario: Codex emits a periodic upstream refresh timeout

- **WHEN** the Codex app-server's own periodic model refresh worker reports the same timeout repeatedly
- **THEN** the client MUST retain bounded, aggregated diagnostic evidence
- **AND** it MUST NOT claim that changing the health probe disabled or repaired the upstream worker.
