## ADDED Requirements

### Requirement: Provider Continuation MUST Freeze Runtime Model Identity

Provider Continuation 从 Provider-scoped catalog 选择模型时，destination MUST 将 catalog
entry identity 与 CLI runtime model 分开冻结。CLI invocation MUST 使用 runtime model；
catalog entry id MUST NOT 作为 runtime model 发送。

#### Scenario: catalog id differs from runtime model

- **WHEN** 用户选择的 catalog entry `id` 为 `settings-reasoning` 且 runtime `model` 为
  `deepseek-v4-pro`
- **THEN** continuation destination MUST 冻结两种 identity
- **AND** Claude CLI MUST 接收 `deepseek-v4-pro`
- **AND** MUST NOT 接收 `settings-reasoning`

#### Scenario: backend receives a proven UI-only model id

- **WHEN** Claude continuation payload 的 model 命中 Provider-scoped catalog entry id，且该
  entry 的 runtime model 不同
- **THEN** backend MUST 在 target identity 或 target-side effect 创建前返回
  `invalid-target-model`
- **AND** MUST NOT 静默把该 UI-only id 发送给 Claude CLI

#### Scenario: custom model is not present in catalog

- **WHEN** continuation payload 包含通过 shape validation 的 non-empty custom runtime model，
  且它不命中 catalog entry id
- **THEN** backend MUST 保留既有 custom model passthrough
- **AND** MUST NOT 引入 official-model allowlist

### Requirement: Provider Continuation Recovery MUST Prefer Explicit Rejection

Claude continuation recovery MUST 将当前 bootstrap 之后的结构化 Provider/API rejection
视为强负 evidence。Explicit rejection MUST 优先于 bootstrap user-entry、acceptance marker、
process error 与无关 stderr warning。

#### Scenario: bootstrap entry is followed by API rejection

- **WHEN** 同一 target history 含当前 package 的完整 bootstrap user entry，且其后 assistant
  entry 带 `isApiErrorMessage=true` 或 `apiErrorStatus`
- **THEN** operation MUST 记录 `target-provider-rejected`
- **AND** MUST NOT 进入 `ready`
- **AND** retry MUST probe 同一 target identity，MUST NOT 创建第二个 target

#### Scenario: source context mentions an old API error

- **WHEN** bootstrap user entry 的 Context Package 文本提及旧 `API Error`，但当前
  bootstrap 后没有结构化 rejection
- **THEN** recovery MUST NOT 把来源文本当成当前 target rejection

#### Scenario: process error conflicts with durable target rejection

- **WHEN** Claude process 返回 connector warning 或其他 runtime error，且 target history
  已持久化结构化 API rejection
- **THEN** user-facing technical detail MUST 以 target Provider/API rejection 为主
- **AND** warning MUST NOT 覆盖该根因
