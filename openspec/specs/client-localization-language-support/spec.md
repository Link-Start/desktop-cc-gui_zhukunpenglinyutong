# client-localization-language-support Specification

## Purpose

定义客户端受支持语言 catalog、locale fallback 与 localization pipeline 的行为契约。

## Requirements

### Requirement: Client language catalog exposes all supported locales

客户端 MUST 将 `zh`、`en`、`ja`、`ko`、`es`、`fr`、`de`、`pt-BR`、`ru`、`hi` 作为同一受支持 locale catalog，并为每个 locale 提供可选择 label 与资源入口。

#### Scenario: Render supported locale choices

- **WHEN** 用户打开语言设置
- **THEN** 客户端 MUST 展示全部 10 个 locale，且当前 locale MUST 映射到唯一选项

#### Scenario: Resolve a locale variant

- **WHEN** runtime locale 包含 region suffix 或当前资源不存在
- **THEN** 客户端 MUST 按既有 normalization/fallback contract 解析为受支持 locale，而不得渲染空界面

### Requirement: Localization pipeline preserves namespace completeness

Localization build/extract/merge pipeline MUST 以 namespace 为单位生成 locale modules，并 MUST 在缺失或重复 key 时提供可诊断检查结果。

#### Scenario: Build a localized namespace catalog

- **WHEN** localization workflow 处理新增 locale 或 namespace
- **THEN** 输出 MUST 能被客户端 locale index 加载，且 key structure MUST 与 source locale 对齐

### Requirement: Shared Send Protocol Vocabulary MUST Be Locale-Complete

The `sharedSend` localization namespace MUST provide locale-specific strings for Shared send
states, recovery actions, degraded-context actions, projection modes, omission
categories/reasons/dispositions, outcome labels, and token-detail labels. Every supported locale
module MUST expose the same keys and interpolation placeholders.

#### Scenario: locale modules keep namespace parity

- **WHEN** a Shared send localization key is added or changed
- **THEN** every supported `sharedSend` locale module MUST expose the same key
- **AND** interpolation placeholders MUST match the English source namespace

#### Scenario: Chinese UI does not leak known protocol labels

- **WHEN** the active locale is `zh` or `zh-TW`
- **THEN** known Shared send protocol labels and actions MUST render in Chinese
- **AND** `Probe`, `Binding`, `Attempt`, `Target`, `portable-transcript`, and known disposition values MUST NOT be used as the primary visible copy
