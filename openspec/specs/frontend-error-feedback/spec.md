# frontend-error-feedback Specification

## Purpose

Define the renderer contract for application-owned、non-blocking、localizable error feedback and prohibit browser native Alert in production paths.

## Requirements

### Requirement: Renderer production errors MUST NOT use native Alert

Renderer 生产代码 MUST 使用 application-owned、non-blocking、localizable feedback surface 展示错误，MUST NOT 调用 browser native `alert()` 或 `window.alert()`。

#### Scenario: non-recoverable action fails

- **WHEN** workspace、session、Prompt、Git 或其他 renderer action 发生不可恢复错误
- **THEN** UI MUST use the existing global Error Toast or a domain-specific application dialog
- **AND** UI MUST NOT invoke native `alert()` / `window.alert()`
- **AND** diagnostic detail MAY remain in Debug/logging channels after secret-safe normalization

#### Scenario: future code introduces native Alert

- **WHEN** ESLint checks renderer production TypeScript
- **THEN** direct `alert()` and `window.alert()` access MUST fail lint
- **AND** test-only negative assertions and security fixture strings MAY remain allowed
