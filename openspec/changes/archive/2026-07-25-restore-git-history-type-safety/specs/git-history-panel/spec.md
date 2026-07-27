## ADDED Requirements

### Requirement: Git History core boundaries MUST remain type checked

Git History 的 panel implementation、view、dialogs 与 interaction hook MUST 在项目 strict TypeScript configuration 下通过检查，且不得用 file-level suppression 或 `any` scope 绕过 contract。

#### Scenario: panel scope is consumed by render and interaction layers

- **WHEN** implementation state 被传入 view、dialogs 或 interaction hook
- **THEN** consumer MUST 接受可追踪的 typed contract
- **AND** TypeScript MUST reject unknown fields and incompatible callback payloads

#### Scenario: high-risk Git action is changed

- **WHEN** delete、reset、rebase、checkout 或 cherry-pick action 的 payload 发生修改
- **THEN** change MUST pass strict typecheck and focused Git History tests
- **AND** target files MUST NOT add `@ts-nocheck`
