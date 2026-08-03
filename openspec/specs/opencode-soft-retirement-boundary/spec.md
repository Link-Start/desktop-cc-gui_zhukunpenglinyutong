# opencode-soft-retirement-boundary Specification

## Purpose

定义 OpenCode soft-retirement 的产品边界：保留历史兼容读取能力，但关闭所有生产交互与执行入口。

## Requirements

### Requirement: OpenCode Restoration MUST Require A New OpenSpec Change

Re-enabling OpenCode interaction or modernizing its provider/CLI contract MUST require a new product decision and OpenSpec proposal.

#### Scenario: code adds a new OpenCode entry

- **WHEN** CI detects a production OpenCode entry without a corresponding active change
- **THEN** governance validation MUST fail
