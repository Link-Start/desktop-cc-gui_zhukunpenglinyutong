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
