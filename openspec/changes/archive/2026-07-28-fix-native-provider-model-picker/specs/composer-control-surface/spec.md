## ADDED Requirements

### Requirement: Native Model Selector MUST Be Scoped To Its Current CLI Providers

Native Session 的 Composer model selector MUST 只展示来源 Session 当前 CLI 下的
Provider Profiles 与 Provider-scoped Model catalogs；它 MUST NOT 把其他 CLI 作为 model
group 展示。

#### Scenario: Claude native session lists only Claude providers

- **WHEN** 用户在 Claude Native Session 打开 model selector
- **THEN** selector MUST 展示 Claude CLI 的 local 与 managed Provider Profiles
- **AND** MUST NOT 展示 Codex CLI 或 Kimi CLI group

#### Scenario: Codex native session lists only Codex providers

- **WHEN** 用户在 Codex Native Session 打开 model selector
- **THEN** selector MUST 展示 Codex CLI 的 disk 与 managed Provider Profiles
- **AND** MUST NOT 展示 Claude Code 或 Kimi CLI group

#### Scenario: Kimi native session preserves capability boundary

- **WHEN** 用户在 Kimi Native Session 打开 model selector
- **THEN** selector MUST 展示 Kimi CLI 的 Provider Profiles
- **AND** 未验证为 continuation target 的其他 Kimi Provider MUST 保持不可选并展示原因
- **AND** 当前绑定 Provider 内的 Model selection MUST 继续可用

### Requirement: Provider Model Lists MUST Expand Mutually Exclusively

Composer Provider Profile 与 Model 列表 MUST 使用互斥折叠；同一 selector 中同一时间最多
展开一个 Provider Profile 的 Model 列表。

#### Scenario: opening another provider collapses the previous provider

- **WHEN** Provider A 的 Model 列表已展开，用户展开 Provider B
- **THEN** Provider B 的 Model 列表 MUST 展开
- **AND** Provider A 的 Model 列表 MUST 同步折叠

#### Scenario: expanded provider is keyboard operable

- **WHEN** keyboard 用户聚焦 Provider Profile trigger 并激活它
- **THEN** trigger MUST 切换该 Profile 的 expanded state
- **AND** MUST 暴露与可见状态一致的 `aria-expanded`

### Requirement: Native Provider Model Selection MUST Preserve Binding Semantics

Native selector MUST 根据来源 Session 的 frozen Engine + Provider Profile identity 分流
Model selection；当前 Provider 内选择 Model MUST 继续使用来源 Session，其他 Provider
选择 MUST NOT 原地改写来源 binding。

#### Scenario: model changes inside current provider

- **WHEN** 用户选择当前 Native binding Provider Profile 下的另一个 Model
- **THEN** Composer MUST 更新当前 Model selection
- **AND** MUST NOT 创建 Provider Continuation 或切换 CLI

#### Scenario: selecting another provider does not mutate source target

- **WHEN** 用户选择其他 Provider Profile 下的 Model
- **THEN** Composer MUST 请求 Provider Continuation confirmation
- **AND** 在 continuation 成功前 MUST NOT 改写来源 Session 的 Provider 或 Model
