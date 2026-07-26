# codex-model-catalog-coverage Specification

## Purpose

定义内置 Codex model families 在 catalog、selector 与 fallback 场景中的覆盖一致性。
## Requirements
### Requirement: Built-in Codex model families remain selectable

内置 Codex model catalog MUST 为产品声明支持的 model family 提供稳定 id、display label 与 degraded reasoning fallback，Composer selector MUST 优先采用 runtime `model/list` 为每个模型返回的 reasoning metadata。

#### Scenario: Render a newly supported model family

- **WHEN** built-in catalog 增加 5.6 series model
- **THEN** Composer model selector MUST 展示对应选项，且 selection type MUST 接受该 model id

#### Scenario: Use catalog metadata without runtime hydration

- **WHEN** dynamic model hydration 暂不可用，或某个 runtime reasoning metadata 字段缺失
- **THEN** built-in supported models MUST 继续作为可选择 fallback，且不得伪造 provider origin
- **AND** 系统 MUST 只为缺失字段补充公共 reasoning fallback

#### Scenario: Runtime model metadata overrides common fallback

- **WHEN** runtime `model/list` 为模型返回非空 `supportedReasoningEfforts` 或 `defaultReasoningEffort`
- **THEN** Composer MUST 使用该模型的 runtime options/default
- **AND** 公共 fallback MUST NOT 覆盖、裁剪或重排 runtime 返回值

#### Scenario: Hydrate degraded startup catalog after runtime connects

- **WHEN** cold startup 的首次 `model/list` 在 Codex runtime ready 前返回 degraded empty catalog
- **AND** 当前 workspace 随后收到 `codex/connected`
- **THEN** 系统 MUST 为当前 workspace 重新请求 `model/list`
- **AND** Composer MUST 用重拉得到的模型专属 options/default 替换临时公共 fallback
- **AND** 非当前 workspace 的连接事件 MUST NOT 刷新当前 selector

#### Scenario: Different models expose different reasoning capabilities

- **WHEN** runtime 为 Sol、Terra、Luna 等模型返回不同的 reasoning option set 或 default
- **THEN** Composer MUST 按当前 selected model 展示对应值
- **AND** 切换模型时 selection MUST 按目标模型 capability 收敛

#### Scenario: Known ultra effort reaches the selector

- **WHEN** runtime model metadata 包含 `ultra`
- **THEN** typed Composer reasoning selector MUST 展示并允许选择 `ultra`
- **AND** 选择结果 MUST 沿既有 Codex effort payload 发送

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

