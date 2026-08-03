## ADDED Requirements

### Requirement: Shared Local Model Selection MUST Preserve Catalog And Runtime Identity

Shared Session 双栏 model picker 的具体 Model selection MUST 原子提交一个可执行 `ExecutionTarget`，
并 MUST 分别保存 catalog entry
identity 与 runtime model identity，并且 MUST NOT 从 display label 猜测 runtime model。

#### Scenario: Codex switches to Claude local model with distinct identities

- **WHEN** 当前 Shared target 是 Codex CLI，用户选择 Claude Code 的
  `Local Settings.json` Provider 下 catalog id 为 `settings-main`、runtime model 为
  `kimi-for-coding` 的 row
- **THEN** picker MUST 关闭并提交一次 Claude local `ExecutionTarget`
- **AND** `modelCatalogEntryId` MUST 为 `settings-main`
- **AND** runtime `model` MUST 为 `kimi-for-coding`
- **AND** selection MUST NOT 创建 Turn 或 hidden binding

#### Scenario: legacy local row uses catalog id as runtime fallback

- **WHEN** local settings catalog row 的 runtime `model` 为空，但 catalog `id` 非空
- **THEN** selector MUST 使用 catalog `id` 作为 compatibility runtime model
- **AND** `modelCatalogEntryId` 与 runtime `model` MUST 同时提交为该 `id`
- **AND** 已知 `id != model` 的 row MUST 继续提交明确 runtime `model`

### Requirement: Native Provider Selection MUST Use The Same Normalized Binding Identity

Native 单栏与 Shared 双栏 MUST 复用同一 Provider binding identity 规则。
`engine + normalized providerProfileId` 是选中态 identity；`providerProfileSource` 是
metadata，不得因为 Native synthesized target 暂未携带 source 而丢失 Provider 或 Model 勾选。

#### Scenario: Native local selection omits source metadata

- **WHEN** Native Claude thread 的 target 使用 `providerProfileId = null`，且 synthesized
  target 未携带 `providerProfileSource`
- **THEN** `Local Settings.json` MUST 显示为当前 Provider
- **AND** runtime model 或 catalog entry 匹配的 row MUST 显示选中勾选
