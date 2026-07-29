## ADDED Requirements

### Requirement: Composer Provider Header MUST Expose Source-Correct Catalog Actions

普通 Composer 的 Provider Profile 标题区 MUST 展示 config reload，并仅在 CLI capability 支持时展示 model discovery。

#### Scenario: Config-only Provider
- **WHEN** 当前 Provider Profile 的 CLI 不支持 model-list
- **THEN** 标题区 MUST 仅显示 `Reload Config`
- **AND** 点击后 MUST 更新当前模型框的 configured catalog

#### Scenario: Discovery-capable Provider
- **WHEN** 当前 Provider Profile 的 CLI 支持 model-list
- **THEN** 标题区 MUST 同时显示 `Reload Config` 与 `Discover Models`
- **AND** 两个 icon button MUST 有独立 accessible name、loading 与 error state

#### Scenario: Refresh preserves selection
- **WHEN** 任一 catalog action 完成
- **THEN** 当前有效 selection MUST 保留
- **AND** UI MUST NOT 因 catalog refresh 偷偷切换模型
