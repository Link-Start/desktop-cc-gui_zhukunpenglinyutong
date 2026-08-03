## MODIFIED Requirements

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
